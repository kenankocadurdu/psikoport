import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const PRESIGN_EXPIRY_SEC = 300; // 5 min

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    this.region = this.config.get<string>('S3_REGION') ?? 'tr-istanbul';
    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'psikoport-files';

    this.s3 = new S3Client({
      region: this.region,
      ...(endpoint && {
        endpoint,
        forcePathStyle: true,
      }),
      credentials: this.config.get<string>('S3_ACCESS_KEY')
        ? {
            accessKeyId: this.config.get<string>('S3_ACCESS_KEY')!,
            secretAccessKey: this.config.get<string>('S3_SECRET_KEY')!,
          }
        : undefined,
    });
  }

  /**
   * S3 key for license doc: ${tenantId}/license/${userId}/${uuid}-${filename}
   */
  buildLicenseDocKey(tenantId: string, userId: string, filename: string): string {
    const uuid = crypto.randomUUID();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${tenantId}/license/${userId}/${uuid}-${safeName}`;
  }

  /**
   * S3 key for profile photo: ${tenantId}/profile/${userId}/${uuid}-${filename}
   */
  buildProfilePhotoKey(tenantId: string, userId: string, filename: string): string {
    const uuid = crypto.randomUUID();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${tenantId}/profile/${userId}/${uuid}-${safeName}`;
  }

  /**
   * S3 key format: ${tenantId}/${clientId}/${uuid}-${filename}
   */
  buildKey(tenantId: string, clientId: string, filename: string): string {
    const uuid = crypto.randomUUID();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${tenantId}/${clientId}/${uuid}-${safeName}`;
  }

  async generateUploadUrl(
    key: string,
    contentType: string,
  ): Promise<{ url: string; key: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.s3, command, {
      expiresIn: PRESIGN_EXPIRY_SEC,
    });
    return { url, key };
  }

  async generateDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, {
      expiresIn: PRESIGN_EXPIRY_SEC,
    });
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}
