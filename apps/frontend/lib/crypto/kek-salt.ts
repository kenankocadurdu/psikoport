/**
 * KEK türetme için salt kaynağı.
 * Faz 1: NEXT_PUBLIC_KEK_SALT_B64 env'den okunur.
 * Faz 2: psy_key_store API'den GET /auth/key-salt ile alınacak.
 */

const SALT_LENGTH = 16;

/**
 * KEK türetme için 16-byte salt döndürür.
 * NEXT_PUBLIC_KEK_SALT_B64 base64-encoded olmalı.
 * Salt yoksa null döner.
 */
export function getKekSalt(): Uint8Array | null {
  if (typeof window === "undefined") return null;
  const b64 = process.env.NEXT_PUBLIC_KEK_SALT_B64;
  if (!b64) return null;
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytes.length !== SALT_LENGTH) return null;
    return bytes;
  } catch {
    return null;
  }
}
