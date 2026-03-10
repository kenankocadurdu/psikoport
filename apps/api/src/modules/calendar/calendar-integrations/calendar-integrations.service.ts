import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../../../database/prisma.service';
import { GoogleCalendarService } from '../calendar-sync/google-calendar.service';
import { OutlookCalendarService } from '../calendar-sync/outlook-calendar.service';
import { REDIS_CLIENT } from '../scheduling/appointments.service';

const STATE_PREFIX = 'calendar:oauth:state:';
const STATE_TTL = 600;

@Injectable()
export class CalendarIntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendar: GoogleCalendarService,
    private readonly outlookCalendar: OutlookCalendarService,
    @InjectQueue('calendar-sync') private readonly syncQueue: Queue,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getGoogleAuthUrl(tenantId: string, psychologistId: string): Promise<{ url: string; state: string }> {
    const state = `${tenantId}:${psychologistId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    await this.redis.setex(STATE_PREFIX + state, STATE_TTL, JSON.stringify({ tenantId, psychologistId }));
    const { url } = this.googleCalendar.getAuthUrl(state);
    return { url, state };
  }

  async handleGoogleCallback(
    code: string,
    state: string,
  ): Promise<{ id: string } | null> {
    const cached = state ? await this.redis.get(STATE_PREFIX + state) : null;
    if (!cached) return null;
    await this.redis.del(STATE_PREFIX + state);
    const { tenantId, psychologistId } = JSON.parse(cached) as { tenantId: string; psychologistId: string };
    return this.googleCalendar.exchangeCodeAndSave(
      code,
      state,
      tenantId,
      psychologistId,
    );
  }

  async getOutlookAuthUrl(tenantId: string, psychologistId: string): Promise<{ url: string; state: string }> {
    const state = `${tenantId}:${psychologistId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    await this.redis.setex(STATE_PREFIX + state, STATE_TTL, JSON.stringify({ tenantId, psychologistId }));
    return this.outlookCalendar.getAuthUrl(state);
  }

  async handleOutlookCallback(
    code: string,
    state: string,
  ): Promise<{ id: string } | null> {
    const cached = state ? await this.redis.get(STATE_PREFIX + state) : null;
    if (!cached) return null;
    await this.redis.del(STATE_PREFIX + state);
    const { tenantId, psychologistId } = JSON.parse(cached) as { tenantId: string; psychologistId: string };
    return this.outlookCalendar.exchangeCodeAndSave(code, tenantId, psychologistId);
  }

  async list(tenantId: string, psychologistId?: string) {
    const where: { tenantId: string; psychologistId?: string } = { tenantId };
    if (psychologistId) where.psychologistId = psychologistId;

    const list = await this.prisma.calendarIntegration.findMany({
      where,
      select: {
        id: true,
        provider: true,
        calendarId: true,
        createdAt: true,
      },
    });
    return list;
  }

  async disconnect(id: string, tenantId: string): Promise<void> {
    const integration = await this.prisma.calendarIntegration.findFirst({
      where: { id, tenantId },
    });
    if (!integration) throw new NotFoundException('Entegrasyon bulunamadı');
    await this.prisma.calendarIntegration.delete({ where: { id } });
  }

  async triggerSync(integrationId: string, tenantId: string): Promise<void> {
    const integration = await this.prisma.calendarIntegration.findFirst({
      where: { id: integrationId, tenantId },
    });
    if (!integration) throw new NotFoundException('Entegrasyon bulunamadı');
    await this.syncQueue.add('incremental', { integrationId });
  }

  /** Webhook: Google push notification — channelId ile integration bulup sync tetikler */
  async handleWebhook(channelId: string): Promise<boolean> {
    const integration = await this.prisma.calendarIntegration.findFirst({
      where: { channelId, provider: 'GOOGLE' },
    });
    if (!integration) return false;
    await this.syncQueue.add('incremental', { integrationId: integration.id });
    return true;
  }
}
