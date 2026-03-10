import { Injectable } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import { OutlookCalendarService } from './outlook-calendar.service';
import { CalendarProvider } from 'prisma-client';

export interface PushAppointmentInput {
  integrationId: string;
  provider: CalendarProvider;
  appointment: {
    id: string;
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
    googleEventId?: string | null;
  };
}

@Injectable()
export class CalendarSyncService {
  constructor(
    private readonly googleCalendar: GoogleCalendarService,
    private readonly outlookCalendar: OutlookCalendarService,
  ) {}

  async push(
    integrationId: string,
    provider: CalendarProvider,
    appointment: PushAppointmentInput['appointment'],
  ): Promise<string> {
    if (provider === CalendarProvider.GOOGLE) {
      return this.googleCalendar.pushToGoogle(integrationId, {
        ...appointment,
        googleEventId: appointment.googleEventId,
      });
    }
    if (provider === CalendarProvider.MICROSOFT) {
      return this.outlookCalendar.pushToOutlook(integrationId, appointment);
    }
    throw new Error(`Unknown calendar provider: ${provider}`);
  }

  async pull(integrationId: string, provider: CalendarProvider): Promise<void> {
    if (provider === CalendarProvider.GOOGLE) {
      await this.googleCalendar.pullFromGoogle(integrationId);
      return;
    }
    if (provider === CalendarProvider.MICROSOFT) {
      await this.outlookCalendar.pullFromOutlook(integrationId);
      return;
    }
    throw new Error(`Unknown calendar provider: ${provider}`);
  }
}
