/**
 * BIP39 Recovery — CSE-006 ile uyumlu
 * Yedekleme ve kurtarma için mnemonic
 */

import { generateMnemonic } from "bip39";

const PBKDF2_ITERATIONS = 600_000;

// BIP39 Turkish wordlist standart pakette yok — İngilizce kullanılır
const WORDLIST: string[] | undefined = undefined;

/**
 * 128-bit entropy → 12 kelime mnemonic
 */
export function generateRecoveryPhrase(): string[] {
  const mnemonic = generateMnemonic(128, undefined, WORDLIST);
  return mnemonic.split(" ");
}

/**
 * Mnemonic + salt → PBKDF2-SHA512 → CryptoKey (extractable: false)
 */
export async function deriveRecoveryKey(
  phrase: string[],
  salt: Uint8Array
): Promise<CryptoKey> {
  const mnemonic = phrase.join(" ");
  const passBytes = new TextEncoder().encode(mnemonic);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passBytes,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const derived = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-512",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );

  return derived;
}

const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 128;

/**
 * KEK'i recovery key ile yedekler.
 * KEK extractable olmalı — deriveKEK(_, _, { forBackup: true }) ile türetilmeli
 */
export async function backupKEK(
  kek: CryptoKey,
  recoveryKey: CryptoKey
): Promise<Uint8Array> {
  const nonce = crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH));

  const wrapped = await crypto.subtle.wrapKey(
    "raw",
    kek,
    recoveryKey,
    {
      name: "AES-GCM",
      iv: nonce as BufferSource,
      tagLength: GCM_TAG_LENGTH,
    }
  );

  const wrappedBytes = new Uint8Array(wrapped);
  const tagLengthBytes = GCM_TAG_LENGTH / 8;
  const ciphertext = wrappedBytes.slice(0, -tagLengthBytes);
  const authTag = wrappedBytes.slice(-tagLengthBytes);

  const result = new Uint8Array(nonce.length + ciphertext.length + authTag.length);
  result.set(nonce, 0);
  result.set(ciphertext, nonce.length);
  result.set(authTag, nonce.length + ciphertext.length);

  return result;
}

/**
 * Yedekten KEK kurtarır
 */
export async function recoverKEK(
  encryptedBackup: Uint8Array,
  recoveryKey: CryptoKey
): Promise<CryptoKey> {
  const tagLengthBytes = GCM_TAG_LENGTH / 8;
  const nonce = encryptedBackup.slice(0, GCM_IV_LENGTH);
  const authTag = encryptedBackup.slice(-tagLengthBytes);
  const ciphertext = encryptedBackup.slice(
    GCM_IV_LENGTH,
    encryptedBackup.length - tagLengthBytes
  );

  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);

  return crypto.subtle.unwrapKey(
    "raw",
    combined,
    recoveryKey,
    {
      name: "AES-GCM",
      iv: nonce as BufferSource,
      tagLength: GCM_TAG_LENGTH,
    },
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}
