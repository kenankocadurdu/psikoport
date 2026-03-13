import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { SetAvailabilityDto } from './dto/set-availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async setSlots(
    psychologistId: string,
    slots: SetAvailabilityDto['slots'],
    tenantId: string,
  ): Promise<{ count: number }> {
    await this.assertPsychologistBelongsToTenant(psychologistId, tenantId);

    await this.prisma.$transaction(async (tx) => {
      await tx.availabilitySlot.deleteMany({
        where: { psychologistId, tenantId },
      });

      if (slots.length === 0) {
        return;
      }

      await tx.availabilitySlot.createMany({
        data: slots.map((s) => ({
          tenantId,
          psychologistId,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
    });

    const count = await this.prisma.availabilitySlot.count({
      where: { psychologistId, tenantId },
    });
    return { count };
  }

  async getAvailableSlots(
    psychologistId: string,
    dateStr: string,
    tenantId: string,
  ): Promise<Array<{ start: string; end: string }>> {
    await this.assertPsychologistBelongsToTenant(psychologistId, tenantId);

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new NotFoundException('Geçersiz tarih');
    }

    const dayOfWeek = date.getDay();
    const slots = await this.prisma.availabilitySlot.findMany({
      where: { psychologistId, tenantId, dayOfWeek },
      orderBy: { startTime: 'asc' },
    });

    const dateStrOnly = dateStr.split('T')[0];
    const rangeStart = new Date(`${dateStrOnly}T00:00:00`);
    const rangeEnd = new Date(`${dateStrOnly}T23:59:59`);

    const [appointments, externalEvents] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          psychologistId,
          tenantId,
          status: 'SCHEDULED',
          startTime: { gte: rangeStart },
          endTime: { lte: rangeEnd },
        },
        select: { startTime: true, endTime: true },
      }),
      this.prisma.externalCalendarEvent.findMany({
        where: {
          psychologistId,
          deleted: false,
          startTime: { gte: rangeStart },
          endTime: { lte: rangeEnd },
        },
        select: { startTime: true, endTime: true },
      }),
    ]);

    // Tüm meşgul aralıkları birleştir ve merge et
    const rawBusy = [
      ...appointments.map((a) => ({ s: a.startTime.getTime(), e: a.endTime.getTime() })),
      ...externalEvents.map((ev) => ({ s: ev.startTime.getTime(), e: ev.endTime.getTime() })),
    ].sort((a, b) => a.s - b.s);

    const busyRanges: Array<{ s: number; e: number }> = [];
    for (const interval of rawBusy) {
      const last = busyRanges[busyRanges.length - 1];
      if (last && interval.s <= last.e) {
        last.e = Math.max(last.e, interval.e);
      } else {
        busyRanges.push({ ...interval });
      }
    }

    const available: Array<{ start: string; end: string }> = [];

    for (const slot of slots) {
      const [startH, startM] = slot.startTime.split(':').map(Number);
      const [endH, endM] = slot.endTime.split(':').map(Number);
      const slotStart = new Date(date);
      slotStart.setHours(startH, startM, 0, 0);
      const slotEnd = new Date(date);
      slotEnd.setHours(endH, endM, 0, 0);

      let current = new Date(slotStart);
      while (current < slotEnd) {
        const slotDuration = 30;
        const chunkEnd = new Date(current.getTime() + slotDuration * 60 * 1000);
        if (chunkEnd > slotEnd) break;

        const cMs = current.getTime();
        const ceMs = chunkEnd.getTime();
        const overlaps = busyRanges.some(
          (r) => cMs < r.e && ceMs > r.s,
        );

        if (!overlaps) {
          available.push({
            start: current.toISOString(),
            end: chunkEnd.toISOString(),
          });
        }

        current = chunkEnd;
      }
    }

    return available;
  }

  private async assertPsychologistBelongsToTenant(
    psychologistId: string,
    tenantId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: psychologistId, tenantId },
    });
    if (!user) {
      throw new NotFoundException('Psikolog bulunamadı');
    }
  }
}
