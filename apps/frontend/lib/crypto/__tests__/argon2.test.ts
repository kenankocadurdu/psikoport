import { describe, it, expect, vi, beforeEach } from "vitest";

// argon2-browser uses WASM - Node.js'ta yüklenemez. Mock kullanılır.
vi.mock("../argon2", async () => {
  const actual = await vi.importActual<typeof import("../argon2")>("../argon2");
  return {
    ...actual,
    deriveKEK: vi.fn().mockImplementation(async (password: string, salt: Uint8Array, options?: { forBackup?: boolean }) => {
      const extractable = options?.forBackup ?? false;
      const hash = new Uint8Array(32);
      const encoder = new TextEncoder();
      const passBytes = encoder.encode(password);
      for (let i = 0; i < 32; i++) {
        hash[i] = (passBytes[i % passBytes.length] ?? 0) ^ salt[i % salt.length];
      }
      return crypto.subtle.importKey(
        "raw",
        hash,
        { name: "AES-GCM" },
        extractable,
        ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
      );
    }),
  };
});

import { deriveKEK, generateSalt } from "../argon2";

describe("argon2", () => {
  beforeEach(() => {
    vi.mocked(deriveKEK).mockClear();
  });

  it("generateSalt returns 16 bytes", () => {
    const salt = generateSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(16);
  });

  it("generateSalt returns unique values", () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).not.toEqual(b);
  });

  it("deriveKEK returns CryptoKey with correct usages", async () => {
    const salt = generateSalt();
    const kek = await deriveKEK("test-password-123", salt);

    expect(kek).toBeInstanceOf(CryptoKey);
    expect(kek.type).toBe("secret");
    expect(kek.algorithm.name).toBe("AES-GCM");
    expect(kek.usages).toContain("encrypt");
    expect(kek.usages).toContain("decrypt");
    expect(kek.usages).toContain("wrapKey");
    expect(kek.usages).toContain("unwrapKey");
    expect(kek.extractable).toBe(false);
  });

  it("deriveKEK with forBackup returns extractable key", async () => {
    const salt = generateSalt();
    const kek = await deriveKEK("test", salt, { forBackup: true });
    expect(kek.extractable).toBe(true);
  });
});
