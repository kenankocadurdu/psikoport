import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../../../database/prisma.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';
import { VideoService } from '../video/video.service';
import type { CreateAppointmentDto } from './dto/create-appointment.dto';
import type { UpdateAppointmentDto } from './dto/update-appointment.dto';
import type { AppointmentQueryDto } from './dto/appointment-query.dto';
import {
  AppointmentStatus,
  LocationType,
  VideoProvider,
} from 'prisma-client';
import type { PaginatedResponse } from '../../legal/audit-log.service';
import type { AppointmentNotificationJobData } from './types';
import { PaymentsService } from '../../finance/payments.service';
import { SubscriptionService } from '../../subscriptions/subscription.service';

const SLOT_LOCK_TTL = 300; // 5 minutes
const SLOT_LOCK_PREFIX = 'appointment:slot:';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue('appointment-notification') private readonly notifQueue: Queue,
    private readonly calendarSync: CalendarSyncService,
    private readonly videoService: VideoService,
    private readonly paymentsService: PaymentsService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  private lockKey(psychologistId: string, startTime: Date): string {
    return `${SLOT_LOCK_PREFIX}${psychologistId}:${startTime.toISOString()}`;
  }

  private async acquireLock(
    psychologistId: string,
    startTime: Date,
  ): Promise<boolean> {
    const key = this.lockKey(psychologistId, startTime);
    const result = await this.redis.set(key, '1', 'EX', SLOT_LOCK_TTL, 'NX');
    return result === 'OK';
  }

  private async releaseLock(
    psychologistId: string,
    startTime: Date,
  ): Promise<void> {
    const key = this.lockKey(psychologistId, startTime);
    await this.redis.del(key);
  }

  private async checkSlotConflict(
    psychologistId: string,
    startTime: Date,
    endTime: Date,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.appointment.findFirst({
      where: {
        psychologistId,
        status: 'SCHEDULED',
        ...(excludeId && { id: { not: excludeId } }),
        OR: [
          {
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        ],
      },
    });
    if (existing) {
      throw new ConflictException(
        'Bu saat diliminde zaten bir randevu bulunuyor',
      );
    }
  }

  async create(
    dto: CreateAppointmentDto,
    tenantId: string,
    userId: string,
  ): Promise<{
    id: string;
    clientId: string;
    psychologistId: string;
    startTime: Date;
    endTime: Date;
    status: string;
  }> {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    const locked = await this.acquireLock(dto.psychologistId, startTime);
    if (!locked) {
      throw new ConflictException(
        'Bu slot için işlem devam ediyor, lütfen tekrar deneyin',
      );
    }

    try {
      await this.assertClientBelongsToTenant(dto.clientId, tenantId);
      await this.assertPsychologistBelongsToTenant(
        dto.psychologistId,
        tenantId,
      );
      await this.checkSlotConflict(
        dto.psychologistId,
        startTime,
        endTime,
      );

      const locationType =
        dto.locationType === 'ONLINE'
          ? LocationType.ONLINE
          : LocationType.IN_PERSON;

      let videoProvider: VideoProvider = VideoProvider.NONE;
      let videoMeetingUrl: string | null = null;
      let videoMeetingId: string | null = null;
      let videoHostUrl: string | null = null;

      if (locationType === LocationType.ONLINE) {
        const meeting = await this.videoService.createVideoMeeting({
          appointmentId: '', // will be set after create
          psychologistId: dto.psychologistId,
          tenantId,
          topic: 'Online Görüşme',
          startTime,
          endTime,
          durationMinutes: dto.durationMinutes,
        });
        videoProvider = meeting.provider;
        videoMeetingUrl = meeting.meetingUrl;
        videoMeetingId = meeting.meetingId;
        videoHostUrl = meeting.hostUrl;
      }

      const appointment = await this.prisma.appointment.create({
        data: {
          tenantId,
          clientId: dto.clientId,
          psychologistId: dto.psychologistId,
          startTime,
          endTime,
          durationMinutes: dto.durationMinutes,
          sessionType: dto.sessionType ?? null,
          locationType,
          notes: dto.notes ?? null,
          recurrenceRule: dto.recurrenceRule ?? null,
          videoProvider,
          videoMeetingUrl,
          videoMeetingId,
          videoHostUrl,
        } as never,
      });

      await this.pushAppointmentToCalendar(appointment);

      if (locationType === LocationType.ONLINE && videoMeetingUrl) {
        await this.notifQueue.add('created', {
          appointmentId: appointment.id,
          type: 'created',
          tenantId,
          clientId: appointment.clientId,
          psychologistId: appointment.psychologistId,
          videoMeetingUrl,
        } as never, { jobId: `appt-notif:${appointment.id}:created` });
      }

      return {
        id: appointment.id,
        clientId: appointment.clientId,
        psychologistId: appointment.psychologistId,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
      };
    } finally {
      await this.releaseLock(dto.psychologistId, startTime);
    }
  }

  async findAll(
    query: AppointmentQueryDto,
    tenantId: string,
  ): Promise<
    PaginatedResponse<{
      id: string;
      clientId: string;
      psychologistId: string;
      startTime: Date;
      endTime: Date;
      durationMinutes: number;
      status: string;
      sessionType: string | null;
      locationType: string;
      client: { firstName: string; lastName: string };
    }>
  > {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (query.status) where.status = query.status;
    if (query.psychologistId) where.psychologistId = query.psychologistId;
    if (query.clientId) where.clientId = query.clientId;
    if (query.start && query.end) {
      where.startTime = {
        gte: new Date(query.start),
        lte: new Date(query.end),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where: where as never,
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
        include: {
          client: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.appointment.count({ where: where as never }),
    ]);

    return {
      data: data.map((a) => ({
        id: a.id,
        clientId: a.clientId,
        psychologistId: a.psychologistId,
        startTime: a.startTime,
        endTime: a.endTime,
        durationMinutes: a.durationMinutes,
        status: a.status,
        sessionType: a.sessionType,
        locationType: a.locationType,
        client: a.client,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        psychologist: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Randevu bulunamadı');
    }
    return appointment;
  }

  async update(
    id: string,
    dto: UpdateAppointmentDto,
    tenantId: string,
  ): Promise<{
    id: string;
    startTime: Date;
    endTime: Date;
    status: string;
  }> {
    const existing = await this.findOne(id, tenantId);
    if (existing.status !== 'SCHEDULED') {
      throw new ForbiddenException(
        'Yalnızca planlanmış randevular güncellenebilir',
      );
    }

    const startTime = dto.startTime ? new Date(dto.startTime) : existing.startTime;
    const endTime = dto.endTime ? new Date(dto.endTime) : existing.endTime;

    if (dto.startTime || dto.endTime) {
      const locked = await this.acquireLock(existing.psychologistId, startTime);
      if (!locked) {
        throw new ConflictException(
          'Bu slot için işlem devam ediyor, lütfen tekrar deneyin',
        );
      }
      try {
        await this.checkSlotConflict(
          existing.psychologistId,
          startTime,
          endTime,
          id,
        );
      } finally {
        await this.releaseLock(existing.psychologistId, startTime);
      }
    }

    const updateData: Record<string, unknown> = {
      ...(dto.startTime && { startTime }),
      ...(dto.endTime && { endTime }),
      ...(dto.durationMinutes != null && { durationMinutes: dto.durationMinutes }),
      ...(dto.sessionType !== undefined && { sessionType: dto.sessionType }),
      ...(dto.locationType && {
        locationType: dto.locationType as LocationType,
      }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    };

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: updateData as never,
    });

    if (dto.startTime || dto.endTime || dto.durationMinutes != null) {
      await this.pushAppointmentToCalendar(appointment);
    }

    return {
      id: appointment.id,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
    };
  }

  async cancel(
    id: string,
    reason: string | undefined,
    tenantId: string,
  ): Promise<{ id: string; status: string }> {
    const existing = await this.findOne(id, tenantId);
    if (existing.status !== 'SCHEDULED') {
      throw new ForbiddenException('Bu randevu iptal edilemez');
    }

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancellationReason: reason ?? null,
        cancelledAt: new Date(),
      },
    });

    await this.subscriptionService.consumeSession(tenantId);

    await this.notifQueue.add('cancelled', {
      appointmentId: id,
      type: 'cancelled',
      tenantId,
      clientId: appointment.clientId,
      psychologistId: appointment.psychologistId,
      reason: reason ?? undefined,
    } as AppointmentNotificationJobData, { jobId: `appt-notif:${id}:cancelled` });

    return { id: appointment.id, status: appointment.status };
  }

  async complete(
    id: string,
    tenantId: string,
  ): Promise<{ id: string; status: string }> {
    const existing = await this.findOne(id, tenantId);
    if (existing.status !== 'SCHEDULED') {
      throw new ForbiddenException('Bu randevu tamamlanamaz');
    }

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.COMPLETED },
    });

    await this.paymentsService.createFromAppointment(
      appointment.id,
      existing.tenantId,
    );

    await this.subscriptionService.consumeSession(tenantId);

    return { id: appointment.id, status: appointment.status };
  }

  async noShow(id: string, tenantId: string): Promise<{ id: string; status: string }> {
    const existing = await this.findOne(id, tenantId);
    if (existing.status !== 'SCHEDULED') {
      throw new ForbiddenException('Bu randevu gelmedi olarak işaretlenemez');
    }

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.NO_SHOW },
    });

    await this.subscriptionService.consumeSession(tenantId);

    return { id: appointment.id, status: appointment.status };
  }

  private async assertClientBelongsToTenant(
    clientId: string,
    tenantId: string,
  ): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) {
      throw new NotFoundException('Danışan bulunamadı');
    }
  }

  private async pushAppointmentToCalendar(appointment: {
    id: string;
    psychologistId: string;
    tenantId: string;
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
    googleEventId?: string | null;
  }): Promise<void> {
    try {
      const integration = await this.prisma.calendarIntegration.findFirst({
        where: {
          psychologistId: appointment.psychologistId,
          tenantId: appointment.tenantId,
        },
      });
      if (!integration) return;

      const eventId = await this.calendarSync.push(
        integration.id,
        integration.provider,
        {
          id: appointment.id,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          durationMinutes: appointment.durationMinutes,
          googleEventId: appointment.googleEventId,
        },
      );
      if (eventId && !appointment.googleEventId) {
        await this.prisma.appointment.update({
          where: { id: appointment.id },
          data: { googleEventId: eventId },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Calendar push failed for appointment ${appointment.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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
