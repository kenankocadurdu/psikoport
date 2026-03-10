import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { TokenEncryptionService } from './token-encryption.service';
import { CalendarProvider } from 'prisma-client';

const MICROSOFT_TENANT_ID = 'common';
const SCOPES = [
  'https://graph.microsoft.com/Calendars.ReadWrite',
  'https://graph.microsoft.com/Calendars.Read',
  'offline_access',
].join(' ');
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export interface OutlookOAuthUrlResult {
  url: string;
  state: string;
}

@Injectable()
export class OutlookCalendarService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  private getRedirectUri(): string {
    return (
      this.config.get('MICROSOFT_CALENDAR_REDIRECT_URI') ??
      `${this.config.get('API_URL', 'http://localhost:3001')}/calendar-integrations/outlook/callback`
    );
  }

  getAuthUrl(state: string): OutlookOAuthUrlResult {
    const clientId = this.config.get('MICROSOFT_CLIENT_ID');
    if (!clientId) throw new Error('MICROSOFT_CLIENT_ID not configured');
    const redirectUri = encodeURIComponent(this.getRedirectUri());
    const scope = encodeURIComponent(SCOPES);
    const url =
      `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize?` +
      `client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}` +
      `&scope=${scope}&state=${encodeURIComponent(state)}&response_mode=query&prompt=consent`;
    return { url, state };
  }

  async exchangeCodeAndSave(
    code: string,
    tenantId: string,
    psychologistId: string,
  ): Promise<{ id: string }> {
    const clientId = this.config.get('MICROSOFT_CLIENT_ID');
    const clientSecret = this.config.get('MICROSOFT_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new Error('Microsoft OAuth not configured');
    }

    const redirectUri = this.getRedirectUri();
    const res = await fetch(
      `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: SCOPES,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Microsoft token exchange failed: ${err}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const { ciphertext: encAccess, nonce: accessNonce } =
      this.tokenEncryption.encrypt(data.access_token);
    const { ciphertext: encRefresh, nonce: refreshNonce } =
      this.tokenEncryption.encrypt(data.refresh_token);

    const expiry = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null;

    const integration = await this.prisma.calendarIntegration.upsert({
      where: {
        tenantId_psychologistId_provider: {
          tenantId,
          psychologistId,
          provider: CalendarProvider.MICROSOFT,
        },
      },
      create: {
        tenantId,
        psychologistId,
        provider: CalendarProvider.MICROSOFT,
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
      where: { id: integrationId, provider: CalendarProvider.MICROSOFT },
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

      const clientId = this.config.get('MICROSOFT_CLIENT_ID');
      const clientSecret = this.config.get('MICROSOFT_CLIENT_SECRET');
      const res = await fetch(
        `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId!,
            client_secret: clientSecret!,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
            scope: SCOPES,
          }),
        },
      );
      if (!res.ok) throw new Error('Microsoft token refresh failed');
      const data = (await res.json()) as {
        access_token: string;
        expires_in: number;
      };
      accessToken = data.access_token;
      const { ciphertext, nonce } = this.tokenEncryption.encrypt(accessToken);
      const newExpiry = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
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

    return { accessToken, integration };
  }

  async pushToOutlook(
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

    const calendarPath =
      integration.calendarId === 'primary' ? '/me/calendar' : `/me/calendars/${integration.calendarId}`;
    const eventsPath = `${calendarPath}/events`;

    const body = {
      subject: 'Randevu',
      body: { contentType: 'text', content: 'Psikoport randevusu' },
      start: {
        dateTime: new Date(appointment.startTime).toISOString(),
        timeZone: 'Europe/Istanbul',
      },
      end: {
        dateTime: new Date(appointment.endTime).toISOString(),
        timeZone: 'Europe/Istanbul',
      },
      singleValueExtendedProperties: [
        {
          id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name psikoportAppointmentId',
          value: appointment.id,
        },
      ],
    };

    if (appointment.googleEventId) {
      const res = await fetch(`${GRAPH_BASE}${eventsPath}/${appointment.googleEventId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Graph PATCH failed: ${await res.text()}`);
      const data = (await res.json()) as { id: string };
      return data.id ?? appointment.googleEventId;
    }

    const res = await fetch(`${GRAPH_BASE}${eventsPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Graph POST failed: ${await res.text()}`);
    const data = (await res.json()) as { id: string };
    return data.id ?? '';
  }

  async pullFromOutlook(integrationId: string): Promise<void> {
    const { accessToken, integration } = await this.getDecryptedTokens(integrationId);

    const calendarPath =
      integration.calendarId === 'primary' ? '/me/calendar' : `/me/calendars/${integration.calendarId}`;
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    let url: string;
    if (integration.syncToken) {
      url = integration.syncToken;
    } else {
      const startStr = start.toISOString();
      const endStr = end.toISOString();
      url =
        `${GRAPH_BASE}${calendarPath}/calendarView/delta?startDateTime=${encodeURIComponent(startStr)}&endDateTime=${encodeURIComponent(endStr)}`;
    }

    let nextDeltaLink: string | null = null;

    do {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Graph delta failed: ${await res.text()}`);

      const data = (await res.json()) as {
        value: Array<{
          id?: string;
          '@odata.type'?: string;
          isCancelled?: boolean;
          start?: { dateTime: string; timeZone: string };
          end?: { dateTime: string; timeZone: string };
          organizer?: { emailAddress?: { address?: string } };
          singleValueExtendedProperties?: Array<{ value?: string }>;
        }>;
        '@odata.nextLink'?: string;
        '@odata.deltaLink'?: string;
      };

      for (const ev of data.value ?? []) {
        if (!ev.id || ev['@odata.type']?.includes('deleted')) continue;
        if (ev.isCancelled) {
          await this.prisma.externalCalendarEvent.updateMany({
            where: {
              calendarIntegrationId: integrationId,
              googleEventId: ev.id,
            },
            data: { deleted: true },
          });
          continue;
        }
        const startDt = ev.start?.dateTime;
        const endDt = ev.end?.dateTime;
        if (!startDt || !endDt) continue;

        const isPsikoport = ev.singleValueExtendedProperties?.some(
          (p: { id?: string; value?: string }) => p.id?.includes('psikoportAppointmentId'),
        );
        if (isPsikoport) continue;

        const startTime = new Date(startDt);
        const endTime = new Date(endDt);

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

      url = data['@odata.nextLink'] ?? '';
      if (data['@odata.deltaLink']) nextDeltaLink = data['@odata.deltaLink'];
    } while (url);

    if (nextDeltaLink) {
      await this.prisma.calendarIntegration.update({
        where: { id: integrationId },
        data: { syncToken: nextDeltaLink },
      });
    }
  }

  handleWebhook(payload: { value?: Array<{ subscriptionId?: string }> }): { integrationId?: string } {
    return {};
  }
}
