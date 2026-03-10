import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
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

const appointmentReminderQueue = BullModule.registerQueue({
  name: 'appointment-reminder-run',
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
    ScoringProcessor,
    CrisisAlertProcessor,
    AppointmentNotificationProcessor,
    SmsProcessor,
    EmailProcessor,
    AppointmentReminderProcessor,
    AppointmentReminderScheduler,
    PaymentReminderProcessor,
    PaymentReminderScheduler,
  ],
  exports: [BullModule],
})
export class QueueModule {}
