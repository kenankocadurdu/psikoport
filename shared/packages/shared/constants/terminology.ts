/**
 * Terminoloji Kuralları — MASTER_README Section 2.5, TERM-001..TERM-004
 * UI, API, kod bazında yasaklı kelimeler ve onaylı karşılıkları.
 */

/** UI'da ASLA kullanılmayacak kelimeler */
export const BANNED_TERMS: readonly string[] = [
  'tedavi',
  'terapi',
  'klinik',
  'tele-sağlık',
  'telesağlık',
  'sağlık platformu',
  'mental sağlık',
  'mental sağlık uygulaması',
  'HIPAA',
  'video terapi',
  'klinik rapor',
] as const;

/** Yasaklı terim → Onaylı karşılık eşleşmesi */
export const APPROVED_ALTERNATIVES: Record<string, string> = {
  tedavi: 'danışmanlık',
  terapi: 'danışmanlık',
  klinik: 'danışmanlık merkezi',
  'tele-sağlık': 'online görüşme',
  telesağlık: 'online görüşme',
  'sağlık platformu': 'danışmanlık platformu',
  'mental sağlık': 'psikolojik destek',
  'mental sağlık uygulaması': 'danışmanlık uygulaması',
  HIPAA: 'KVKK',
  'video terapi': 'online görüşme',
  'klinik rapor': 'değerlendirme raporu',
};

/**
 * Verilen metinde yasaklı terim var mı kontrol eder.
 * Büyük/küçük harf duyarsız (case-insensitive).
 */
export function isBannedTerm(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_TERMS.some((term) => lower.includes(term.toLowerCase()));
}
