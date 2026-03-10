import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { PrismaService } from '../../../database/prisma.service';
import { TokenEncryptionService } from '../calendar-sync/token-encryption.service';
import { CalendarProvider } from 'prisma-client';
import { randomBytes } from 'crypto';

export interface CreateMeetResult {
  meetingUrl: string;
  hostUrl: string;
  eventId: string;
}

@Injectable()
export class GoogleMeetService {
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

  private async getDecryptedTokens(integrationId: string) {
    const integration = await this.prisma.calendarIntegration.findFirst({
      where: { id: integrationId, provider: CalendarProvider.GOOGLE },
    });
    if (!integration) throw new NotFoundException('Google Calendar entegrasyonu bulunamadı');

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

    return { accessToken, integration };
  }

  async createMeetEvent(
    integrationId: string,
    topic: string,
    startTime: Date,
    endTime: Date,
    appointmentId?: string,
  ): Promise<CreateMeetResult> {
    const { accessToken, integration } = await this.getDecryptedTokens(integrationId);
    const oauth2 = this.getOAuth2Client();
    oauth2.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });

    const requestId = randomBytes(16).toString('hex');
    const event: calendar_v3.Schema$Event = {
      summary: topic || 'Online Görüşme',
      description: 'Psikoport online görüşme',
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Europe/Istanbul',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Europe/Istanbul',
      },
      conferenceData: {
        createRequest: {
          conferenceSolutionKey: { type: 'hangoutsMeet' },
          requestId,
        },
      },
      extendedProperties: appointmentId
        ? { private: { psikoportAppointmentId: appointmentId } }
        : undefined,
    };

    const res = await calendar.events.insert({
      calendarId: integration.calendarId,
      conferenceDataVersion: 1,
      requestBody: event,
    });

    const entryPoints = res.data.conferenceData?.entryPoints ?? [];
    const videoEntry = entryPoints.find(
      (e) => e.entryPointType === 'video' || e.entryPointType === 'more',
    );
    const meetUrl = videoEntry?.uri ?? res.data.htmlLink ?? '';

    return {
      meetingUrl: meetUrl,
      hostUrl: meetUrl,
      eventId: res.data.id ?? '',
    };
  }
}
