import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../../modules/common/services/notification.service';
/** 24 saat önce hatırlatma: Her gün 09:00'da yarının randevuları → SMS/email */
/** 1 saat önce hatırlatma: Her saat başı → SMS */
@Injectable()
export class AppointmentReminderScheduler implements OnModuleInit {
  constructor(@InjectQueue('appointment-reminder-run') private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      'run-24h',
      {},
      {
        repeat: { pattern: '0 9 * * *', tz: 'Europe/Istanbul' },
        jobId: 'appointment-reminder-24h',
      },
    );
    await this.queue.add(
      'run-1h',
      {},
      {
        repeat: { pattern: '0 * * * *', tz: 'Europe/Istanbul' },
        jobId: 'appointment-reminder-1h',
      },
    );
  }
}
