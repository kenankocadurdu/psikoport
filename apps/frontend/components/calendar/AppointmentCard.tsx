"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppointmentListItem } from "@/lib/api/appointments";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Video } from "lucide-react";

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

interface AppointmentCardProps {
  appointment: AppointmentListItem;
  onClick?: () => void;
  compact?: boolean;
}

export function AppointmentCard({
  appointment,
  onClick,
  compact,
}: AppointmentCardProps) {
  const start = new Date(appointment.startTime);
  const end = new Date(appointment.endTime);
  const isOnline = appointment.locationType === "ONLINE";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors",
        "hover:bg-muted/50 cursor-pointer",
        compact && "p-2"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground tabular-nums shrink-0">
              {format(start, "HH:mm", { locale: tr })}–{format(end, "HH:mm", { locale: tr })}
            </span>
            <Badge
              variant={STATUS_VARIANTS[appointment.status] ?? "outline"}
              className="text-xs shrink-0"
            >
              {STATUS_LABELS[appointment.status] ?? appointment.status}
            </Badge>
            {isOnline && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Video className="size-3.5" />
                Online
              </span>
            )}
            {!isOnline && (
              <span className="text-xs text-muted-foreground shrink-0">Yüz yüze</span>
            )}
          </div>
          <p className="mt-1 font-medium truncate">
            {appointment.client.firstName} {appointment.client.lastName}
          </p>
          {appointment.sessionType && !compact && (
            <p className="text-muted-foreground text-sm">{appointment.sessionType}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export interface AppointmentCardWithLinkProps {
  appointment: AppointmentListItem;
  videoHostUrl?: string | null;
  onClick?: () => void;
}

export function AppointmentCardWithLink({
  appointment,
  videoHostUrl,
  onClick,
}: AppointmentCardWithLinkProps) {
  const isOnline = appointment.locationType === "ONLINE";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50 cursor-pointer"
    >
      <AppointmentCard appointment={appointment} compact />
      {isOnline && videoHostUrl && (
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={(e) => {
            e.stopPropagation();
            window.open(videoHostUrl, "_blank");
          }}
        >
          <Video className="size-4" />
          Görüşmeye Katıl
        </Button>
      )}
    </div>
  );
}
