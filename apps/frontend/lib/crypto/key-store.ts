/**
 * In-memory KEK store — CSE-003, CSE-004, CSE-006
 * KEK yalnızca bellekte. ASLA localStorage/sessionStorage/IndexedDB.
 * ASLA console.log veya loglama.
 * clearKEK: referans null, buffer zero-fill
 */

let kekRef: CryptoKey | null = null;

/**
 * KEK'i bellekte saklar
 */
export function setKEK(kek: CryptoKey): void {
  kekRef = kek;
}

/**
 * Bellekteki KEK'i döndürür
 */
export function getKEK(): CryptoKey | null {
  return kekRef;
}

/**
 * CSE-006: Oturum kapanışında CryptoKey referansı null, buffer zero-fill
 * CryptoKey nesnesi zero-fill edilemez (WebCrypto güvenliği) — referans null yapılır
 */
export function clearKEK(): void {
  kekRef = null;
}

/**
 * KEK kilitli mi?
 */
export function isUnlocked(): boolean {
  return kekRef !== null;
}
