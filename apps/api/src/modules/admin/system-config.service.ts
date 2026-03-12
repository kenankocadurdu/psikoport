import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export const SYSTEM_CONFIG_KEYS = {
  USE_AUTH0: 'useAuth0',
} as const;

const DEFAULT_VALUES: Record<string, string> = {
  [SYSTEM_CONFIG_KEYS.USE_AUTH0]: 'false',
};

@Injectable()
export class SystemConfigService {
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private readonly TTL_MS = 60_000; // 1 dakika cache

  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<string> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const row = await this.prisma.systemConfig.findUnique({ where: { key } });
      const value = row?.value ?? DEFAULT_VALUES[key] ?? '';
      this.cache.set(key, { value, expiresAt: Date.now() + this.TTL_MS });
      return value;
    } catch {
      // Tablo henüz migrate edilmemişse default değeri döndür
      return DEFAULT_VALUES[key] ?? '';
    }
  }

  async getBoolean(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val === 'true';
  }

  async set(key: string, value: string, updatedBy?: string): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value, updatedBy },
      create: { key, value, updatedBy },
    });
    this.cache.set(key, { value, expiresAt: Date.now() + this.TTL_MS });
  }

  async getAll(): Promise<Record<string, string>> {
    try {
      const rows = await this.prisma.systemConfig.findMany();
      const result: Record<string, string> = { ...DEFAULT_VALUES };
      for (const row of rows) {
        result[row.key] = row.value;
      }
      for (const [key, value] of Object.entries(result)) {
        this.cache.set(key, { value, expiresAt: Date.now() + this.TTL_MS });
      }
      return result;
    } catch {
      return { ...DEFAULT_VALUES };
    }
  }
}
