"use client";

import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 2000;
const STORAGE_KEY_PREFIX = "psikoport-form-draft-";

export interface AutoSaveOptions {
  token: string;
  responses: Record<string, unknown>;
  onSave: (responses: Record<string, unknown>) => Promise<void>;
  enabled?: boolean;
}

export function useAutoSave(options: AutoSaveOptions) {
  const { token, responses, onSave, enabled = true } = options;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevResponsesRef = useRef<string>("");
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (Object.keys(responses).length === 0) return;
    const respStr = JSON.stringify(responses);
    if (respStr === prevResponsesRef.current) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        await onSave(responses);
        prevResponsesRef.current = respStr;
        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEY_PREFIX + token);
        }
      } catch {
        if (typeof window !== "undefined") {
          localStorage.setItem(
            STORAGE_KEY_PREFIX + token,
            JSON.stringify({ responses, ts: Date.now() })
          );
        }
      } finally {
        timeoutRef.current = null;
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [token, responses, onSave, enabled]);
}

export function loadPendingDraft(token: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY_PREFIX + token);
  if (!raw) return null;
  try {
    const { responses } = JSON.parse(raw);
    return typeof responses === "object" ? responses : null;
  } catch {
    return null;
  }
}
