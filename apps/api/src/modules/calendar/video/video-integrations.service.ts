import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../../database/prisma.service';
import { ZoomService } from './zoom.service';
import { REDIS_CLIENT } from '../scheduling/appointments.service';

const STATE_PREFIX = 'video:oauth:state:';
const STATE_TTL = 600;

@Injectable()
export class VideoIntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zoomService: ZoomService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getZoomAuthUrl(tenantId: string, psychologistId: string): Promise<{ url: string; state: string }> {
    const state = `${tenantId}:${psychologistId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    await this.redis.setex(STATE_PREFIX + state, STATE_TTL, JSON.stringify({ tenantId, psychologistId }));
    return this.zoomService.getAuthUrl(state);
  }

  async handleZoomCallback(code: string, state: string): Promise<{ id: string } | null> {
    const cached = state ? await this.redis.get(STATE_PREFIX + state) : null;
    if (!cached) return null;
    await this.redis.del(STATE_PREFIX + state);
    const { tenantId, psychologistId } = JSON.parse(cached) as { tenantId: string; psychologistId: string };
    return this.zoomService.exchangeCodeAndSave(code, tenantId, psychologistId);
  }

  async listVideo(tenantId: string, psychologistId?: string) {
    const where: { tenantId: string; psychologistId?: string } = { tenantId };
    if (psychologistId) where.psychologistId = psychologistId;

    const list = await this.prisma.videoIntegration.findMany({
      where,
      select: {
        id: true,
        provider: true,
        createdAt: true,
      },
    });
    return list;
  }

  async disconnectVideo(id: string, tenantId: string): Promise<void> {
    const integration = await this.prisma.videoIntegration.findFirst({
      where: { id, tenantId },
    });
    if (!integration) throw new NotFoundException('Video entegrasyonu bulunamadı');
    await this.prisma.videoIntegration.delete({ where: { id } });
  }
}
