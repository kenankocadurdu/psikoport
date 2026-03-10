import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../../modules/common/services/notification.service';

@Processor('payment-reminder-run', {
  concurrency: 1,
})
export class PaymentReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<Record<string, never>>): Promise<void> {
    if (job.name !== 'run-daily') return;

    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let totalSent = 0;

    for (const tenant of tenants) {
      await this.prisma.$executeRaw`SELECT set_current_tenant(${tenant.id})`;

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
              lte: new Date(
                Date.now() - s.reminderDays * 24 * 60 * 60 * 1000,
              ),
            },
            amount: { gt: 0 },
          },
          include: {
            client: { select: { phone: true } },
          },
        });

        for (const p of payments) {
          if (!p.client.phone) continue;
          const amount = Number(p.amount);
          const dateStr = p.sessionDate.toLocaleDateString('tr-TR');
          const msg = `Seans ucretiniz (${amount} TL, ${dateStr}) bekleniyor. Odeyebilirsiniz. Psikoport.`;
          await this.notification.sendSms(
            p.client.phone,
            msg,
            'payment-reminder',
          );
          totalSent++;
        }
      }
    }

    this.logger.log(`Payment reminders: ${totalSent} SMS sent`);
  }
}
