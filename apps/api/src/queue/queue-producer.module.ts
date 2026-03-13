import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

/**
 * Producer-only queue module for the API process.
 * Registers all queues so services can inject them with @InjectQueue(),
 * but does NOT register any Processor or Scheduler providers.
 * Consumers run exclusively in the Worker container (WorkerModule → QueueModule).
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: 'scoring' }),
    BullModule.registerQueue({ name: 'crisis-alert' }),
    BullModule.registerQueue({ name: 'appointment-notification' }),
    BullModule.registerQueue({ name: 'calendar-sync' }),
    BullModule.registerQueue({ name: 'appointment-reminder-run' }),
    BullModule.registerQueue({ name: 'payment-reminder-run' }),
  ],
  exports: [BullModule],
})
export class QueueProducerModule {}
