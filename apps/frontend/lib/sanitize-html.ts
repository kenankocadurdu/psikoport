import DOMPurify from "dompurify";

/**
 * Sanitize HTML for safe rendering (XSS prevention).
 * Use for consent bodyHtml, user-generated rich text, etc.
 * Call from client components ("use client") — DOMPurify requires DOM.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
