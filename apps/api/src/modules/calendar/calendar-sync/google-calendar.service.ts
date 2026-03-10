import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { PrismaService } from '../../../database/prisma.service';
import { TokenEncryptionService } from './token-encryption.service';
import { CalendarProvider } from 'prisma-client';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

export interface OAuthUrlResult {
  url: string;
  state: string;
}

@Injectable()
export class GoogleCalendarService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  private getOAuth2Client() {
    return new google.auth.OAuth2(
      this.config.get('GOOGLE_CLIENT_ID'),
      this.config.get('GOOGLE_CLIENT_SECRET'),
      this.config.get('GOOGLE_CALENDAR_REDIRECT_URI') ??
        `${this.config.get('API_URL', 'http://localhost:3001')}/calendar-integrations/google/callback`,
    );
  }

  getAuthUrl(state: string): OAuthUrlResult {
    const oauth2 = this.getOAuth2Client();
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state,
    });
    return { url, state };
  }

  async exchangeCodeAndSave(
    code: string,
    state: string,
    tenantId: string,
    psychologistId: string,
  ): Promise<{ id: string }> {
    const oauth2 = this.getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Google did not return access_token or refresh_token');
    }

    const { ciphertext: encAccess, nonce: accessNonce } =
      this.tokenEncryption.encrypt(tokens.access_token);
    const { ciphertext: encRefresh, nonce: refreshNonce } =
      this.tokenEncryption.encrypt(tokens.refresh_token);

    const expiry = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : null;

    const integration = await this.prisma.calendarIntegration.upsert({
      where: {
        tenantId_psychologistId_provider: {
          tenantId,
          psychologistId,
          provider: CalendarProvider.GOOGLE,
        },
      },
      create: {
        tenantId,
        psychologistId,
        provider: CalendarProvider.GOOGLE,
        calendarId: 'primary',
        encryptedAccessToken: encAccess,
        encryptedRefreshToken: encRefresh,
        tokenNonce: accessNonce,
        refreshTokenNonce: refreshNonce,
        accessTokenExpiry: expiry,
      },
      update: {
        encryptedAccessToken: encAccess,
        encryptedRefreshToken: encRefresh,
        tokenNonce: accessNonce,
        refreshTokenNonce: refreshNonce,
        accessTokenExpiry: expiry,
        syncToken: null,
      },
    });

    return { id: integration.id };
  }

  private async getDecryptedTokens(integrationId: string) {
    const integration = await this.prisma.calendarIntegration.findFirst({
      where: { id: integrationId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    let accessToken = this.tokenEncryption.decrypt(
      integration.encryptedAccessToken as Buffer,
      integration.tokenNonce as Buffer,
    );

    const expiry = integration.accessTokenExpiry;
    if (expiry && new Date() >= new Date(expiry.getTime() - 5 * 60 * 1000)) {
      const refreshToken = this.tokenEncryption.decrypt(
        integration.encryptedRefreshToken as Buffer,
        integration.refreshTokenNonce as Buffer,
      );
      const oauth2 = this.getOAuth2Client();
      oauth2.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await oauth2.refreshAccessToken();
      if (credentials.access_token) {
        accessToken = credentials.access_token;
        const { ciphertext, nonce } = this.tokenEncryption.encrypt(accessToken);
        const newExpiry = credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : null;
        await this.prisma.calendarIntegration.update({
          where: { id: integrationId },
          data: {
            encryptedAccessToken: ciphertext,
            tokenNonce: nonce,
            accessTokenExpiry: newExpiry,
          },
        });
      }
    }

    const refreshToken = this.tokenEncryption.decrypt(
      integration.encryptedRefreshToken as Buffer,
      integration.refreshTokenNonce as Buffer,
    );

    return { accessToken, refreshToken, integration };
  }

  async pushToGoogle(
    integrationId: string,
    appointment: {
      id: string;
      startTime: Date;
      endTime: Date;
      durationMinutes: number;
      googleEventId?: string | null;
    },
  ): Promise<string> {
    const { accessToken, integration } = await this.getDecryptedTokens(integrationId);
    const oauth2 = this.getOAuth2Client();
    oauth2.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });

    const event: calendar_v3.Schema$Event = {
      summary: 'Randevu',
      description: 'Psikoport randevusu',
      start: {
        dateTime: new Date(appointment.startTime).toISOString(),
        timeZone: 'Europe/Istanbul',
      },
      end: {
        dateTime: new Date(appointment.endTime).toISOString(),
        timeZone: 'Europe/Istanbul',
      },
      extendedProperties: {
        private: { psikoportAppointmentId: appointment.id },
      },
    };

    if (appointment.googleEventId) {
      const res = await calendar.events.patch({
        calendarId: integration.calendarId,
        eventId: appointment.googleEventId,
        requestBody: event,
      });
      return res.data.id ?? appointment.googleEventId;
    }

    const res = await calendar.events.insert({
      calendarId: integration.calendarId,
      requestBody: event,
    });
    return res.data.id ?? '';
  }

  async pullFromGoogle(integrationId: string): Promise<void> {
    const { accessToken, integration } = await this.getDecryptedTokens(integrationId);
    const oauth2 = this.getOAuth2Client();
    oauth2.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });

    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId: integration.calendarId,
      singleEvents: true,
      orderBy: 'startTime',
    };
    if (integration.syncToken) {
      params.syncToken = integration.syncToken;
    } else {
      params.timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    let nextSyncToken: string | undefined;
    let nextPageToken: string | undefined;

    do {
      if (nextPageToken) params.pageToken = nextPageToken;
      const res = await calendar.events.list(params);
      nextPageToken = res.data.nextPageToken ?? undefined;
      if (res.data.nextSyncToken) nextSyncToken = res.data.nextSyncToken;

      const events = res.data.items ?? [];
      for (const ev of events) {
        if (!ev.id) continue;
        if (ev.status === 'cancelled') {
          await this.prisma.externalCalendarEvent.updateMany({
            where: {
              calendarIntegrationId: integrationId,
              googleEventId: ev.id,
            },
            data: { deleted: true },
          });
          continue;
        }
        const start = ev.start?.dateTime ?? ev.start?.date;
        const end = ev.end?.dateTime ?? ev.end?.date;
        if (!start || !end) continue;

        const startTime = new Date(start);
        const endTime = new Date(end);
        if (ev.organizer?.self || ev.extendedProperties?.private?.psikoportAppointmentId) {
          continue;
        }

        await this.prisma.externalCalendarEvent.upsert({
          where: {
            calendarIntegrationId_googleEventId: {
              calendarIntegrationId: integrationId,
              googleEventId: ev.id,
            },
          },
          create: {
            tenantId: integration.tenantId,
            psychologistId: integration.psychologistId,
            calendarIntegrationId: integrationId,
            googleEventId: ev.id,
            startTime,
            endTime,
            summary: 'Meşgul',
          },
          update: {
            startTime,
            endTime,
            summary: 'Meşgul',
            deleted: false,
          },
        });
      }
    } while (nextPageToken);

    if (nextSyncToken) {
      await this.prisma.calendarIntegration.update({
        where: { id: integrationId },
        data: { syncToken: nextSyncToken },
      });
    }
  }

  handleWebhook(payload: { channelId?: string }): { integrationId?: string } {
    return {};
  }
}
