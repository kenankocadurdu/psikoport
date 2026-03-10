import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(
      {
        name: 'sms',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
        },
      },
      {
        name: 'email',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
        },
      },
    ),
  ],
  providers: [NotificationService],
  exports: [NotificationService, BullModule],
})
export class NotificationModule {}
