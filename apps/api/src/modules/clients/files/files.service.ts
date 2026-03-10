import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../common/services/storage.service';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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

}
