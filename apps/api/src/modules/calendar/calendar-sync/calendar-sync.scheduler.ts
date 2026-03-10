import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class CalendarSyncScheduler implements OnModuleInit {
  constructor(@InjectQueue('calendar-sync') private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      'poll-all',
      {},
      {
        repeat: { every: POLL_INTERVAL_MS },
        jobId: 'calendar-sync-poll-all',
      },
    );
  }
}
