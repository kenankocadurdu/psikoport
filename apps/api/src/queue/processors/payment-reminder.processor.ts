import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../../modules/common/services/notification.service';
import { runWithTenantContext } from '../../modules/common/context';

interface SendReminderJobData {
  paymentId: string;
  tenantId: string;
  phone: string;
  amount: number;
  sessionDateStr: string;
}

@Processor('payment-reminder-run', {
  concurrency: 5,
})
export class PaymentReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
    @InjectQueue('payment-reminder-run') private readonly selfQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'run-daily') {
      await this.fanOut();
    } else if (job.name === 'send-reminder') {
      await this.sendReminder(job as Job<SendReminderJobData>);
    }
  }

  /**
   * Fan-out: query all pending payments and enqueue one job per payment
   * with a deterministic jobId so BullMQ deduplicates on retry/re-trigger.
   */
  private async fanOut(): Promise<void> {
    const todayStr = new Date().toISOString().slice(0, 10);

    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let enqueued = 0;

    for (const tenant of tenants) {
      await runWithTenantContext({ tenantId: tenant.id, userId: 'system' }, async () => {
        const settings = await this.prisma.paymentSettings.findMany({
          where: { tenantId: tenant.id },
          select: { psychologistId: true, reminderDays: true },
        });

        for (const s of settings) {
          const payments = await this.prisma.sessionPayment.findMany({
            where: {
              tenantId: tenant.id,
              psychologistId: s.psychologistId,
              status: 'PENDING',
              sessionDate: {
                lte: new Date(Date.now() - s.reminderDays * 24 * 60 * 60 * 1000),
              },
              amount: { gt: 0 },
            },
            include: { client: { select: { phone: true } } },
          });

          for (const p of payments) {
            if (!p.client.phone) continue;

            await this.selfQueue.add(
              'send-reminder',
              {
                paymentId: p.id,
                tenantId: tenant.id,
                phone: p.client.phone,
                amount: Number(p.amount),
                sessionDateStr: p.sessionDate.toLocaleDateString('tr-TR'),
              } satisfies SendReminderJobData,
              {
                jobId: `pay-remind:${p.id}:${todayStr}`,
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
              },
            );
            enqueued++;
          }
        }
      });
    }

    this.logger.log(`Payment reminder fan-out: ${enqueued} jobs enqueued for ${todayStr}`);
  }

  /**
   * Per-payment job: send SMS and mark payment as reminded.
   * BullMQ jobId deduplication guarantees this runs at most once per
   * (paymentId, date) pair across retries and re-triggers.
   */
  private async sendReminder(job: Job<SendReminderJobData>): Promise<void> {
    const { paymentId, tenantId, phone, amount, sessionDateStr } = job.data;

    await runWithTenantContext({ tenantId, userId: 'system' }, async () => {
      const payment = await this.prisma.sessionPayment.findUnique({
        where: { id: paymentId },
        select: { status: true },
      });

      if (!payment || payment.status !== 'PENDING') {
        this.logger.log(`Payment ${paymentId} no longer pending, skipping reminder`);
        return;
      }

      const msg = `Seans ucretiniz (${amount} TL, ${sessionDateStr}) bekleniyor. Odeyebilirsiniz. Psikoport.`;
      await this.notification.sendSms(phone, msg, 'payment-reminder');

      await this.prisma.sessionPayment.update({
        where: { id: paymentId },
        data: { updatedAt: new Date() },
      });
    });
  }
}
