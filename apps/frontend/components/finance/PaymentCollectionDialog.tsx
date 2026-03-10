"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchPayment, updatePaymentStatus } from "@/lib/api/finance";
import { PaymentStatusBadge } from "@/components/finance/PaymentStatusBadge";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

const PAYMENT_METHODS = [
  { value: "cash",          label: "Nakit" },
  { value: "card",          label: "Kredi / Banka Kartı" },
  { value: "bank_transfer", label: "Havale / EFT" },
  { value: "other",         label: "Diğer" },
];

interface PaymentCollectionDialogProps {
  paymentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PaymentCollectionDialog({
  paymentId,
  open,
  onOpenChange,
  onSuccess,
}: PaymentCollectionDialogProps) {
  const queryClient = useQueryClient();
  const [editedAmount, setEditedAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("cash");

  const { data: payment, isLoading } = useQuery({
    queryKey: ["finance", "payment-detail", paymentId],
    queryFn: () => fetchPayment(paymentId!),
    enabled: open && !!paymentId,
  });

  React.useEffect(() => {
    if (payment) {
      const amt = typeof payment.amount === "string" ? payment.amount : String(payment.amount);
      setEditedAmount(parseFloat(amt).toFixed(2));
    }
  }, [payment?.id]);

  const collectMutation = useMutation({
    mutationFn: () =>
      updatePaymentStatus(paymentId!, "PAID", parseFloat(editedAmount) || 0, paymentMethod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Ödeme tahsil edildi.");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleClose = () => {
    setEditedAmount("");
    setPaymentMethod("cash");
    onOpenChange(false);
  };

  const parsedAmount = parseFloat(editedAmount) || 0;
  const originalAmount = payment
    ? typeof payment.amount === "string"
      ? parseFloat(payment.amount)
      : Number(payment.amount)
    : 0;
  const isDiscounted = parsedAmount < originalAmount && parsedAmount > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5" />
            Ödeme Tahsil Et
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {payment && (
          <div className="space-y-4">
            {/* Seans bilgisi */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Danışan</span>
                <span className="font-medium">
                  {payment.client.firstName} {payment.client.lastName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Seans tarihi</span>
                <span>{format(new Date(payment.sessionDate), "dd.MM.yyyy HH:mm", { locale: tr })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Durum</span>
                <PaymentStatusBadge status={payment.status} />
              </div>
            </div>

            {payment.status === "PAID" ? (
              <p className="text-center text-sm text-emerald-600 dark:text-emerald-400 py-2">
                Bu ödeme tahsil edildi.
              </p>
            ) : (
              <>
                {/* Tutar */}
                <div className="space-y-1.5">
                  <Label htmlFor="amount">
                    Tahsil edilecek tutar (₺)
                    {isDiscounted && (
                      <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                        — İndirimli (standart: ₺{originalAmount.toLocaleString("tr-TR")})
                      </span>
                    )}
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editedAmount}
                    onChange={(e) => setEditedAmount(e.target.value)}
                    className="text-lg font-semibold"
                  />
                </div>

                {/* Ödeme yöntemi */}
                <div className="space-y-1.5">
                  <Label htmlFor="method">Ödeme yöntemi</Label>
                  <select
                    id="method"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    E-fatura entegrasyonunda kullanılacak.
                  </p>
                </div>
              </>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>
                {payment.status === "PAID" ? "Kapat" : "İptal"}
              </Button>
              {payment.status !== "PAID" && (
                <Button
                  onClick={() => collectMutation.mutate()}
                  disabled={collectMutation.isPending || parsedAmount <= 0}
                >
                  {collectMutation.isPending && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Tahsil Et
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
