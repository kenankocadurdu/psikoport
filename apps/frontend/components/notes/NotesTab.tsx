"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchNotes } from "@/lib/api/notes";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { CreateNoteDialog } from "./CreateNoteDialog";
import { NoteDetailDialog } from "./NoteDetailDialog";
import { KEKUnlockDialog } from "./KEKUnlockDialog";
import { getKEK } from "@/lib/crypto/key-store";

interface NotesTabProps {
  clientId: string;
  autoOpen?: boolean;
}

export function NotesTab({ clientId, autoOpen }: NotesTabProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailNoteId, setDetailNoteId] = React.useState<string | null>(null);
  const [unlockOpen, setUnlockOpen] = React.useState(false);
  const [needsRefresh, setNeedsRefresh] = React.useState(0);
  const [unlockRetryKey, setUnlockRetryKey] = React.useState(0);
  const autoOpenTriggered = React.useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["notes", clientId, needsRefresh],
    queryFn: () => fetchNotes(clientId),
    enabled: !!clientId,
  });

  React.useEffect(() => {
    if (autoOpen && !autoOpenTriggered.current) {
      autoOpenTriggered.current = true;
      handleOpenCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  const handleOpenDetail = (noteId: string) => {
    setDetailNoteId(noteId);
    if (!getKEK()) setUnlockOpen(true);
  };

  const handleOpenCreate = () => {
    setCreateOpen(true);
    if (!getKEK()) setUnlockOpen(true);
  };

  const handleUnlockSuccess = () => {
    setUnlockRetryKey((k) => k + 1);
  };

  const notes = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Seans Notları</h2>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="size-4" />
          Yeni Not
        </Button>
      </div>

      {!getKEK() && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          Notları görüntülemek veya oluşturmak için şifre çözme parolanızı girin.
          <Button
            variant="outline"
            size="sm"
            className="ml-3"
            onClick={() => setUnlockOpen(true)}
          >
            Kilidi Aç
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <FileText className="mx-auto size-12 opacity-50" />
          <p className="mt-2">Henüz seans notu yok.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={handleOpenCreate}
          >
            İlk notu ekle
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Seans</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>Etiketler</TableHead>
              <TableHead>Mood</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notes.map((n) => (
              <TableRow
                key={n.id}
                className="cursor-pointer"
                onClick={() => handleOpenDetail(n.id)}
              >
                <TableCell>
                  {format(new Date(n.sessionDate), "d MMM yyyy", { locale: tr })}
                </TableCell>
                <TableCell>
                  {n.sessionNumber != null ? `#${n.sessionNumber}` : "—"}
                </TableCell>
                <TableCell>{n.sessionType ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {n.tags?.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                    {n.tags && n.tags.length > 3 && (
                      <span className="text-muted-foreground text-xs">
                        +{n.tags.length - 3}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {n.moodRating != null ? `${n.moodRating}/10` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateNoteDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        clientId={clientId}
        onSuccess={() => {
          setNeedsRefresh((r) => r + 1);
          queryClient.invalidateQueries({ queryKey: ["notes", clientId] });
        }}
        onUnlockRequired={() => setUnlockOpen(true)}
      />

      <NoteDetailDialog
        open={!!detailNoteId}
        onOpenChange={(open) => !open && setDetailNoteId(null)}
        clientId={clientId}
        noteId={detailNoteId}
        onUnlockRequired={() => setUnlockOpen(true)}
        retryKey={unlockRetryKey}
      />

      <KEKUnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onSuccess={handleUnlockSuccess}
      />
    </div>
  );
}
