import { describe, it, expect } from "vitest";
import {
  generateDEK,
  encryptContent,
  decryptContent,
  wrapDEK,
  unwrapDEK,
} from "../envelope";

describe("envelope", () => {
  it("generateDEK returns 32 bytes", () => {
    const dek = generateDEK();
    expect(dek).toBeInstanceOf(Uint8Array);
    expect(dek.length).toBe(32);
  });

  it("generateDEK returns unique values", () => {
    const a = generateDEK();
    const b = generateDEK();
    expect(a).not.toEqual(b);
  });

  it("encryptContent and decryptContent roundtrip", async () => {
    const dekBytes = generateDEK();
    const dek = await crypto.subtle.importKey(
      "raw",
      dekBytes as BufferSource,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );

    const plaintext = "Gizli seans notu içeriği";
    const { ciphertext, nonce, authTag } = await encryptContent(plaintext, dek);

    expect(ciphertext).toBeInstanceOf(Uint8Array);
    expect(nonce.length).toBe(12);
    expect(authTag.length).toBe(16);

    const decrypted = await decryptContent(ciphertext, nonce, authTag, dek);
    expect(decrypted).toBe(plaintext);
  });

  it("wrapDEK and unwrapDEK roundtrip", async () => {
    const dekBytes = generateDEK();
    const dekBuffer = dekBytes.buffer.slice(
      dekBytes.byteOffset,
      dekBytes.byteOffset + dekBytes.byteLength
    ) as ArrayBuffer;
    const kek = await crypto.subtle.importKey(
      "raw",
      crypto.getRandomValues(new Uint8Array(32)) as BufferSource,
      { name: "AES-GCM" },
      false,
      ["wrapKey", "unwrapKey"]
    );

    const { encryptedDek, dekNonce, dekAuthTag } = await wrapDEK(dekBuffer, kek);

    expect(encryptedDek).toBeInstanceOf(Uint8Array);
    expect(dekNonce.length).toBe(12);
    expect(dekAuthTag.length).toBe(16);

    const unwrapped = await unwrapDEK(encryptedDek, dekNonce, dekAuthTag, kek);
    expect(unwrapped).toBeInstanceOf(CryptoKey);
    expect(unwrapped.type).toBe("secret");
  });
});
