"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { fetchClientAppointments } from "@/lib/api/appointments";
import { AppointmentDetailDialog } from "@/components/calendar/AppointmentDetailDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Plus, Video } from "lucide-react";
import type { AppointmentListItem } from "@/lib/api/appointments";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Bekliyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
  NO_SHOW: "Gelmedi",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SCHEDULED: "secondary",
  COMPLETED: "default",
  CANCELLED: "destructive",
  NO_SHOW: "outline",
};

interface ClientAppointmentsTabProps {
  clientId: string;
  clientName?: string;
}

export function ClientAppointmentsTab({ clientId, clientName }: ClientAppointmentsTabProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["appointments", "client", clientId],
    queryFn: () => fetchClientAppointments(clientId),
    enabled: !!clientId,
  });

  const appointments = data?.data ?? [];
  const now = new Date();

  const upcoming = appointments.filter(
    (a) => a.status === "SCHEDULED" && new Date(a.startTime) >= now
  );
  const past = appointments.filter(
    (a) => a.status !== "SCHEDULED" || new Date(a.startTime) < now
  );

  const handleClick = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {appointments.length} randevu
        </p>
        <Button size="sm" onClick={() => router.push("/calendar")}>
          <Plus className="size-4" />
          Yeni Randevu
        </Button>
      </div>

      {appointments.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Bu danışana ait randevu bulunmuyor.
        </div>
      )}

      {upcoming.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Gelecek Randevular
          </h3>
          <div className="space-y-2">
            {upcoming.map((a) => (
              <AppointmentRow key={a.id} appointment={a} onClick={() => handleClick(a.id)} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Geçmiş Randevular
          </h3>
          <div className="space-y-2">
            {past.map((a) => (
              <AppointmentRow key={a.id} appointment={a} onClick={() => handleClick(a.id)} />
            ))}
          </div>
        </section>
      )}

      <AppointmentDetailDialog
        appointmentId={selectedId}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) {
            queryClient.invalidateQueries({ queryKey: ["appointments", "client", clientId] });
          }
        }}
      />

    </div>
  );
}

function AppointmentRow({
  appointment,
  onClick,
}: {
  appointment: AppointmentListItem;
  onClick: () => void;
}) {
  const start = new Date(appointment.startTime);
  const end = new Date(appointment.endTime);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50 cursor-pointer"
    >
      <div className="shrink-0 text-center w-12">
        <p className="text-xs text-muted-foreground">{format(start, "MMM", { locale: tr })}</p>
        <p className="text-xl font-semibold leading-none">{format(start, "d")}</p>
        <p className="text-xs text-muted-foreground">{format(start, "yyyy")}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium tabular-nums">
            {format(start, "HH:mm", { locale: tr })} – {format(end, "HH:mm", { locale: tr })}
          </span>
          <Badge variant={STATUS_VARIANTS[appointment.status] ?? "outline"} className="text-xs">
            {STATUS_LABELS[appointment.status] ?? appointment.status}
          </Badge>
          {appointment.locationType === "ONLINE" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Video className="size-3.5" />
              Online
            </span>
          )}
        </div>
        {appointment.sessionType && (
          <p className="text-sm text-muted-foreground mt-0.5">{appointment.sessionType}</p>
        )}
      </div>
    </div>
  );
}
