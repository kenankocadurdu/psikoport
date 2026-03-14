"use client";

import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchTimeline, type TimelineEntry } from "@/lib/api/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ClipboardList, Calendar } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { NoteDetailDialog } from "@/components/notes/NoteDetailDialog";

interface ConsultationTimelineProps {
  clientId: string;
}

const LIMIT = 20;

function EntryIcon({ type }: { type: TimelineEntry["type"] }) {
  switch (type) {
    case "note":
      return <FileText className="size-4 text-muted-foreground" />;
    case "test":
      return <ClipboardList className="size-4 text-muted-foreground" />;
    case "appointment":
      return <Calendar className="size-4 text-muted-foreground" />;
  }
}

function EntryMeta({ entry }: { entry: TimelineEntry }) {
  if (entry.type === "note") {
    const meta = entry.meta as { moodRating?: number; sessionType?: string; tags?: string[] };
    return (
      <div className="flex flex-wrap gap-1">
        {meta.moodRating != null && (
          <Badge variant="secondary" className="text-xs">
            Mood: {meta.moodRating}/10
          </Badge>
        )}
        {meta.sessionType && (
          <Badge variant="outline" className="text-xs">
            {meta.sessionType}
          </Badge>
        )}
      </div>
    );
  }
  if (entry.type === "test") {
    const meta = entry.meta as { score?: number; formName?: string };
    if (meta.score != null) {
      return (
        <Badge variant="secondary" className="text-xs">
          Puan: {meta.score}
        </Badge>
      );
    }
  }
  if (entry.type === "appointment") {
    const meta = entry.meta as { status?: string };
    if (meta.status) {
      return (
        <Badge variant="outline" className="text-xs">
          {meta.status}
        </Badge>
      );
    }
  }
  return null;
}

export function ConsultationTimeline({ clientId }: ConsultationTimelineProps) {
  const [detailNoteId, setDetailNoteId] = React.useState<string | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["timeline", clientId],
    queryFn: ({ pageParam }) =>
      fetchTimeline(clientId, { page: pageParam, limit: LIMIT }),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.meta;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!clientId,
  });

  const entries = React.useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data]
  );

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        <p>Henüz kayıt yok.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="border-border absolute left-[11px] top-2 bottom-2 w-px bg-border" />
        <ul className="space-y-0">
          {entries.map((entry) => (
            <li key={`${entry.type}-${entry.id}`} className="relative flex gap-4 pb-6 last:pb-0">
              <div className="bg-background border-border relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border">
                <EntryIcon type={entry.type} />
              </div>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => entry.type === "note" && setDetailNoteId(entry.id)}
                  className={`w-full text-left ${entry.type === "note" ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground text-xs">
                      {format(new Date(entry.date), "d MMM yyyy", { locale: tr })}
                    </span>
                    <span className="font-medium">{entry.title}</span>
                  </div>
                  <EntryMeta entry={entry} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Yükleniyor..." : "Daha fazla yükle"}
          </Button>
        </div>
      )}

      <NoteDetailDialog
        open={!!detailNoteId}
        onOpenChange={(open) => !open && setDetailNoteId(null)}
        clientId={clientId}
        noteId={detailNoteId}
      />
    </div>
  );
}
