import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class WebhookIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async isProcessed(provider: string, eventId: string): Promise<boolean> {
    const existing = await this.prisma.processedWebhookEvent.findUnique({
      where: { provider_eventId: { provider, eventId } },
      select: { id: true },
    });
    return existing !== null;
  }

  async markProcessed(
    provider: string,
    eventId: string,
    eventType: string,
  ): Promise<void> {
    await this.prisma.processedWebhookEvent.create({
      data: { provider, eventId, eventType },
    });
  }
}
