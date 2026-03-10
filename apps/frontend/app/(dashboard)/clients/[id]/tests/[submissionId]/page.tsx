"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchFormSubmission } from "@/lib/api/form-submissions";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/charts/SeverityBadge";
import { ScoreRadarChart } from "@/components/charts/ScoreRadarChart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const SUBSCALE_LABELS: Record<string, string> = {
  depression: "Depresyon",
  anxiety: "Anksiyete",
  stress: "Stres",
};

function getFieldsFromSchema(schema: unknown): Array<{ id: string; label: string }> {
  if (!schema || typeof schema !== "object") return [];
  const s = schema as { sections?: Array<{ fields?: Array<{ id: string; label: string }> }> };
  const fields: Array<{ id: string; label: string }> = [];
  for (const sec of s.sections ?? []) {
    for (const f of sec.fields ?? []) {
      fields.push({ id: f.id, label: f.label ?? f.id });
    }
  }
  return fields;
}

function getResponseLabel(response: unknown, schema: unknown): string {
  if (response == null) return "—";
  const s = schema as { sections?: Array<{ fields?: Array<{ id: string; options?: Array<{ value: string; label: string }> }> }> } | null;
  if (!s?.sections) return String(response);
  for (const sec of s.sections) {
    for (const f of sec.fields ?? []) {
      const opt = f.options?.find((o) => o.value === String(response));
      if (opt) return opt.label;
    }
  }
  return String(response);
}

export default function TestSubmissionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const submissionId = params.submissionId as string;

  const { data: submission, isLoading, isError } = useQuery({
    queryKey: ["form-submission", submissionId],
    queryFn: () => fetchFormSubmission(submissionId),
    enabled: !!submissionId,
  });

  if (isLoading || !submission) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <Link href={`/clients/${id}/tests`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            Testlere dön
          </Button>
        </Link>
        <p className="text-destructive">Test sonucu bulunamadı.</p>
      </div>
    );
  }

  const schema = submission.formDefinition?.schema;
  const fields = getFieldsFromSchema(schema);
  const responses = (submission.responses ?? {}) as Record<string, unknown>;
  const subscales = submission.scores?.subscales ?? [];
  const totalScore = submission.scores?.totalScore;
  const riskFlags = submission.riskFlags ?? [];
  const date = submission.submittedAt ?? submission.createdAt;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/clients/${id}/tests`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">
            {submission.formDefinition?.title ?? "Test"}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
            <span>
              {date
                ? format(new Date(date), "d MMM yyyy, HH:mm", { locale: tr })
                : "—"}
            </span>
            {totalScore != null && (
              <span>Toplam skor: {totalScore}</span>
            )}
            <SeverityBadge
              level={submission.severityLevel}
              label={submission.scores?.severityLabel}
            />
          </div>
        </div>
      </div>

      {riskFlags.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <AlertTriangle className="size-5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-medium text-red-700 dark:text-red-300">
              Risk Uyarısı
            </p>
            <p className="text-red-600/90 dark:text-red-400/90 text-sm">
              {riskFlags.join(", ")}
            </p>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-4 text-lg font-medium">Alt Ölçek Skorları</h2>
        <ScoreRadarChart
          subscales={subscales}
          labels={SUBSCALE_LABELS}
          totalScore={totalScore}
          maxTotalScore={
            subscales.length === 0 && totalScore != null ? 27 : undefined
          }
        />
      </section>

      {fields.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-medium">Madde Bazlı Yanıtlar</h2>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Madde</TableHead>
                  <TableHead>Yanıt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.label}</TableCell>
                    <TableCell>
                      {getResponseLabel(responses[f.id], schema)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
