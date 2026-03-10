"use client";

import { useRef, useEffect, useState } from "react";
import { AppointmentCard } from "./AppointmentCard";
import type { AppointmentListItem } from "@/lib/api/appointments";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { tr } from "date-fns/locale";

interface WeekViewProps {
  weekStart: Date;
  appointments: AppointmentListItem[];
  onAppointmentClick?: (id: string) => void;
  onSlotClick?: (date: Date, hour: number) => void;
  onDropAppointment?: (id: string, date: Date, hour: number, durationMinutes: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function WeekView({
  weekStart,
  appointments,
  onAppointmentClick,
  onSlotClick,
  onDropAppointment,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const start = startOfWeek(weekStart, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const [dragOverCell, setDragOverCell] = useState<{ dayIso: string; hour: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * 72;
    }
  }, [weekStart]);

  return (
    <div className="flex flex-col h-full">
      {/* Sticky day header */}
      <div className="overflow-x-auto shrink-0 border-b">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] min-w-[800px]">
          <div className="p-2" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="p-2 text-center text-sm font-medium border-l first:border-l-0"
            >
              {format(day, "EEE", { locale: tr })}
              <span className="block text-muted-foreground text-xs">
                {format(day, "d MMM", { locale: tr })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
        <div>
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[56px_repeat(7,1fr)] min-w-[800px] border-b min-h-[72px]"
            >
              <div className="p-1 text-right text-muted-foreground text-xs py-2 select-none">
                {String(hour).padStart(2, "0")}:00
              </div>
              {days.map((day) => {
                const dayIso = day.toISOString();
                const isOver = dragOverCell?.dayIso === dayIso && dragOverCell?.hour === hour;
                const dayAppts = appointments.filter((a) => {
                  const s = new Date(a.startTime);
                  return isSameDay(s, day) && s.getHours() === hour;
                });
                return (
                  <div
                    key={dayIso}
                    className={`p-1 border-l first:border-l-0 space-y-1 cursor-pointer transition-colors ${
                      isOver ? "bg-primary/10" : "hover:bg-muted/30"
                    }`}
                    onClick={() => onSlotClick?.(day, hour)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverCell?.dayIso !== dayIso || dragOverCell?.hour !== hour) {
                        setDragOverCell({ dayIso, hour });
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverCell(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("apptId");
                      const duration = parseInt(e.dataTransfer.getData("duration") || "50", 10);
                      if (id) onDropAppointment?.(id, day, hour, duration);
                      setDragOverCell(null);
                      setDraggingId(null);
                    }}
                  >
                    {dayAppts.map((a) => (
                      <div
                        key={a.id}
                        className={`transition-opacity ${draggingId === a.id ? "opacity-40" : ""}`}
                        draggable
                        onDragStart={(e) => {
                          setDraggingId(a.id);
                          e.dataTransfer.setData("apptId", a.id);
                          e.dataTransfer.setData("duration", String(a.durationMinutes));
                          e.stopPropagation();
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverCell(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <AppointmentCard
                          appointment={a}
                          compact
                          onClick={() => onAppointmentClick?.(a.id)}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
