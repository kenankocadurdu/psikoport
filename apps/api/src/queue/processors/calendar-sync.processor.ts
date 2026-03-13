import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { CalendarSyncService } from '../../modules/calendar/calendar-sync/calendar-sync.service';
import { runWithTenantContext } from '../../modules/common/context';

export interface CalendarSyncJobData {
  integrationId?: string;
}

@Processor('calendar-sync', {
  concurrency: 2,
  limiter: { max: 10, duration: 60 * 1000 },
})
export class CalendarSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(CalendarSyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarSync: CalendarSyncService,
  ) {
    super();
  }

  async process(job: Job<CalendarSyncJobData>): Promise<void> {
    const { integrationId } = job.data;

    if (integrationId) {
      await this.syncIntegration(integrationId);
      return;
    }

    const integrations = await this.prisma.calendarIntegration.findMany();
    for (const int of integrations) {
      try {
        await this.syncIntegration(int.id);
      } catch (err) {
        this.logger.warn(
          `Poll sync failed for ${int.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async syncIntegration(integrationId: string): Promise<void> {
    // Bootstrap query: fetch integration without ALS context to obtain tenantId
    const integration = await this.prisma.calendarIntegration.findUnique({
      where: { id: integrationId },
    });
    if (!integration) {
      this.logger.warn(`Integration ${integrationId} not found`);
      return;
    }

    await runWithTenantContext(
      { tenantId: integration.tenantId, userId: 'system' },
      async () => {
        await this.calendarSync.pull(integrationId, integration.provider);
        this.logger.log(`Calendar sync completed for integration ${integrationId}`);
      },
    );
  }
}
