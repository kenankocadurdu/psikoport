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

    const bookedRanges = await this.prisma.appointment.findMany({
      where: {
        psychologistId,
        tenantId,
        status: 'SCHEDULED',
        startTime: { gte: new Date(`${dateStrOnly}T00:00:00`) },
        endTime: { lte: new Date(`${dateStrOnly}T23:59:59`) },
      },
      select: { startTime: true, endTime: true },
    });

    const available: Array<{
      start: string;
      end: string;
    }> = [];

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

        const overlaps = bookedRanges.some(
          (r) =>
            (current >= r.startTime && current < r.endTime) ||
            (chunkEnd > r.startTime && chunkEnd <= r.endTime) ||
            (current <= r.startTime && chunkEnd >= r.endTime),
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
