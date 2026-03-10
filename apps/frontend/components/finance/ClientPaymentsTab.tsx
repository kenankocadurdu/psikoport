"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPayments, updatePaymentStatus, type PaymentListItem } from "@/lib/api/finance";
import { PaymentStatusBadge } from "@/components/finance/PaymentStatusBadge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ClientPaymentsTabProps {
  clientId: string;
}

function formatCurrency(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return `₺${n.toLocaleString("tr-TR")}`;
}

export function ClientPaymentsTab({ clientId }: ClientPaymentsTabProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["finance", "client-payments", clientId],
    queryFn: () => fetchPayments({ clientId, limit: 100 }),
    enabled: !!clientId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, paidAmount }: { id: string; status: "PAID" | "PENDING"; paidAmount?: number }) =>
      updatePaymentStatus(id, status, paidAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance", "client-payments", clientId] });
      queryClient.invalidateQueries({ queryKey: ["finance", "month-summary"] });
      toast.success("Ödeme durumu güncellendi");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const payments = data?.items ?? [];

  const pending = payments.filter((p) => p.status === "PENDING" || p.status === "PARTIAL");
  const paid = payments.filter((p) => p.status === "PAID");
  const cancelled = payments.filter((p) => p.status === "CANCELLED");

  const totalPending = pending.reduce((s, p) => s + (typeof p.amount === "string" ? parseFloat(p.amount) : p.amount), 0);
  const totalPaid = paid.reduce((s, p) => s + (p.paidAmount ? (typeof p.paidAmount === "string" ? parseFloat(p.paidAmount) : p.paidAmount) : 0), 0);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Özet */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-4">
          <p className="text-sm text-muted-foreground">Bekleyen Alacak</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatCurrency(totalPending)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{pending.length} seans</p>
        </div>
        <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 p-4">
          <p className="text-sm text-muted-foreground">Tahsil Edilen</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalPaid)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{paid.length} seans</p>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Henüz ödeme kaydı bulunmuyor. Randevuyu tamamladığınızda otomatik oluşur.
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <PaymentRow
              key={p.id}
              payment={p}
              isUpdating={updateStatus.isPending}
              onMarkPaid={() => {
                const amount = typeof p.amount === "string" ? parseFloat(p.amount) : p.amount;
                updateStatus.mutate({ id: p.id, status: "PAID", paidAmount: amount });
              }}
              onMarkUnpaid={() => updateStatus.mutate({ id: p.id, status: "PENDING" })}
            />
          ))}
          {cancelled.length > 0 && (
            <p className="text-xs text-muted-foreground pt-2">
              {cancelled.length} iptal edilmiş ödeme kayıtları gizlendi
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentRow({
  payment,
  isUpdating,
  onMarkPaid,
  onMarkUnpaid,
}: {
  payment: PaymentListItem;
  isUpdating: boolean;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
}) {
  const amount = typeof payment.amount === "string" ? parseFloat(payment.amount) : payment.amount;

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
      <div className="shrink-0 text-center w-12">
        <p className="text-xs text-muted-foreground">
          {format(new Date(payment.sessionDate), "MMM", { locale: tr })}
        </p>
        <p className="text-xl font-semibold leading-none">
          {format(new Date(payment.sessionDate), "d")}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(payment.sessionDate), "yyyy")}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{formatCurrency(amount)}</span>
          <PaymentStatusBadge status={payment.status} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {format(new Date(payment.sessionDate), "HH:mm", { locale: tr })} seansı
        </p>
      </div>
      <div className="shrink-0">
        {payment.status === "PENDING" && amount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={isUpdating}
            onClick={onMarkPaid}
          >
            <Check className="size-3" />
            Tahsil Et
          </Button>
        )}
        {payment.status === "PAID" && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-muted-foreground"
            disabled={isUpdating}
            onClick={onMarkUnpaid}
          >
            <X className="size-3" />
            Geri al
          </Button>
        )}
      </div>
    </div>
  );
}
