"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchAppointment,
  cancelAppointment,
  completeAppointment,
  noShowAppointment,
} from "@/lib/api/appointments";
import { fetchPayments } from "@/lib/api/finance";
import { PaymentStatusBadge } from "@/components/finance/PaymentStatusBadge";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Video, Mail, Phone, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Bekliyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
  NO_SHOW: "Gelmedi",
};

const STATUS_VARIANT: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  SCHEDULED: "secondary",
  COMPLETED: "default",
  CANCELLED: "destructive",
  NO_SHOW: "outline",
};

interface AppointmentDetailDialogProps {
  appointmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppointmentDetailDialog({
  appointmentId,
  open,
  onOpenChange,
}: AppointmentDetailDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCancelForm, setShowCancelForm] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  const { data: appointment, isLoading } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => fetchAppointment(appointmentId!),
    enabled: open && !!appointmentId,
  });

  const showPayment = open && !!appointmentId &&
    (appointment?.status === "COMPLETED" || appointment?.status === "NO_SHOW");

  const { data: paymentData } = useQuery({
    queryKey: ["finance", "appointment-payment", appointmentId],
    queryFn: () => fetchPayments({ appointmentId: appointmentId!, limit: 1 }),
    enabled: showPayment,
  });
  const payment = paymentData?.items?.[0] ?? null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] });
    queryClient.invalidateQueries({ queryKey: ["appointments", "calendar"] });
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
  };

  const completeMutation = useMutation({
    mutationFn: () => completeAppointment(appointmentId!),
    onSuccess: () => {
      invalidate();
      toast.success("Randevu tamamlandı.");
      onOpenChange(false);
      if (appointment?.client.id) {
        router.push(
          `/clients/${appointment.client.id}?tab=notlar&newNote=1&sessionDate=${encodeURIComponent(appointment.startTime)}`
        );
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelAppointment(appointmentId!, cancelReason || undefined),
    onSuccess: () => {
      invalidate();
      toast.success("Randevu iptal edildi.");
      onOpenChange(false);
      setShowCancelForm(false);
      setCancelReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const noShowMutation = useMutation({
    mutationFn: () => noShowAppointment(appointmentId!),
    onSuccess: () => {
      invalidate();
      toast.success("Randevu 'gelmedi' olarak işaretlendi.");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isMutating =
    completeMutation.isPending || cancelMutation.isPending || noShowMutation.isPending;

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setShowCancelForm(false);
      setCancelReason("");
    }
    onOpenChange(o);
  };

  const paymentAmount = payment
    ? typeof payment.amount === "string" ? parseFloat(payment.amount) : payment.amount
    : 0;

  const goToPayment = () => {
    if (payment) {
      onOpenChange(false);
      router.push(`/finance?paymentId=${payment.id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Randevu Detayı</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {appointment && (
          <div className="space-y-4">
            {/* Status + location */}
            <div className="flex items-center justify-between">
              <Badge variant={STATUS_VARIANT[appointment.status] ?? "secondary"}>
                {STATUS_LABELS[appointment.status] ?? appointment.status}
              </Badge>
              {appointment.locationType === "ONLINE" && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Video className="size-4" />
                  Online
                </span>
              )}
            </div>

            {/* Date/time */}
            <div>
              <p className="text-muted-foreground text-sm">Tarih ve Saat</p>
              <p className="font-medium">
                {format(new Date(appointment.startTime), "dd.MM.yyyy HH:mm", { locale: tr })} –{" "}
                {format(new Date(appointment.endTime), "HH:mm", { locale: tr })}
              </p>
            </div>

            {/* Client */}
            <div>
              <p className="text-muted-foreground text-sm">Danışan</p>
              <p className="font-medium">
                {appointment.client.firstName} {appointment.client.lastName}
              </p>
              {appointment.client.email && (
                <a
                  href={`mailto:${appointment.client.email}`}
                  className="flex items-center gap-1 text-sm text-primary hover:underline mt-1"
                >
                  <Mail className="size-3.5" />
                  {appointment.client.email}
                </a>
              )}
              {appointment.client.phone && (
                <a
                  href={`tel:${appointment.client.phone}`}
                  className="flex items-center gap-1 text-sm text-primary hover:underline mt-1"
                >
                  <Phone className="size-3.5" />
                  {appointment.client.phone}
                </a>
              )}
            </div>

            {appointment.sessionType && (
              <div>
                <p className="text-muted-foreground text-sm">Seans Tipi</p>
                <p>{appointment.sessionType}</p>
              </div>
            )}

            {appointment.notes && (
              <div>
                <p className="text-muted-foreground text-sm">Notlar</p>
                <p className="text-sm">{appointment.notes}</p>
              </div>
            )}

            {/* Video join */}
            {appointment.locationType === "ONLINE" && appointment.videoHostUrl && (
              <Button
                className="w-full"
                onClick={() => window.open(appointment.videoHostUrl!, "_blank")}
              >
                <Video className="size-4" />
                Görüşmeye Katıl
              </Button>
            )}

            {/* SCHEDULED actions */}
            {appointment.status === "SCHEDULED" && !showCancelForm && (
              <div className="flex flex-col gap-2 pt-2 border-t">
                <Button className="w-full" onClick={() => completeMutation.mutate()} disabled={isMutating}>
                  {completeMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  Onayla (Tamamlandı)
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowCancelForm(true)} disabled={isMutating}>
                    İptal Et
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-amber-600 border-amber-300 hover:bg-amber-50"
                    onClick={() => noShowMutation.mutate()}
                    disabled={isMutating}
                  >
                    {noShowMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                    Gelmedi
                  </Button>
                </div>
              </div>
            )}

            {/* Cancel form */}
            {appointment.status === "SCHEDULED" && showCancelForm && (
              <div className="flex flex-col gap-2 pt-2 border-t">
                <p className="text-sm font-medium">İptal nedeni (isteğe bağlı)</p>
                <Textarea
                  placeholder="İptal nedeni..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive" className="flex-1"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                    İptal Et
                  </Button>
                  <Button
                    variant="outline" className="flex-1"
                    onClick={() => { setShowCancelForm(false); setCancelReason(""); }}
                    disabled={cancelMutation.isPending}
                  >
                    Vazgeç
                  </Button>
                </div>
              </div>
            )}

            {/* COMPLETED / NO_SHOW: payment + notes */}
            {(appointment.status === "COMPLETED" || appointment.status === "NO_SHOW") && (
              <div className="flex flex-col gap-2 pt-2 border-t">
                {/* Payment row */}
                {payment && (
                  <button
                    type="button"
                    onClick={goToPayment}
                    className="flex items-center justify-between rounded-lg bg-muted/50 border px-3 py-2.5 transition-colors hover:bg-muted cursor-pointer w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Wallet className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        ₺{paymentAmount.toLocaleString("tr-TR")}
                      </span>
                      <PaymentStatusBadge status={payment.status} />
                    </div>
                    <span className="text-xs text-primary font-medium">
                      {payment.status === "PENDING" ? "Tahsil Et →" : "Detay →"}
                    </span>
                  </button>
                )}
                {appointment.status === "COMPLETED" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      onOpenChange(false);
                      router.push(`/clients/${appointment.client.id}?tab=notlar`);
                    }}
                  >
                    Seans Notlarına Git
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
