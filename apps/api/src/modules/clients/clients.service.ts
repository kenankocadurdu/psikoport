import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from 'prisma-client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateClientDto } from './dto/create-client.dto';
import { ImportClientRowDto } from './dto/import-clients.dto';
import type { UpdateClientDto } from './dto/update-client.dto';
import type { ClientQueryDto } from './dto/client-query.dto';
import { AuditLogService, type PaginatedResponse } from '../legal/audit-log.service';
import { DekCacheService } from '../common/services/dek-cache.service';
import { EncryptionService } from '../common/services/encryption.service';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly dekCache: DekCacheService,
    private readonly encryption: EncryptionService,
  ) {}

  /** Encrypt a nullable string PII field → base64(nonce||authTag||ciphertext) */
  private async enc(tenantId: string, value: string | null | undefined): Promise<string | null> {
    if (!value) return null;
    const { ciphertext, nonce, authTag } = await this.encryption.encrypt(tenantId, value);
    const buf = Buffer.concat([nonce, authTag, ciphertext]);
    return buf.toString('base64');
  }

  /** Decrypt a nullable PII field; returns plaintext or null (graceful fallback for non-encrypted legacy values) */
  private async dec(tenantId: string, value: string | null | undefined): Promise<string | null> {
    if (!value) return null;
    try {
      const buf = Buffer.from(value, 'base64');
      // Minimum length: 12 (nonce) + 16 (authTag) + 1 (ciphertext) = 29
      if (buf.length < 29) return value; // legacy plaintext fallback
      const nonce = buf.subarray(0, 12);
      const authTag = buf.subarray(12, 28);
      const ciphertext = buf.subarray(28);
      return await this.encryption.decrypt(tenantId, ciphertext, nonce, authTag);
    } catch {
      return value; // legacy plaintext fallback
    }
  }

  async create(
    dto: CreateClientDto,
    tenantId: string,
  ): Promise<{ id: string; firstName: string; lastName: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const activeCount = await this.prisma.client.count({
      where: {
        tenantId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
    if (activeCount >= tenant.maxClients) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_EXCEEDED',
        message: 'Danışan limitinize ulaştınız',
      });
    }

    const [encTcKimlik, encPhone, encEmail] = await Promise.all([
      this.enc(tenantId, dto.tcKimlik),
      this.enc(tenantId, dto.phone),
      this.enc(tenantId, dto.email),
    ]);

    const client = await this.prisma.client.create({
      data: {
        tenantId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        tcKimlik: encTcKimlik,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        gender: dto.gender ?? null,
        maritalStatus: dto.maritalStatus ?? null,
        educationLevel: dto.educationLevel ?? null,
        occupation: dto.occupation ?? null,
        phone: encPhone,
        email: encEmail,
        address: dto.address ?? null,
        emergencyContact: (dto.emergencyContact ?? null) as Prisma.InputJsonValue,
        preferredContact: dto.preferredContact ?? [],
        tags: dto.tags ?? [],
        complaintAreas: dto.complaintAreas ?? [],
        referralSource: dto.referralSource ?? null,
      },
    });
    return {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
    };
  }

  async findAll(
    query: ClientQueryDto,
    tenantId: string,
  ): Promise<
    PaginatedResponse<{
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
      status: string;
      tags: string[];
      createdAt: Date;
    }>
  > {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.tags?.length) {
      where.tags = { hasEvery: query.tags };
    }

    if (query.complaintAreas?.length) {
      where.complaintAreas = { hasEvery: query.complaintAreas };
    }

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          tags: true,
          createdAt: true,
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    const decrypted = await Promise.all(
      data.map(async (c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: await this.dec(tenantId, c.email),
        phone: await this.dec(tenantId, c.phone),
        status: c.status,
        tags: c.tags,
        createdAt: c.createdAt,
      })),
    );

    return {
      data: decrypted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!client) {
      throw new NotFoundException('Danışan bulunamadı');
    }

    const [tcKimlik, phone, email] = await Promise.all([
      this.dec(tenantId, client.tcKimlik),
      this.dec(tenantId, client.phone),
      this.dec(tenantId, client.email),
    ]);

    return { ...client, tcKimlik, phone, email };
  }

  async update(
    id: string,
    dto: UpdateClientDto,
    tenantId: string,
  ) {
    const existing = await this.prisma.client.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Danışan bulunamadı');
    }

    const [encTcKimlik, encPhone, encEmail] = await Promise.all([
      dto.tcKimlik !== undefined ? this.enc(tenantId, dto.tcKimlik) : Promise.resolve(undefined),
      dto.phone !== undefined ? this.enc(tenantId, dto.phone) : Promise.resolve(undefined),
      dto.email !== undefined ? this.enc(tenantId, dto.email) : Promise.resolve(undefined),
    ]);

    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.tcKimlik !== undefined && { tcKimlik: encTcKimlik ?? null }),
        ...(dto.birthDate !== undefined && {
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        }),
        ...(dto.gender !== undefined && { gender: dto.gender ?? null }),
        ...(dto.maritalStatus !== undefined && {
          maritalStatus: dto.maritalStatus ?? null,
        }),
        ...(dto.educationLevel !== undefined && {
          educationLevel: dto.educationLevel ?? null,
        }),
        ...(dto.occupation !== undefined && {
          occupation: dto.occupation ?? null,
        }),
        ...(dto.phone !== undefined && { phone: encPhone ?? null }),
        ...(dto.email !== undefined && { email: encEmail ?? null }),
        ...(dto.address !== undefined && { address: dto.address ?? null }),
        ...(dto.emergencyContact !== undefined && {
          emergencyContact: dto.emergencyContact as Prisma.InputJsonValue,
        }),
        ...(dto.preferredContact !== undefined && {
          preferredContact: dto.preferredContact,
        }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.complaintAreas !== undefined && {
          complaintAreas: dto.complaintAreas,
        }),
        ...(dto.referralSource !== undefined && {
          referralSource: dto.referralSource ?? null,
        }),
      },
    });
    return updated;
  }

  async softDelete(id: string, tenantId: string) {
    const existing = await this.prisma.client.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Danışan bulunamadı');
    }

    await this.prisma.client.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
      },
    });
    return { success: true };
  }

  async importBulk(
    rows: Array<Record<string, unknown>>,
    tenantId: string,
  ): Promise<{ imported: number; failed: number; errors: Array<{ row: number; message: string }> }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const activeCount = await this.prisma.client.count({
      where: {
        tenantId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    const errors: Array<{ row: number; message: string }> = [];
    let imported = 0;

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const rowNum = i + 1;

      const dto = plainToInstance(ImportClientRowDto, raw);
      const violations = await validate(dto, { whitelist: true });
      if (violations.length > 0) {
        const msg = violations
          .flatMap((v) => Object.values(v.constraints ?? {}))
          .join('; ');
        errors.push({ row: rowNum, message: msg || 'Validasyon hatası' });
        continue;
      }

      if (activeCount + imported >= tenant.maxClients) {
        errors.push({ row: rowNum, message: 'Plan limiti aşıldı' });
        continue;
      }

      try {
        const [encPhone, encEmail] = await Promise.all([
          this.enc(tenantId, dto.phone?.trim() || null),
          this.enc(tenantId, dto.email?.trim() || null),
        ]);

        await this.prisma.client.create({
          data: {
            tenantId,
            firstName: (dto.firstName ?? '').trim(),
            lastName: (dto.lastName ?? '').trim(),
            phone: encPhone,
            email: encEmail,
            birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
            gender: dto.gender?.trim() || null,
            complaintAreas: dto.complaintAreas ?? [],
          },
        });
        imported++;
      } catch (e) {
        errors.push({
          row: rowNum,
          message: e instanceof Error ? e.message : 'Bilinmeyen hata',
        });
      }
    }

    return { imported, failed: errors.length, errors };
  }

  async anonymize(id: string, tenantId: string) {
    const existing = await this.prisma.client.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Danışan bulunamadı');
    }

    await this.prisma.client.update({
      where: { id },
      data: {
        firstName: 'ANONIM',
        lastName: 'ANONIM',
        phone: '0000',
        email: null,
        tcKimlik: null,
        anonymizedAt: new Date(),
      },
    });
    return { success: true };
  }

  /** Kriptografik imha: danışan DEK'ini silerek tüm şifreli verileri erişilemez kılar. */
  async cryptoShred(
    clientId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Danışan bulunamadı');
    }

    await (this.prisma.client as any).update({
      where: { id: clientId },
      data: {
        encryptedClientDek: null,
        clientDekNonce: null,
        anonymizedAt: new Date(),
      },
    });

    this.dekCache.invalidate(`client:${clientId}`);

    await this.auditLog.logAction({
      tenantId,
      userId,
      action: 'crypto_shred',
      resourceType: 'client',
      resourceId: clientId,
    });
  }
}
