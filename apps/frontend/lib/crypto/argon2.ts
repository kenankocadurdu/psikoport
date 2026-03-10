/**
 * Argon2id KEK türetme — CSE-005 extractable: false
 * WebCrypto API kullanır. Node.js crypto KULLANMAZ.
 */

import argon2 from "argon2-browser";

const SALT_LENGTH = 16;
const MEMORY_KIB = 65536; // 64 MB
const ITERATIONS = 3;
const PARALLELISM = 1;
const HASH_LENGTH = 32;

/**
 * 16 byte rastgele salt
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Argon2id ile KEK türetir.
 * CSE-005: extractable: false (varsayılan)
 * forBackup: true — yalnızca backupKEK için, wrap sonrası ref atılır
 */
export async function deriveKEK(
  password: string,
  salt: Uint8Array,
  options?: { forBackup?: boolean }
): Promise<CryptoKey> {
  const result = await argon2.hash({
    pass: password,
    salt,
    time: ITERATIONS,
    mem: MEMORY_KIB,
    hashLen: HASH_LENGTH,
    parallelism: PARALLELISM,
    type: argon2.ArgonType.Argon2id,
  });

  const extractable = options?.forBackup ?? false;

  const hashCopy = new Uint8Array(result.hash);
  const key = await crypto.subtle.importKey(
    "raw",
    hashCopy,
    { name: "AES-GCM" },
    extractable,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );

  return key;
}
