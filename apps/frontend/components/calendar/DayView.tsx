"use client";

import { useRef, useEffect, useState } from "react";
import { AppointmentCardWithLink } from "./AppointmentCard";
import type { AppointmentListItem, AppointmentDetail } from "@/lib/api/appointments";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface DayViewProps {
  date: Date;
  appointments: AppointmentListItem[];
  appointmentDetails?: Map<string, AppointmentDetail>;
  onAppointmentClick?: (id: string) => void;
  onSlotClick?: (date: Date, hour: number) => void;
  onDropAppointment?: (id: string, date: Date, hour: number, durationMinutes: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DayView({
  date,
  appointments,
  appointmentDetails,
  onAppointmentClick,
  onSlotClick,
  onDropAppointment,
}: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dateStr = format(date, "yyyy-MM-dd", { locale: tr });
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const dayAppointments = appointments.filter((a) => {
    const start = new Date(a.startTime);
    return format(start, "yyyy-MM-dd", { locale: tr }) === dateStr;
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * 60;
    }
  }, [date]);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-2 shrink-0">
        <h2 className="font-semibold">
          {format(date, "d MMMM yyyy, EEEE", { locale: tr })}
        </h2>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="relative">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className={`flex border-b border-dashed border-muted min-h-[60px] cursor-pointer transition-colors ${
                dragOverHour === hour ? "bg-primary/10" : "hover:bg-muted/30"
              }`}
              onClick={() => onSlotClick?.(date, hour)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverHour !== hour) setDragOverHour(hour);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverHour(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("apptId");
                const duration = parseInt(e.dataTransfer.getData("duration") || "50", 10);
                if (id) onDropAppointment?.(id, date, hour, duration);
                setDragOverHour(null);
                setDraggingId(null);
              }}
            >
              <div className="w-14 shrink-0 py-1 pr-2 text-right text-muted-foreground text-xs select-none">
                {String(hour).padStart(2, "0")}:00
              </div>
              <div className="flex-1 py-1">
                {dayAppointments
                  .filter((a) => new Date(a.startTime).getHours() === hour)
                  .map((a) => (
                    <div
                      key={a.id}
                      className={`mb-2 transition-opacity ${draggingId === a.id ? "opacity-40" : ""}`}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(a.id);
                        e.dataTransfer.setData("apptId", a.id);
                        e.dataTransfer.setData("duration", String(a.durationMinutes));
                        e.stopPropagation();
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverHour(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <AppointmentCardWithLink
                        appointment={a}
                        videoHostUrl={appointmentDetails?.get(a.id)?.videoHostUrl}
                        onClick={() => onAppointmentClick?.(a.id)}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
