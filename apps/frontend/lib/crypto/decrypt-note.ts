/**
 * Seans notu şifre çözme — CSE-001, CSE-006
 * KEK ile DEK aç → içerik çöz → unmount'ta buffer temizle
 */

import { unwrapDEK, decryptContent } from "./envelope";

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export interface EncryptedBlocks {
  encryptedContent: string;
  encryptedDek: string;
  contentNonce: string;
  contentAuthTag: string;
  dekNonce: string;
  dekAuthTag: string;
}

/**
 * Şifreli blokları düz metne çözer.
 */
export async function decryptNoteContent(
  blocks: EncryptedBlocks,
  kek: CryptoKey
): Promise<string> {
  const ciphertext = base64ToUint8(blocks.encryptedContent);
  const nonce = base64ToUint8(blocks.contentNonce);
  const authTag = base64ToUint8(blocks.contentAuthTag);
  const encryptedDek = base64ToUint8(blocks.encryptedDek);
  const dekNonce = base64ToUint8(blocks.dekNonce);
  const dekAuthTag = base64ToUint8(blocks.dekAuthTag);

  const dek = await unwrapDEK(encryptedDek, dekNonce, dekAuthTag, kek);
  const plaintext = await decryptContent(ciphertext, nonce, authTag, dek);

  return plaintext;
}
