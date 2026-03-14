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
import { fetchNote, type NoteDetail } from "@/lib/api/notes";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface NoteDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  noteId: string | null;
}

export function NoteDetailDialog({
  open,
  onOpenChange,
  clientId,
  noteId,
}: NoteDetailDialogProps) {
  const [note, setNote] = React.useState<NoteDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !clientId || !noteId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setNote(null);

    fetchNote(clientId, noteId)
      .then((n) => {
        if (!cancelled) setNote(n);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Yükleme hatası");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, clientId, noteId]);

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
          {note && !loading && (
            <pre className="whitespace-pre-wrap rounded-md border p-4 text-sm">
              {note.content}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
