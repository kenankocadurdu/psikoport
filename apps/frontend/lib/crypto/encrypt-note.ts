/**
 * Seans notu şifreleme akışı — CSE-001
 * DEK üret → içeriği şifrele → DEK'i KEK ile sarmala
 */

import {
  generateDEK,
  encryptContent,
  wrapDEK,
} from "./envelope";

export interface EncryptedNotePayload {
  encryptedContent: string;
  encryptedDek: string;
  contentNonce: string;
  contentAuthTag: string;
  dekNonce: string;
  dekAuthTag: string;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin);
}

/**
 * Plaintext notu şifreleyip API payload'a dönüştürür.
 * KEK key-store'da olmalı.
 */
export async function encryptNoteContent(
  plaintext: string,
  kek: CryptoKey
): Promise<EncryptedNotePayload> {
  const rawDek = generateDEK();
  const dekKey = await crypto.subtle.importKey(
    "raw",
    rawDek as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

  const { ciphertext, nonce, authTag } = await encryptContent(plaintext, dekKey);

  const dekBuffer: ArrayBuffer =
    rawDek.byteOffset === 0 && rawDek.byteLength === rawDek.buffer.byteLength
      ? rawDek.buffer as ArrayBuffer
      : rawDek.buffer.slice(rawDek.byteOffset, rawDek.byteOffset + rawDek.byteLength) as ArrayBuffer;

  const { encryptedDek, dekNonce, dekAuthTag } = await wrapDEK(dekBuffer, kek);

  return {
    encryptedContent: uint8ToBase64(ciphertext),
    encryptedDek: uint8ToBase64(encryptedDek),
    contentNonce: uint8ToBase64(nonce),
    contentAuthTag: uint8ToBase64(authTag),
    dekNonce: uint8ToBase64(dekNonce),
    dekAuthTag: uint8ToBase64(dekAuthTag),
  };
}
