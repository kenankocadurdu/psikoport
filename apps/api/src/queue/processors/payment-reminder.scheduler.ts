import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/** Ödeme hatırlatma: Her gün 10:00'da reminder_days geçmiş ödenmemiş seanslar → SMS */
@Injectable()
export class PaymentReminderScheduler implements OnModuleInit {
  constructor(
    @InjectQueue('payment-reminder-run') private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      'run-daily',
      {},
      {
        repeat: { pattern: '0 10 * * *', tz: 'Europe/Istanbul' },
        jobId: 'payment-reminder-daily',
      },
    );
  }
}
