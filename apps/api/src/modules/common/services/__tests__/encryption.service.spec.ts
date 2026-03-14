import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { EncryptionService } from '../encryption.service';
import { DekCacheService } from '../dek-cache.service';
import { PrismaService } from '../../../../database/prisma.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Valid 32-byte KEK expressed as 64 lowercase hex chars
const KEK_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Fixed per-tenant DEK injected via cache mock (avoids real HKDF in most tests)
const FIXED_DEK = crypto.randomBytes(32);

const TENANT_ID = 'tenant-enc-1';

function makeDekCache(fixedDek: Buffer | null = FIXED_DEK) {
  return {
    get: jest.fn().mockReturnValue(fixedDek),
    set: jest.fn(),
    invalidate: jest.fn(),
  };
}

function makeConfig(key: string | undefined = KEK_HEX) {
  return { get: jest.fn().mockReturnValue(key) };
}

function makePrisma() {
  return { client: { findFirst: jest.fn(), update: jest.fn() } };
}

async function buildService(
  dekCache = makeDekCache(),
  config = makeConfig(),
  prisma = makePrisma(),
): Promise<EncryptionService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EncryptionService,
      { provide: DekCacheService, useValue: dekCache },
      { provide: ConfigService, useValue: config },
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get<EncryptionService>(EncryptionService);
}

// ─────────────────────────────────────────────────────────────────────────────
// 11.1 encrypt() / decrypt()
// ─────────────────────────────────────────────────────────────────────────────

describe('EncryptionService – 11.1 encrypt() / decrypt()', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    service = await buildService();
  });

  // ── Constructor validation ────────────────────────────────────────────────

  describe('constructor', () => {
    it('throws when ENCRYPTION_KEY is not set', async () => {
      const noKeyConfig = { get: jest.fn().mockReturnValue(undefined) };
      await expect(buildService(makeDekCache(), noKeyConfig)).rejects.toThrow(
        'ENCRYPTION_KEY environment variable is required',
      );
    });

    it('throws when ENCRYPTION_KEY results in wrong byte length', async () => {
      // 62-char hex → 31 bytes → invalid
      await expect(buildService(makeDekCache(), makeConfig('ab'.repeat(31)))).rejects.toThrow(
        'ENCRYPTION_KEY must be 32 bytes',
      );
    });

    it('accepts a 64-char hex key', async () => {
      await expect(buildService(makeDekCache(), makeConfig(KEK_HEX))).resolves.toBeDefined();
    });

    it('accepts a 44-char base64 key (32 bytes)', async () => {
      const b64key = Buffer.alloc(32, 0xab).toString('base64'); // 44 chars
      await expect(buildService(makeDekCache(), makeConfig(b64key))).resolves.toBeDefined();
    });
  });

  // ── encrypt() — output shape ──────────────────────────────────────────────

  describe('encrypt()', () => {
    it('returns an object with ciphertext, nonce, and authTag Buffers', async () => {
      const result = await service.encrypt(TENANT_ID, 'hello');
      expect(Buffer.isBuffer(result.ciphertext)).toBe(true);
      expect(Buffer.isBuffer(result.nonce)).toBe(true);
      expect(Buffer.isBuffer(result.authTag)).toBe(true);
    });

    it('nonce is 12 bytes (GCM_NONCE_LENGTH)', async () => {
      const { nonce } = await service.encrypt(TENANT_ID, 'hello');
      expect(nonce.length).toBe(12);
    });

    it('authTag is 16 bytes (GCM_TAG_LENGTH)', async () => {
      const { authTag } = await service.encrypt(TENANT_ID, 'hello');
      expect(authTag.length).toBe(16);
    });

    it('ciphertext length equals plaintext byte length (AES-GCM — no padding)', async () => {
      const plaintext = 'Seans notu içeriği';
      const { ciphertext } = await service.encrypt(TENANT_ID, plaintext);
      expect(ciphertext.length).toBe(Buffer.byteLength(plaintext, 'utf8'));
    });
  });

  // ── Randomness ────────────────────────────────────────────────────────────

  describe('randomness', () => {
    it('two encrypt calls of the same plaintext produce different nonces', async () => {
      const { nonce: n1 } = await service.encrypt(TENANT_ID, 'same text');
      const { nonce: n2 } = await service.encrypt(TENANT_ID, 'same text');
      expect(n1.equals(n2)).toBe(false);
    });

    it('two encrypt calls of the same plaintext produce different ciphertexts', async () => {
      const { ciphertext: c1 } = await service.encrypt(TENANT_ID, 'same text');
      const { ciphertext: c2 } = await service.encrypt(TENANT_ID, 'same text');
      expect(c1.equals(c2)).toBe(false);
    });
  });

  // ── Roundtrip correctness ─────────────────────────────────────────────────

  describe('encrypt → decrypt roundtrip', () => {
    async function roundtrip(plaintext: string): Promise<string> {
      const { ciphertext, nonce, authTag } = await service.encrypt(TENANT_ID, plaintext);
      return service.decrypt(TENANT_ID, ciphertext, nonce, authTag);
    }

    it('recovers original ASCII plaintext', async () => {
      expect(await roundtrip('Hello, World!')).toBe('Hello, World!');
    });

    it('recovers empty string', async () => {
      expect(await roundtrip('')).toBe('');
    });

    it('recovers multi-byte UTF-8 content (Turkish, emoji)', async () => {
      const text = 'Seans notu: danışan iyileşiyor 🎉';
      expect(await roundtrip(text)).toBe(text);
    });

    it('recovers long content (multi-block)', async () => {
      const text = 'x'.repeat(10_000);
      expect(await roundtrip(text)).toBe(text);
    });

    it('recovers content with newlines and special chars', async () => {
      const text = 'Satır 1\nSatır 2\tSekme\r\nWindows satırı';
      expect(await roundtrip(text)).toBe(text);
    });
  });

  // ── Tamper detection ──────────────────────────────────────────────────────

  describe('tamper detection', () => {
    it('decrypt throws when authTag is modified', async () => {
      const { ciphertext, nonce, authTag } = await service.encrypt(TENANT_ID, 'secret');
      const tampered = Buffer.from(authTag);
      tampered[0] ^= 0xff; // flip bits
      await expect(service.decrypt(TENANT_ID, ciphertext, nonce, tampered)).rejects.toThrow();
    });

    it('decrypt throws when ciphertext is modified', async () => {
      const { ciphertext, nonce, authTag } = await service.encrypt(TENANT_ID, 'secret');
      const tampered = Buffer.from(ciphertext);
      tampered[0] ^= 0xff;
      await expect(service.decrypt(TENANT_ID, tampered, nonce, authTag)).rejects.toThrow();
    });

    it('decrypt throws when nonce is modified', async () => {
      const { ciphertext, nonce, authTag } = await service.encrypt(TENANT_ID, 'secret');
      const tampered = Buffer.from(nonce);
      tampered[0] ^= 0xff;
      await expect(service.decrypt(TENANT_ID, ciphertext, tampered, authTag)).rejects.toThrow();
    });
  });

  // ── DEK resolution via cache ──────────────────────────────────────────────

  describe('DEK resolution', () => {
    it('encrypt calls dekCache.get with tenantId (cache lookup)', async () => {
      const dekCache = makeDekCache();
      const svc = await buildService(dekCache);
      await svc.encrypt(TENANT_ID, 'text');
      expect(dekCache.get).toHaveBeenCalledWith(TENANT_ID);
    });

    it('decrypt calls dekCache.get with tenantId (cache lookup)', async () => {
      const dekCache = makeDekCache();
      const svc = await buildService(dekCache);
      const { ciphertext, nonce, authTag } = await svc.encrypt(TENANT_ID, 'text');
      dekCache.get.mockClear();
      await svc.decrypt(TENANT_ID, ciphertext, nonce, authTag);
      expect(dekCache.get).toHaveBeenCalledWith(TENANT_ID);
    });

    it('on cache miss, derives DEK via HKDF and stores it in cache', async () => {
      // Return null first (miss), then let HKDF run, set is called
      const dekCache = makeDekCache(null); // always miss
      const svc = await buildService(dekCache);
      await svc.encrypt(TENANT_ID, 'text');
      expect(dekCache.set).toHaveBeenCalledWith(TENANT_ID, expect.any(Buffer));
    });

    it('HKDF-derived DEK is 32 bytes', async () => {
      const dekCache = makeDekCache(null);
      const svc = await buildService(dekCache);
      await svc.encrypt(TENANT_ID, 'text');
      const [, dek] = dekCache.set.mock.calls[0] as [string, Buffer];
      expect(dek.length).toBe(32);
    });

    it('same tenantId produces same HKDF-derived DEK (deterministic)', async () => {
      // Two services, both with cache miss — should derive identical DEKs
      const dc1 = makeDekCache(null);
      const dc2 = makeDekCache(null);
      const svc1 = await buildService(dc1, makeConfig(KEK_HEX));
      const svc2 = await buildService(dc2, makeConfig(KEK_HEX));

      await svc1.encrypt(TENANT_ID, 'a');
      await svc2.encrypt(TENANT_ID, 'a');

      const [, dek1] = dc1.set.mock.calls[0] as [string, Buffer];
      const [, dek2] = dc2.set.mock.calls[0] as [string, Buffer];
      expect(dek1.equals(dek2)).toBe(true);
    });

    it('different tenantIds produce different DEKs', async () => {
      const dc = makeDekCache(null);
      const svc = await buildService(dc);

      await svc.encrypt('tenant-A', 'a');
      await svc.encrypt('tenant-B', 'b');

      const dek1 = (dc.set.mock.calls[0] as [string, Buffer])[1];
      const dek2 = (dc.set.mock.calls[1] as [string, Buffer])[1];
      expect(dek1.equals(dek2)).toBe(false);
    });
  });
});
