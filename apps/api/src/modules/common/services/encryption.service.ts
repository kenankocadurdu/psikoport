import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { DekCacheService } from './dek-cache.service';

const GCM_NONCE_LENGTH = 12;
const GCM_TAG_LENGTH = 16;
const DEK_LENGTH = 32;

@Injectable()
export class EncryptionService {
  private readonly kek: Buffer;

  constructor(
    private readonly dekCache: DekCacheService,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<string>('ENCRYPTION_KEY');
    if (!raw) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    // Accept 64-char hex (32 bytes) or base64 (44 chars → 32 bytes)
    this.kek = raw.length === 64 ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (this.kek.length !== DEK_LENGTH) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (64-char hex or base64)');
    }
  }

  /**
   * Returns the per-tenant DEK.
   * Cache hit  → immediate return (no crypto work).
   * Cache miss → derive deterministic DEK via HKDF(KEK, tenantId), cache, return.
   *
   * Deterministic derivation means no DEK storage is needed at this stage.
   * When Crypto-Shredding (step 3.5) is added, per-client random DEKs stored
   * in the DB will replace this approach for client-level data.
   */
  async getOrResolveDek(tenantId: string): Promise<Buffer> {
    const cached = this.dekCache.get(tenantId);
    if (cached) return cached;

    // HKDF-SHA256: derive a 32-byte DEK from KEK + tenantId as info label
    const dek = await new Promise<Buffer>((resolve, reject) => {
      crypto.hkdf(
        'sha256',
        this.kek,
        Buffer.alloc(0),          // salt — empty; KEK already has sufficient entropy
        Buffer.from(tenantId),    // info — tenant identifier
        DEK_LENGTH,
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(Buffer.from(derivedKey));
        },
      );
    });

    this.dekCache.set(tenantId, dek);
    return dek;
  }

  async encrypt(
    tenantId: string,
    plaintext: string,
  ): Promise<{ ciphertext: Buffer; nonce: Buffer; authTag: Buffer }> {
    const dek = await this.getOrResolveDek(tenantId);
    const nonce = crypto.randomBytes(GCM_NONCE_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, nonce, {
      authTagLength: GCM_TAG_LENGTH,
    });
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(plaintext, 'utf8')),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return { ciphertext, nonce, authTag };
  }

  async decrypt(
    tenantId: string,
    ciphertext: Buffer,
    nonce: Buffer,
    authTag: Buffer,
  ): Promise<string> {
    const dek = await this.getOrResolveDek(tenantId);
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, nonce, {
      authTagLength: GCM_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }
}
