/**
 * Seans notu types — CSE-001, MASTER_README Section 5.3
 * encrypted_content sunucu tarafında BYTEA olarak saklanır, API'de base64 string ile taşınır.
 */

export interface EncryptedNotePayload {
  /** Şifreli içerik — base64 encoded */
  encryptedContent: string;
  /** KEK ile sarılmış DEK — base64 */
  encryptedDek: string;
  contentNonce: string;
  contentAuthTag: string;
  dekNonce: string;
  dekAuthTag: string;
  sessionDate: string;
  tags?: string[];
  symptomCategories?: string[];
  moodRating?: number;
  durationMinutes?: number;
}

/** Meta-only response — şifreli içerik olmadan */
export interface NoteMetaResponse {
  id: string;
  clientId: string;
  sessionDate: string;
  sessionNumber: number;
  sessionType: string;
  tags?: string[];
  symptomCategories?: string[];
  moodRating?: number;
  durationMinutes?: number;
}

/** Tam response — şifreli alanlarla birlikte */
export interface NoteFullResponse extends NoteMetaResponse {
  encryptedContent: string;
  encryptedDek: string;
  contentNonce: string;
  contentAuthTag: string;
  dekNonce: string;
  dekAuthTag: string;
}
