import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export type TimelineEntryType = 'note' | 'test' | 'appointment';

export interface TimelineEntry {
  type: TimelineEntryType;
  date: string;
  title: string;
  meta: Record<string, unknown>;
  id: string;
}

export interface TimelineResponse {
  data: TimelineEntry[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async getTimeline(
    clientId: string,
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<TimelineResponse> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) {
      throw new NotFoundException('Danışan bulunamadı');
    }

    const entries: TimelineEntry[] = [];

    const notes = await this.prisma.consultationNote.findMany({
      where: { clientId, tenantId },
      orderBy: { sessionDate: 'desc' },
      select: {
        id: true,
        sessionDate: true,
        sessionNumber: true,
        sessionType: true,
        tags: true,
        moodRating: true,
      },
    });
    for (const n of notes) {
      entries.push({
        type: 'note',
        id: n.id,
        date: n.sessionDate.toISOString(),
        title: n.sessionNumber != null ? `Seans #${n.sessionNumber}` : 'Seans notu',
        meta: {
          sessionNumber: n.sessionNumber,
          sessionType: n.sessionType,
          tags: n.tags,
          moodRating: n.moodRating,
        },
      });
    }

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = entries.length;
    const skip = (page - 1) * limit;
    const paginated = entries.slice(skip, skip + limit);

    return {
      data: paginated,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
