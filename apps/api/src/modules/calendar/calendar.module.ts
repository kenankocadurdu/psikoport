import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { PrismaModule } from '../../database/prisma.module';
import { QueueModule } from '../../queue/queue.module';
import { AppointmentsController } from './scheduling/appointments.controller';
import { PsychologistsAvailabilityController } from './psychologists-availability.controller';
import { AppointmentsService } from './scheduling/appointments.service';
import { AvailabilityService } from './scheduling/availability.service';
import { REDIS_CLIENT } from './scheduling/appointments.service';
import { CalendarIntegrationsController } from './calendar-integrations/calendar-integrations.controller';
import { CalendarIntegrationsService } from './calendar-integrations/calendar-integrations.service';
import { GoogleCalendarService } from './calendar-sync/google-calendar.service';
import { OutlookCalendarService } from './calendar-sync/outlook-calendar.service';
import { CalendarSyncService } from './calendar-sync/calendar-sync.service';
import { TokenEncryptionService } from './calendar-sync/token-encryption.service';
import { CalendarSyncProcessor } from '../../queue/processors/calendar-sync.processor';
import { CalendarSyncScheduler } from './calendar-sync/calendar-sync.scheduler';
import { ZoomService } from './video/zoom.service';
import { GoogleMeetService } from './video/google-meet.service';
import { VideoService } from './video/video.service';
import { VideoIntegrationsController } from './video/video-integrations.controller';
import { VideoIntegrationsService } from './video/video-integrations.service';
import { FinanceModule } from '../finance/finance.module';
import { SubscriptionModule } from '../subscriptions/subscription.module';

@Module({
  imports: [
    PrismaModule,
    FinanceModule,
    SubscriptionModule,
    ConfigModule,
    QueueModule,
    BullModule.registerQueue({ name: 'appointment-notification' }),
  ],
  controllers: [
    AppointmentsController,
    PsychologistsAvailabilityController,
    CalendarIntegrationsController,
    VideoIntegrationsController,
  ],
  providers: [
    AppointmentsService,
    AvailabilityService,
    TokenEncryptionService,
    GoogleCalendarService,
    OutlookCalendarService,
    CalendarSyncService,
    ZoomService,
    GoogleMeetService,
    VideoService,
    VideoIntegrationsService,
    CalendarIntegrationsService,
    CalendarSyncProcessor,
    CalendarSyncScheduler,
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        return url
          ? new Redis(url, { maxRetriesPerRequest: null })
          : new Redis({
              host: config.get('REDIS_HOST', 'localhost'),
              port: config.get('REDIS_PORT', 6379),
              password: config.get('REDIS_PASSWORD'),
              maxRetriesPerRequest: null,
            });
      },
      inject: [ConfigService],
    },
  ],
  exports: [AppointmentsService, AvailabilityService],
})
export class CalendarModule {}
