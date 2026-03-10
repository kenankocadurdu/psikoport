"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import {
  fetchFormSubmissionsByClient,
  type FormSubmissionListItem,
} from "@/lib/api/form-submissions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeverityBadge } from "@/components/charts/SeverityBadge";
import { SendTestDialog } from "./SendTestDialog";
import { GuideTooltip } from "@/components/onboarding/GuideTooltip";
import { Plus, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface TestsTabProps {
  clientId: string;
}

function getTotalScore(item: FormSubmissionListItem): number | null {
  const s = item.scores?.totalScore;
  return s != null ? s : null;
}

export function TestsTab({ clientId }: TestsTabProps) {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id ?? clientId) as string;
  const [sendOpen, setSendOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["form-submissions", clientId],
    queryFn: () => fetchFormSubmissionsByClient(clientId),
    enabled: !!clientId,
  });

  const list = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Testler</h2>
        <GuideTooltip
          id="tests_send"
          content="Danışana psikometrik test linki göndermek için bu butonu kullanın."
        >
          <Button size="sm" onClick={() => setSendOpen(true)}>
            <Plus className="size-4" />
            Yeni Test Gönder
          </Button>
        </GuideTooltip>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <ClipboardList className="mx-auto size-12 opacity-50" />
          <p className="mt-2">Henüz test gönderilmemiş.</p>
          <GuideTooltip
            id="tests_send_empty"
            content="Danışana psikometrik test linki göndermek için bu butonu kullanın."
          >
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setSendOpen(true)}
            >
              Yeni Test Gönder
            </Button>
          </GuideTooltip>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Test</TableHead>
              <TableHead>Tarih</TableHead>
              <TableHead>Skor</TableHead>
              <TableHead>Seviye</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((item) => {
              const total = getTotalScore(item);
              const date = item.submittedAt ?? item.createdAt;
              return (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/clients/${id}/tests/${item.id}`)}
                >
                  <TableCell className="font-medium">
                    {item.formDefinition.title}
                  </TableCell>
                  <TableCell>
                    {date
                      ? format(new Date(date), "d MMM yyyy", { locale: tr })
                      : "—"}
                  </TableCell>
                  <TableCell>{total != null ? total : "—"}</TableCell>
                  <TableCell>
                    <SeverityBadge
                      level={item.severityLevel}
                      label={item.scores?.severityLabel}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <SendTestDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        clientId={clientId}
      />
    </div>
  );
}
