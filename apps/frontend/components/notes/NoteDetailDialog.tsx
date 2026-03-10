"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getKEK } from "@/lib/crypto/key-store";
import { decryptNoteContent } from "@/lib/crypto/decrypt-note";
import { fetchNote, type NoteDetail } from "@/lib/api/notes";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface NoteDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  noteId: string | null;
  onUnlockRequired: () => void;
  retryKey?: number;
}

export function NoteDetailDialog({
  open,
  onOpenChange,
  clientId,
  noteId,
  onUnlockRequired,
  retryKey = 0,
}: NoteDetailDialogProps) {
  const [note, setNote] = React.useState<NoteDetail | null>(null);
  const [plaintext, setPlaintext] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !clientId || !noteId) return;
    const kek = getKEK();
    if (!kek) {
      onUnlockRequired();
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlaintext(null);
    setNote(null);

    fetchNote(clientId, noteId)
      .then((n) => {
        if (cancelled) return;
        setNote(n);
        return decryptNoteContent(
          {
            encryptedContent: n.encryptedContent,
            encryptedDek: n.encryptedDek,
            contentNonce: n.contentNonce,
            contentAuthTag: n.contentAuthTag,
            dekNonce: n.dekNonce,
            dekAuthTag: n.dekAuthTag,
          },
          kek
        );
      })
      .then((text) => {
        if (!cancelled) setPlaintext(text ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Çözme hatası");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      setPlaintext(null);
    };
  }, [open, clientId, noteId, onUnlockRequired, retryKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {note
              ? `Seans Notu — ${format(new Date(note.sessionDate), "d MMMM yyyy", { locale: tr })}`
              : "Seans Notu"}
          </DialogTitle>
          <DialogDescription>
            {note && (
              <div className="flex flex-wrap gap-2 pt-2">
                {note.sessionNumber != null && (
                  <Badge variant="outline">#{note.sessionNumber}</Badge>
                )}
                {note.sessionType && (
                  <Badge variant="outline">{note.sessionType}</Badge>
                )}
                {note.moodRating != null && (
                  <Badge variant="secondary">Mood: {note.moodRating}/10</Badge>
                )}
                {note.tags?.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-[120px]">
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {error && (
            <p className="text-destructive py-4 text-sm">{error}</p>
          )}
          {plaintext != null && !loading && (
            <pre className="whitespace-pre-wrap rounded-md border p-4 text-sm">
              {plaintext}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
