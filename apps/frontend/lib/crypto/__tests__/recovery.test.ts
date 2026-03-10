import { describe, it, expect, vi } from "vitest";

vi.mock("../argon2", async () => {
  const actual = await vi.importActual<typeof import("../argon2")>("../argon2");
  return {
    ...actual,
    deriveKEK: vi.fn().mockImplementation(async (_password: string, _salt: Uint8Array, options?: { forBackup?: boolean }) => {
      const extractable = options?.forBackup ?? false;
      const hash = crypto.getRandomValues(new Uint8Array(32));
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
import {
  generateRecoveryPhrase,
  deriveRecoveryKey,
  backupKEK,
  recoverKEK,
} from "../recovery";
import { generateSalt } from "../argon2";
import { deriveKEK } from "../argon2";

describe("recovery", () => {
  it("generateRecoveryPhrase returns 12 words", () => {
    const phrase = generateRecoveryPhrase();
    expect(phrase).toHaveLength(12);
    expect(phrase.every((w) => typeof w === "string")).toBe(true);
  });

  it("generateRecoveryPhrase returns unique phrases", () => {
    const a = generateRecoveryPhrase();
    const b = generateRecoveryPhrase();
    expect(a.join(" ")).not.toBe(b.join(" "));
  });

  it("deriveRecoveryKey returns CryptoKey", async () => {
    const phrase = generateRecoveryPhrase();
    const salt = generateSalt();
    const key = await deriveRecoveryKey(phrase, salt);

    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.extractable).toBe(false);
    expect(key.usages).toContain("wrapKey");
    expect(key.usages).toContain("unwrapKey");
  });

  it("backupKEK and recoverKEK roundtrip", async () => {
    const phrase = generateRecoveryPhrase();
    const salt = generateSalt();
    const recoveryKey = await deriveRecoveryKey(phrase, salt);

    const kekSalt = generateSalt();
    const kek = await deriveKEK("password", kekSalt, { forBackup: true });

    const backup = await backupKEK(kek, recoveryKey);
    expect(backup).toBeInstanceOf(Uint8Array);
    expect(backup.length).toBeGreaterThan(0);

    const recovered = await recoverKEK(backup, recoveryKey);
    expect(recovered).toBeInstanceOf(CryptoKey);
  });
});
