"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import {
  fetchAppointmentsCalendar,
  updateAppointment,
} from "@/lib/api/appointments";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DayView } from "@/components/calendar/DayView";
import { WeekView } from "@/components/calendar/WeekView";
import { AppointmentDetailDialog } from "@/components/calendar/AppointmentDetailDialog";
import { CreateAppointmentDialog } from "@/components/calendar/CreateAppointmentDialog";
import { GuideTooltip } from "@/components/onboarding/GuideTooltip";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";

type ViewMode = "day" | "week" | "month";

export default function CalendarPage() {
  const [viewMode, setViewMode] = React.useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createInitialDate, setCreateInitialDate] = React.useState<Date>(currentDate);
  const queryClient = useQueryClient();

  const handleSlotClick = (date: Date, hour: number) => {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    setCreateInitialDate(d);
    setCreateOpen(true);
  };

  const handleDropAppointment = async (
    id: string,
    date: Date,
    hour: number,
    durationMinutes: number
  ) => {
    const newStart = new Date(date);
    newStart.setHours(hour, 0, 0, 0);
    const newEnd = new Date(newStart);
    newEnd.setMinutes(newEnd.getMinutes() + durationMinutes);
    try {
      await updateAppointment(id, {
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["appointments", "calendar"] });
      toast.success("Randevu taşındı.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Randevu güncellenemedi");
    }
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const rangeStart =
    viewMode === "day"
      ? new Date(currentDate)
      : viewMode === "week"
        ? weekStart
        : new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const rangeEnd =
    viewMode === "day"
      ? new Date(currentDate)
      : viewMode === "week"
        ? addDays(weekStart, 6)
        : new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const start = new Date(rangeStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(23, 59, 59, 999);

  const { data: calendarData, isLoading } = useQuery({
    queryKey: [
      "appointments",
      "calendar",
      start.toISOString(),
      end.toISOString(),
    ],
    queryFn: () =>
      fetchAppointmentsCalendar({
        start: start.toISOString(),
        end: end.toISOString(),
      }),
    refetchInterval: 30 * 1000,
  });

  const appointments = calendarData?.data ?? [];

  const handlePrev = () => {
    if (viewMode === "day") setCurrentDate(addDays(currentDate, -1));
    else if (viewMode === "week")
      setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, -1));
  };

  const handleNext = () => {
    if (viewMode === "day") setCurrentDate(addDays(currentDate, 1));
    else if (viewMode === "week")
      setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrev}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>
              Bugün
            </Button>
            <Button variant="outline" size="icon" onClick={handleNext}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <h1 className="text-xl font-semibold">
            {viewMode === "day"
              ? format(currentDate, "d MMMM yyyy", { locale: tr })
              : viewMode === "week"
                ? `${format(weekStart, "d MMM", { locale: tr })} – ${format(addDays(weekStart, 6), "d MMM yyyy", { locale: tr })}`
                : format(currentDate, "MMMM yyyy", { locale: tr })}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="day">Gün</TabsTrigger>
              <TabsTrigger value="week">Hafta</TabsTrigger>
              <TabsTrigger value="month">Ay</TabsTrigger>
            </TabsList>
          </Tabs>
          <GuideTooltip
            id="calendar_new"
            content="Takvimde sürükle/tıkla ile randevu oluşturabilirsiniz."
          >
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Yeni Randevu
            </Button>
          </GuideTooltip>
        </div>
      </div>

      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : viewMode === "day" ? (
          <DayView
            date={currentDate}
            appointments={appointments}
            onAppointmentClick={(id) => {
              setDetailId(id);
              setDetailOpen(true);
            }}
            onSlotClick={handleSlotClick}
            onDropAppointment={handleDropAppointment}
          />
        ) : viewMode === "week" ? (
          <WeekView
            weekStart={weekStart}
            appointments={appointments}
            onAppointmentClick={(id) => {
              setDetailId(id);
              setDetailOpen(true);
            }}
            onSlotClick={handleSlotClick}
            onDropAppointment={handleDropAppointment}
          />
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            Aylık görünüm yakında
          </div>
        )}
      </div>

      <AppointmentDetailDialog
        appointmentId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <CreateAppointmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDate={createInitialDate}
      />
    </div>
  );
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
