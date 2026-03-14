import { Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectQueue, BullModule } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ScoringProcessor } from './processors/scoring.processor';
import { CrisisAlertProcessor } from './processors/crisis-alert.processor';
import { AppointmentNotificationProcessor } from './processors/appointment-notification.processor';
import { SmsProcessor } from './processors/sms.processor';
import { EmailProcessor } from './processors/email.processor';
import { AppointmentReminderProcessor } from './processors/appointment-reminder.processor';
import { AppointmentReminderScheduler } from './processors/appointment-reminder.scheduler';
import { PaymentReminderProcessor } from './processors/payment-reminder.processor';
import { PaymentReminderScheduler } from './processors/payment-reminder.scheduler';
import { PrismaModule } from '../database/prisma.module';
import { NotificationModule } from '../modules/common/services/notification.module';
import { MetricsService } from '../modules/common/services/metrics.service';
import { DekCacheService } from '../modules/common/services/dek-cache.service';
import { IdempotencyGuard } from './guards/idempotency.guard';

const QUEUE_DEPTH_INTERVAL_MS = 15_000;

@Injectable()
class QueueDepthCollector implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    @InjectQueue('scoring') private readonly scoringQueue: Queue,
    @InjectQueue('payment-reminder-run') private readonly paymentQueue: Queue,
    @InjectQueue('crisis-alert') private readonly crisisQueue: Queue,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.collect(), QUEUE_DEPTH_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  private async collect(): Promise<void> {
    const sum = (counts: Record<string, number>) =>
      Object.values(counts).reduce((a, b) => a + b, 0);

    const [sc, pc, cc] = await Promise.all([
      this.scoringQueue.getJobCounts('waiting', 'active', 'delayed'),
      this.paymentQueue.getJobCounts('waiting', 'active', 'delayed'),
      this.crisisQueue.getJobCounts('waiting', 'active', 'delayed'),
    ]);

    this.metrics.updateQueueDepth('scoring', sum(sc));
    this.metrics.updateQueueDepth('payment-reminder-run', sum(pc));
    this.metrics.updateQueueDepth('crisis-alert', sum(cc));
  }
}

const appointmentReminderQueue = BullModule.registerQueue({
  name: 'appointment-reminder-run',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

const appointmentNotificationQueue = BullModule.registerQueue({
  name: 'appointment-notification',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
  },
});

const scoringQueue = BullModule.registerQueue({
  name: 'scoring',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

const crisisAlertQueue = BullModule.registerQueue({
  name: 'crisis-alert',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

const calendarSyncQueue = BullModule.registerQueue({
  name: 'calendar-sync',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 50,
  },
});

const paymentReminderQueue = BullModule.registerQueue({
  name: 'payment-reminder-run',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    appointmentReminderQueue,
    scoringQueue,
    crisisAlertQueue,
    appointmentNotificationQueue,
    calendarSyncQueue,
    paymentReminderQueue,
  ],
  providers: [
    IdempotencyGuard,
    DekCacheService,
    MetricsService,
    ScoringProcessor,
    CrisisAlertProcessor,
    AppointmentNotificationProcessor,
    SmsProcessor,
    EmailProcessor,
    AppointmentReminderProcessor,
    AppointmentReminderScheduler,
    PaymentReminderProcessor,
    PaymentReminderScheduler,
    QueueDepthCollector,
  ],
  exports: [BullModule],
})
export class QueueModule {}
