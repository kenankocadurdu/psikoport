import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../../modules/common/services/notification.service';
import { runWithTenantContext } from '../../modules/common/context';
function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d;
}

function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setTime(d.getTime() + minutes * 60 * 1000);
  return d;
}

function formatAppointmentTime(date: Date): string {
  return date.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Processor('appointment-reminder-run', {
  concurrency: 1,
})
export class AppointmentReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(AppointmentReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<Record<string, never>>): Promise<void> {
    const jobName = job.name;

    if (jobName === 'run-24h') {
      await this.run24hReminders();
    } else if (jobName === 'run-1h') {
      await this.run1hReminders();
    }
  }

  private async run24hReminders(): Promise<void> {
    const now = new Date();
    const from = addHours(now, 23);
    const to = addHours(now, 25);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: 'SCHEDULED',
        startTime: { gte: from, lte: to },
      },
      include: {
        client: { select: { phone: true, email: true, firstName: true, lastName: true } },
      },
    });

    for (const apt of appointments) {
      await runWithTenantContext({ tenantId: apt.tenantId, userId: 'system' }, async () => {
        const clientName = `${apt.client.firstName} ${apt.client.lastName}`.trim() || 'Danışan';
        const timeText = formatAppointmentTime(apt.startTime);
        const videoSection = apt.videoMeetingUrl
          ? `<p>Online görüşme linki: <a href="${apt.videoMeetingUrl}" style="color: #2563eb;">Görüşmeye katıl</a></p>`
          : '';

        if (apt.client.phone) {
          const msg = `Yarin ${timeText} randevunuz var. Psikoport.`;
          await this.notification.sendSms(apt.client.phone, msg, 'appointment-reminder');
        }
        if (apt.client.email) {
          await this.notification.sendEmail(
            apt.client.email,
            'appointment-reminder',
            {
              clientName,
              timeText,
              videoMeetingSection: videoSection,
            },
            'appointment-reminder',
            'Randevu Hatırlatması — Psikoport',
          );
        }
      });
    }
    this.logger.log(`24h reminders: ${appointments.length} sent`);
  }

  private async run1hReminders(): Promise<void> {
    const now = new Date();
    const from = addMinutes(now, 55);
    const to = addMinutes(now, 65);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: 'SCHEDULED',
        startTime: { gte: from, lte: to },
      },
      include: {
        client: { select: { phone: true, firstName: true, lastName: true } },
      },
    });

    for (const apt of appointments) {
      await runWithTenantContext({ tenantId: apt.tenantId, userId: 'system' }, async () => {
        if (apt.client.phone) {
          const timeText = formatAppointmentTime(apt.startTime);
          const msg = `1 saat icinde randevunuz var: ${timeText}. Psikoport.`;
          await this.notification.sendSms(apt.client.phone, msg, 'appointment-reminder');
        }
      });
    }
    this.logger.log(`1h reminders: ${appointments.length} sent`);
  }
}
