import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../common/services/storage.service';

@Injectable()
export class FilesService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'psikoport-files';
    this.s3 = new S3Client({
      region: this.config.get<string>('S3_REGION') ?? 'tr-istanbul',
      ...(endpoint && { endpoint, forcePathStyle: true }),
      credentials: this.config.get<string>('S3_ACCESS_KEY')
        ? {
            accessKeyId: this.config.get<string>('S3_ACCESS_KEY')!,
            secretAccessKey: this.config.get<string>('S3_SECRET_KEY')!,
          }
        : undefined,
    });
  }

  /** Step 1: Presigned PUT URL oluştur, DB kaydı OLUŞTURMA */
  async generateUploadUrl(
    tenantId: string,
    clientId: string,
    fileName: string,
    mimeType: string,
  ): Promise<{ uploadUrl: string; fileKey: string }> {
    await this.assertClientBelongsToTenant(clientId, tenantId);
    const fileKey = this.storage.buildKey(tenantId, clientId, fileName);
    const { url } = await this.storage.generateUploadUrl(fileKey, mimeType);
    return { uploadUrl: url, fileKey };
  }

  /** Step 2: S3'te dosyayı doğrula ve ClientFile kaydı oluştur */
  async confirmUpload(
    tenantId: string,
    clientId: string,
    userId: string,
    fileKey: string,
    metadata: { fileName: string; mimeType: string; fileSize: number },
  ): Promise<{ fileId: string }> {
    await this.assertClientBelongsToTenant(clientId, tenantId);

    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: fileKey }));
    } catch {
      throw new BadRequestException('Dosya S3\'te bulunamadı. Önce yükleyin.');
    }

    const file = await this.prisma.clientFile.create({
      data: {
        tenantId,
        clientId,
        fileName: metadata.fileName,
        fileKey,
        fileSize: metadata.fileSize,
        mimeType: metadata.mimeType,
        uploadedBy: userId,
      },
    });

    return { fileId: file.id };
  }

  /** Legacy: tek adımda URL + DB kaydı (mevcut frontend ile uyumluluk) */
  async getUploadUrl(
    clientId: string,
    tenantId: string,
    userId: string,
    fileName: string,
    contentType: string,
    fileSize?: number,
  ): Promise<{ url: string; key: string; fileId: string }> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) {
      throw new NotFoundException('Danışan bulunamadı');
    }

    const key = this.storage.buildKey(tenantId, clientId, fileName);
    const { url } = await this.storage.generateUploadUrl(key, contentType);

    const file = await this.prisma.clientFile.create({
      data: {
        tenantId,
        clientId,
        fileName,
        fileKey: key,
        fileSize: fileSize ?? 0,
        mimeType: contentType,
        uploadedBy: userId,
      },
    });

    return { url, key, fileId: file.id };
  }

  async list(
    clientId: string,
    tenantId: string,
  ): Promise<
    Array<{
      id: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      createdAt: string;
    }>
  > {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) {
      throw new NotFoundException('Danışan bulunamadı');
    }

    const files = await this.prisma.clientFile.findMany({
      where: { clientId, tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        createdAt: true,
      },
    });

    return files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileSize: f.fileSize,
      mimeType: f.mimeType,
      createdAt: f.createdAt.toISOString(),
    }));
  }

  async getDownloadUrl(
    clientId: string,
    fileId: string,
    tenantId: string,
  ): Promise<{ url: string }> {
    const file = await this.prisma.clientFile.findFirst({
      where: { id: fileId, clientId, tenantId },
    });
    if (!file) {
      throw new NotFoundException('Dosya bulunamadı');
    }

    const url = await this.storage.generateDownloadUrl(file.fileKey);
    return { url };
  }

  async delete(clientId: string, fileId: string, tenantId: string): Promise<void> {
    const file = await this.prisma.clientFile.findFirst({
      where: { id: fileId, clientId, tenantId },
    });
    if (!file) {
      throw new NotFoundException('Dosya bulunamadı');
    }

    await this.storage.deleteFile(file.fileKey);
    await this.prisma.clientFile.delete({
      where: { id: fileId },
    });
  }

  private async assertClientBelongsToTenant(clientId: string, tenantId: string): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) {
      throw new NotFoundException('Danışan bulunamadı');
    }
  }
}
