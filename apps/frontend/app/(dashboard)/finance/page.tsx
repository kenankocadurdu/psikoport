"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { tr } from "date-fns/locale";
import {
  fetchPayments,
  fetchMonthSummary,
  updatePaymentStatus,
  type PaymentListItem,
} from "@/lib/api/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentStatusBadge } from "@/components/finance/PaymentStatusBadge";
import { PaymentCollectionDialog } from "@/components/finance/PaymentCollectionDialog";
import {
  TrendingUp,
  Wallet,
  Clock,
  XCircle,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

function formatCurrency(value: number): string {
  return `₺${value.toLocaleString("tr-TR")}`;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  card: "Kart",
  bank_transfer: "Havale/EFT",
  other: "Diğer",
};

export default function FinancePage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [dateStart, setDateStart] = React.useState(
    format(monthStart, "yyyy-MM-dd")
  );
  const [dateEnd, setDateEnd] = React.useState(format(monthEnd, "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = React.useState<string>(
    searchParams.get("status") ?? "all"
  );
  const [clientIdFilter, setClientIdFilter] = React.useState(
    searchParams.get("clientId") ?? ""
  );
  const [page, setPage] = React.useState(1);

  // PaymentCollectionDialog — URL'den paymentId okunur, dialog otomatik açılır
  const [collectPaymentId, setCollectPaymentId] = React.useState<string | null>(
    searchParams.get("paymentId") ?? null
  );
  const [collectOpen, setCollectOpen] = React.useState(!!searchParams.get("paymentId"));

  const { data: monthSummary, isLoading: loadingSummary } = useQuery({
    queryKey: ["finance", "month-summary"],
    queryFn: fetchMonthSummary,
  });

  const { data: paymentsData, isLoading: loadingPayments } = useQuery({
    queryKey: [
      "finance",
      "payments",
      dateStart,
      dateEnd,
      statusFilter,
      clientIdFilter,
      page,
    ],
    queryFn: () =>
      fetchPayments({
        start: `${dateStart}T00:00:00.000Z`,
        end: `${dateEnd}T23:59:59.999Z`,
        status:
          statusFilter !== "all"
            ? (statusFilter as "PENDING" | "PAID" | "PARTIAL" | "CANCELLED")
            : undefined,
        clientId: clientIdFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const updateStatus = useMutation({
    mutationFn: ({
      id,
      status,
      paidAmount,
    }: {
      id: string;
      status: "PAID" | "PENDING";
      paidAmount?: number;
    }) => updatePaymentStatus(id, status, paidAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Ödeme durumu güncellendi");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleQuickUnpaid = (payment: PaymentListItem) => {
    updateStatus.mutate({ id: payment.id, status: "PENDING" });
  };

  const payments = paymentsData?.items ?? [];
  const meta = paymentsData?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Gelir Takibi</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Seans ödemelerinizi yönetin ve gelir özetini görüntüleyin
        </p>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-4">Bu Ay Özet</h2>
        {loadingSummary ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <TrendingUp className="size-5 text-muted-foreground" />
                <CardTitle className="text-base font-medium">
                  Bu Ay Toplam
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatCurrency(monthSummary?.total ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <Wallet className="size-5 text-muted-foreground" />
                <CardTitle className="text-base font-medium">
                  Tahsil Edilen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(monthSummary?.collected ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <Clock className="size-5 text-muted-foreground" />
                <CardTitle className="text-base font-medium">
                  Bekleyen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(monthSummary?.pending ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <XCircle className="size-5 text-muted-foreground" />
                <CardTitle className="text-base font-medium">İptal</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-500">
                  {formatCurrency(monthSummary?.cancelled ?? 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-4">Ödeme Listesi</h2>

        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="w-[140px]"
          />
          <Input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="w-[140px]"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="PENDING">Bekliyor</SelectItem>
              <SelectItem value="PAID">Ödendi</SelectItem>
              <SelectItem value="PARTIAL">Kısmi</SelectItem>
              <SelectItem value="CANCELLED">İptal</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Danışan ID (opsiyonel)"
            value={clientIdFilter}
            onChange={(e) => {
              setClientIdFilter(e.target.value);
              setPage(1);
            }}
            className="w-[180px]"
          />
        </div>

        <Card>
          {loadingPayments ? (
            <CardContent className="py-12">
              <div className="flex justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          ) : payments.length === 0 ? (
            <CardContent className="py-12 text-center text-muted-foreground">
              Ödeme bulunamadı
            </CardContent>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Danışan</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Tutar</TableHead>
                    <TableHead>Ödeme Yöntemi</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Makbuz</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const baseAmount =
                      typeof p.amount === "string" ? parseFloat(p.amount) : Number(p.amount);
                    const paidAmt = p.paidAmount != null
                      ? typeof p.paidAmount === "string" ? parseFloat(p.paidAmount) : Number(p.paidAmount)
                      : null;
                    const displayAmount = (paidAmt != null && paidAmt > 0) ? paidAmt : baseAmount;
                    const clientName = `${p.client.firstName} ${p.client.lastName}`.trim() || "—";
                    const isUpdating = updateStatus.isPending;
                    const methodLabel = p.paymentMethod
                      ? (PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod)
                      : "—";

                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {clientName}
                        </TableCell>
                        <TableCell>
                          {format(new Date(p.sessionDate), "dd.MM.yyyy", { locale: tr })}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{formatCurrency(displayAmount)}</span>
                          {paidAmt != null && paidAmt > 0 && paidAmt !== baseAmount && baseAmount > 0 && (
                            <span className="ml-1 text-xs text-muted-foreground line-through">
                              {formatCurrency(baseAmount)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {methodLabel}
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={p.status as "PENDING" | "PAID" | "PARTIAL" | "CANCELLED"} />
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              p.invoiceStatus === "NOT_ISSUED" && p.status === "PAID"
                                ? "text-amber-600 dark:text-amber-400 text-xs"
                                : "text-muted-foreground text-xs"
                            }
                          >
                            {p.invoiceStatus === "ISSUED" ? "Kesildi" : "Kesilmedi"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.status === "PENDING" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => { setCollectPaymentId(p.id); setCollectOpen(true); }}
                            >
                              <Check className="size-3" />
                              Tahsil Et
                            </Button>
                          )}
                          {p.status === "PAID" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 text-muted-foreground"
                              disabled={isUpdating}
                              onClick={() => handleQuickUnpaid(p)}
                            >
                              <X className="size-3" />
                              Geri al
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-2">
                  <p className="text-sm text-muted-foreground">
                    {meta.total} kayıt
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Önceki
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= meta.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Sonraki
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </section>

      <PaymentCollectionDialog
        paymentId={collectPaymentId}
        open={collectOpen}
        onOpenChange={(o) => {
          setCollectOpen(o);
          if (!o) setCollectPaymentId(null);
        }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["finance"] })}
      />
    </div>
  );
}
