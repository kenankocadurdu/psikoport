import { Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';

/**
 * In-process LRU cache for resolved Data Encryption Keys (DEKs).
 *
 * Keys are resolved once from KMS/envelope, then stored in RAM so that
 * subsequent encrypt/decrypt calls skip the KMS round-trip entirely.
 *
 * Capacity  : 500 tenants (covers typical SaaS scale at launch)
 * TTL       : 5 minutes (balance between performance and key-rotation freshness)
 * Storage   : process memory only — never persisted, never sent over the network
 */
@Injectable()
export class DekCacheService {
  private readonly cache: LRUCache<string, Buffer>;
  private hits = 0;
  private misses = 0;

  constructor() {
    this.cache = new LRUCache<string, Buffer>({
      max: 500,
      ttl: 5 * 60 * 1000,
    });
  }

  get(tenantId: string): Buffer | undefined {
    const value = this.cache.get(tenantId);
    if (value !== undefined) {
      this.hits++;
    } else {
      this.misses++;
    }
    return value;
  }

  getHitRatio(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  set(tenantId: string, dek: Buffer): void {
    this.cache.set(tenantId, dek);
  }

  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  clear(): void {
    this.cache.clear();
  }
}
