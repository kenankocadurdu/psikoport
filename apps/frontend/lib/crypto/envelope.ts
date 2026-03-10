/**
 * Envelope Encryption — CSE-001, CSE-005
 * DEK: Data Encryption Key (nota şifreler)
 * KEK: Key Encryption Key (DEK'i şifreler)
 * extractable: false ZORUNLU
 */

const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 128;
const DEK_LENGTH = 32;

export interface EncryptedContent {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  authTag: Uint8Array;
}

export interface WrappedDEK {
  encryptedDek: Uint8Array;
  dekNonce: Uint8Array;
  dekAuthTag: Uint8Array;
}

/**
 * 256-bit DEK üretir (CSE-005: raw bytes, extractable only for wrap)
 */
export function generateDEK(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(DEK_LENGTH));
}

/**
 * AES-256-GCM ile içerik şifreleme
 */
export async function encryptContent(
  plaintext: string,
  dek: CryptoKey
): Promise<EncryptedContent> {
  const nonce = crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce as BufferSource,
      tagLength: GCM_TAG_LENGTH,
    },
    dek,
    encoded
  );

  const ct = new Uint8Array(ciphertext);
  const tagLengthBytes = GCM_TAG_LENGTH / 8;
  const authTag = ct.slice(-tagLengthBytes);
  const ciphertextOnly = ct.slice(0, -tagLengthBytes);

  return { ciphertext: ciphertextOnly, nonce, authTag };
}

/**
 * AES-256-GCM ile içerik çözme
 */
export async function decryptContent(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  authTag: Uint8Array,
  dek: CryptoKey
): Promise<string> {
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: nonce as BufferSource,
      tagLength: GCM_TAG_LENGTH,
    },
    dek,
    combined
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * DEK raw bytes → CryptoKey
 * wrapKey için extractable: true gerekli (CSE-005 wrap anında, sonuç şifreli)
 */
async function rawDEKToKeyForWrap(rawDek: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    rawDek,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * KEK ile DEK'i sarmalar (wrap)
 * DEK önce CryptoKey'e çevrilir, sonra wrapKey ile şifrelenir.
 */
export async function wrapDEK(
  dek: ArrayBuffer,
  kek: CryptoKey
): Promise<WrappedDEK> {
  const dekKey = await rawDEKToKeyForWrap(dek);
  const nonce = crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH));

  const wrapped = await crypto.subtle.wrapKey(
    "raw",
    dekKey,
    kek,
    {
      name: "AES-GCM",
      iv: nonce as BufferSource,
      tagLength: GCM_TAG_LENGTH,
    }
  );

  const wrappedBytes = new Uint8Array(wrapped);
  const tagLengthBytes = GCM_TAG_LENGTH / 8;
  const dekAuthTag = wrappedBytes.slice(-tagLengthBytes);
  const encryptedDek = wrappedBytes.slice(0, -tagLengthBytes);

  return {
    encryptedDek,
    dekNonce: nonce,
    dekAuthTag,
  };
}

/**
 * KEK ile DEK'i açar (unwrap)
 */
export async function unwrapDEK(
  encryptedDek: Uint8Array,
  dekNonce: Uint8Array,
  dekAuthTag: Uint8Array,
  kek: CryptoKey
): Promise<CryptoKey> {
  const combined = new Uint8Array(encryptedDek.length + dekAuthTag.length);
  combined.set(encryptedDek);
  combined.set(dekAuthTag, encryptedDek.length);

  return crypto.subtle.unwrapKey(
    "raw",
    combined,
    kek,
    {
      name: "AES-GCM",
      iv: dekNonce as BufferSource,
      tagLength: GCM_TAG_LENGTH,
    },
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}
