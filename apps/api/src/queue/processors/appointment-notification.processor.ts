import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../../modules/common/services/notification.service';
import type { AppointmentNotificationJobData } from '../../modules/calendar/scheduling/types';
import { runWithTenantContext } from '../../modules/common/context';

@Processor('appointment-notification', {
  concurrency: 3,
})
export class AppointmentNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(AppointmentNotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<AppointmentNotificationJobData>): Promise<void> {
    const { appointmentId, tenantId, type, reason, videoMeetingUrl } = job.data;

    await runWithTenantContext({ tenantId, userId: 'system' }, async () => {
      const appt = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { status: true },
      });
      if (!appt) {
        this.logger.warn(`Appointment ${appointmentId} not found, skipping ${type} notification`);
        return;
      }
      if (type !== 'cancelled' && appt.status !== 'SCHEDULED') {
        this.logger.warn(`Appointment ${appointmentId} is ${appt.status}, skipping ${type} notification`);
        return;
      }

      if (type === 'created' && videoMeetingUrl) {
        await this.handleCreated(appointmentId, videoMeetingUrl);
      }

      if (type === 'cancelled') {
        this.logger.log(
          `Appointment ${appointmentId} cancelled. Reason: ${reason ?? 'n/a'}`,
        );
        // TODO: Send SMS/email via NotificationService
      }

      if (type === 'reminder') {
        this.logger.log(`Appointment ${appointmentId} reminder`);
        // Handled by appointment-reminder cron
      }
    });
  }

  private async handleCreated(
    appointmentId: string,
    videoMeetingUrl: string,
  ): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: { select: { phone: true, firstName: true, lastName: true } },
      },
    });
    if (!appointment?.client?.phone) return;

    const msg = `Online gorusmeniz icin baglanti: ${videoMeetingUrl} - Psikoport`;
    await this.notification.sendSms(appointment.client.phone, msg, 'appointment-confirmation');
    this.logger.log(`Appointment created SMS sent for ${appointmentId}`);
  }
}
