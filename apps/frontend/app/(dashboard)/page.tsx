"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import {
  fetchAppointmentsCalendar,
  fetchAppointment,
} from "@/lib/api/appointments";
import { fetchSummary, fetchPayments, type PaymentListItem } from "@/lib/api/finance";
import { fetchCrisisAlerts, acknowledgeCrisisAlert } from "@/lib/api/crisis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppointmentDetailDialog } from "@/components/calendar/AppointmentDetailDialog";
import {
  Calendar,
  ChevronRight,
  Wallet,
  AlertCircle,
  AlertTriangle,
  Check,
  Video,
  Clock,
  TrendingUp,
  CheckCircle2,
  Timer,
} from "lucide-react";
import { format as fmtDate } from "date-fns";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Bekliyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
  NO_SHOW: "Gelmedi",
};
const STATUS_VARIANTS: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  SCHEDULED: "secondary",
  COMPLETED: "default",
  CANCELLED: "destructive",
  NO_SHOW: "outline",
};

export default function DashboardPage() {
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const queryClient = useQueryClient();

  const { data: crisisAlerts } = useQuery({
    queryKey: ["crisis", "alerts"],
    queryFn: fetchCrisisAlerts,
    refetchInterval: 60 * 1000,
  });
  const { data: weeklyFinance } = useQuery({
    queryKey: ["finance", "summary", "weekly"],
    queryFn: () => fetchSummary("weekly"),
  });
  const { data: calendarData, isLoading } = useQuery({
    queryKey: ["appointments", "calendar", dayStart.toISOString(), dayEnd.toISOString()],
    queryFn: () =>
      fetchAppointmentsCalendar({ start: dayStart.toISOString(), end: dayEnd.toISOString() }),
    refetchInterval: 30 * 1000,
  });

  const { data: todayPaymentsData } = useQuery({
    queryKey: ["finance", "today-payments", dayStart.toISOString()],
    queryFn: () =>
      fetchPayments({ start: dayStart.toISOString(), end: dayEnd.toISOString(), limit: 100 }),
    refetchInterval: 60 * 1000,
  });
  const paymentsMap = React.useMemo(() => {
    const m = new Map<string, PaymentListItem>();
    (todayPaymentsData?.items ?? []).forEach((p) => m.set(p.appointmentId, p));
    return m;
  }, [todayPaymentsData]);

  const appointments = calendarData?.data ?? [];
  const todayAppointments = appointments
    .filter((a) => {
      const s = new Date(a.startTime);
      return s >= dayStart && s <= dayEnd;
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const scheduled = todayAppointments.filter((a) => a.status === "SCHEDULED");
  const completed = todayAppointments.filter((a) => a.status === "COMPLETED");

  const onlineIds = todayAppointments
    .filter((a) => a.locationType === "ONLINE")
    .map((a) => a.id);

  const detailResults = useQueries({
    queries: onlineIds.map((id) => ({
      queryKey: ["appointment", id],
      queryFn: () => fetchAppointment(id),
      enabled: !!id,
    })),
  });

  const detailsMap = React.useMemo(() => {
    const m = new Map<string, Awaited<ReturnType<typeof fetchAppointment>>>();
    detailResults.forEach((r) => { if (r.data) m.set(r.data.id, r.data); });
    return m;
  }, [detailResults]);

  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeCrisisAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crisis"] });
      toast.success("Kriz uyarısı incelendi olarak işaretlendi");
    },
  });

  const activeAlerts = crisisAlerts ?? [];

  return (
    <div className="space-y-6">
      {/* Kriz uyarısı banner */}
      {activeAlerts.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/40">
          <div className="flex size-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50 shrink-0">
            <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            Dikkat: {activeAlerts.map((a) => a.clientName).join(", ")} kriz yanıtı verdi.
          </p>
        </div>
      )}

      {/* Başlık + Hızlı eylem */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {format(today, "d MMMM yyyy", { locale: tr })}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {format(today, "EEEE", { locale: tr })} · {todayAppointments.length} randevu
          </p>
        </div>
        <Link href="/calendar">
          <Button size="sm" className="gap-1.5">
            <Calendar className="size-4" />
            Takvim
            <ChevronRight className="size-3.5" />
          </Button>
        </Link>
      </div>

      {/* ── STAT KARTLARI ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Haftalık Gelir */}
        <Link href="/finance" className="col-span-1">
          <div className="relative overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-sm hover:shadow-md transition-shadow dark:border-emerald-800">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100/80">
                  Bu Hafta Gelir
                </p>
                <p className="mt-1.5 text-2xl font-bold">
                  ₺{(weeklyFinance?.collected ?? 0).toLocaleString("tr-TR")}
                </p>
                <p className="mt-1 text-xs text-emerald-100/70">
                  ₺{(weeklyFinance?.pending ?? 0).toLocaleString("tr-TR")} bekliyor
                </p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-white/15">
                <TrendingUp className="size-5 text-white" />
              </div>
            </div>
          </div>
        </Link>

        {/* Ödenmemiş seans */}
        <Link href="/finance?status=PENDING" className="col-span-1">
          <div className="relative overflow-hidden rounded-xl border border-amber-100 bg-gradient-to-br from-amber-400 to-orange-500 p-4 text-white shadow-sm hover:shadow-md transition-shadow dark:border-amber-800">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-100/80">
                  Ödenmemiş
                </p>
                <p className="mt-1.5 text-2xl font-bold">
                  {weeklyFinance?.unpaidCount ?? 0}
                </p>
                <p className="mt-1 text-xs text-amber-100/70">seans</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-white/15">
                <AlertCircle className="size-5 text-white" />
              </div>
            </div>
          </div>
        </Link>

        {/* Bekleyen Randevu */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Bekleyen
              </p>
              <p className="mt-1.5 text-2xl font-bold">{scheduled.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">bugün</p>
            </div>
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Timer className="size-5 text-primary" />
            </div>
          </div>
        </div>

        {/* Tamamlanan */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tamamlanan
              </p>
              <p className="mt-1.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {completed.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">bugün</p>
            </div>
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>
      </div>

      {/* ── BUGÜNÜN RANDEVULARI ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Bugünün Randevuları
          </h2>
          {todayAppointments.length > 0 && (
            <span className="text-xs text-muted-foreground">{todayAppointments.length} randevu</span>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : todayAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-12 text-center">
            <Calendar className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">Bugün randevu yok</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Takvimden yeni randevu ekleyebilirsiniz</p>
          </div>
        ) : (
          <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {todayAppointments.map((a) => {
              const start = new Date(a.startTime);
              const end = new Date(a.endTime);
              const videoDetail = detailsMap.get(a.id);
              const payment = paymentsMap.get(a.id);
              const paymentPaid = payment?.status === "PAID";
              const isCompleted = a.status === "COMPLETED";
              const isCancelled = a.status === "CANCELLED";
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { setDetailId(a.id); setDetailOpen(true); }}
                  className={`group flex flex-col gap-2 rounded-xl border bg-card p-3.5 text-left transition-all hover:shadow-sm cursor-pointer ${
                    isCompleted ? "border-emerald-100 dark:border-emerald-900/40" :
                    isCancelled ? "border-border opacity-60" : "border-border hover:border-primary/20"
                  }`}
                >
                  {/* Üst: saat + badge */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
                      <Clock className="size-3 shrink-0" />
                      {fmtDate(start, "HH:mm")}–{fmtDate(end, "HH:mm")}
                    </span>
                    <Badge
                      variant={STATUS_VARIANTS[a.status] ?? "outline"}
                      className="text-[10px] px-1.5 py-0 h-4"
                    >
                      {STATUS_LABELS[a.status] ?? a.status}
                    </Badge>
                  </div>

                  {/* İsim */}
                  <p className="font-semibold text-sm leading-snug truncate">
                    {a.client.firstName} {a.client.lastName}
                  </p>

                  {/* Seans tipi + lokasyon */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.locationType === "ONLINE" && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                        <Video className="size-3" />
                        Online
                      </span>
                    )}
                    {a.sessionType && (
                      <span className="text-[11px] text-muted-foreground truncate">{a.sessionType}</span>
                    )}
                  </div>

                  {/* Ödeme durumu */}
                  {payment && (a.status === "COMPLETED" || a.status === "NO_SHOW") && (
                    <div className={`flex items-center gap-1 text-[11px] font-semibold rounded-md px-2 py-0.5 w-fit ${
                      paymentPaid
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      <Wallet className="size-3" />
                      {paymentPaid ? "Ödendi" : "Ödeme Bekliyor"}
                    </div>
                  )}

                  {/* Video link */}
                  {a.locationType === "ONLINE" && videoDetail?.videoHostUrl && (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(videoDetail.videoHostUrl!, "_blank");
                      }}
                    >
                      <Video className="size-3" />
                      Görüşmeye Katıl
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── KRİZ UYARILARI ── */}
      {activeAlerts.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Kriz Uyarıları
            </h2>
          </div>
          <div className="space-y-2.5">
            {activeAlerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3.5 dark:border-red-900/50 dark:bg-red-950/20"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                    <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-red-900 dark:text-red-100 truncate">
                      {a.clientName}
                      <span className="font-normal text-red-700/80 dark:text-red-300/80"> — {a.formTitle}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.submittedAt ? new Date(a.submittedAt).toLocaleString("tr-TR") : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/clients/${a.clientId}/tests`}>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      Görüntüle
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={(e) => { e.preventDefault(); acknowledgeMutation.mutate(a.id); }}
                  >
                    <Check className="size-3.5" />
                    İncelendi
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <AppointmentDetailDialog
        appointmentId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
