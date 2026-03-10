import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { TokenEncryptionService } from '../calendar-sync/token-encryption.service';
import { VideoProvider } from 'prisma-client';

const ZOOM_API = 'https://api.zoom.us/v2';
const ZOOM_OAUTH = 'https://zoom.us/oauth';
const SCOPES = ['meeting:write', 'meeting:read', 'user:read'];

export interface ZoomOAuthUrlResult {
  url: string;
  state: string;
}

export interface CreateMeetingResult {
  meetingUrl: string;
  hostUrl: string;
  meetingId: string;
}

@Injectable()
export class ZoomService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  private getRedirectUri(): string {
    return (
      this.config.get('ZOOM_REDIRECT_URI') ??
      `${this.config.get('API_URL', 'http://localhost:3001')}/video-integrations/zoom/callback`
    );
  }

  getAuthUrl(state: string): ZoomOAuthUrlResult {
    const clientId = this.config.get('ZOOM_CLIENT_ID');
    if (!clientId) throw new Error('ZOOM_CLIENT_ID not configured');
    const redirectUri = encodeURIComponent(this.getRedirectUri());
    const scope = encodeURIComponent(SCOPES.join(' '));
    const url = `${ZOOM_OAUTH}/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${encodeURIComponent(state)}`;
    return { url, state };
  }

  async exchangeCodeAndSave(
    code: string,
    tenantId: string,
    psychologistId: string,
  ): Promise<{ id: string }> {
    const clientId = this.config.get('ZOOM_CLIENT_ID');
    const clientSecret = this.config.get('ZOOM_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new Error('Zoom OAuth not configured');
    }

    const redirectUri = this.getRedirectUri();
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(`${ZOOM_OAUTH}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Zoom token exchange failed: ${err}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const { ciphertext: encAccess, nonce: accessNonce } =
      this.tokenEncryption.encrypt(data.access_token);
    const refreshToken = data.refresh_token ?? '';
    const { ciphertext: encRefresh, nonce: refreshNonce } =
      refreshToken
        ? this.tokenEncryption.encrypt(refreshToken)
        : { ciphertext: Buffer.alloc(0), nonce: Buffer.alloc(0) };

    const expiry = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null;

    const integration = await this.prisma.videoIntegration.upsert({
      where: {
        tenantId_psychologistId_provider: {
          tenantId,
          psychologistId,
          provider: VideoProvider.ZOOM,
        },
      },
      create: {
        tenantId,
        psychologistId,
        provider: VideoProvider.ZOOM,
        encryptedAccessToken: encAccess,
        encryptedRefreshToken: encRefresh.length ? encRefresh : undefined,
        tokenNonce: accessNonce,
        refreshTokenNonce: refreshNonce.length ? refreshNonce : undefined,
        accessTokenExpiry: expiry,
      },
      update: {
        encryptedAccessToken: encAccess,
        encryptedRefreshToken: encRefresh.length ? encRefresh : undefined,
        tokenNonce: accessNonce,
        refreshTokenNonce: refreshNonce.length ? refreshNonce : undefined,
        accessTokenExpiry: expiry,
      },
    });

    return { id: integration.id };
  }

  private async getAccessToken(integrationId: string): Promise<string> {
    const integration = await this.prisma.videoIntegration.findFirst({
      where: { id: integrationId, provider: VideoProvider.ZOOM },
    });
    if (!integration) throw new NotFoundException('Zoom entegrasyonu bulunamadı');

    let accessToken = this.tokenEncryption.decrypt(
      integration.encryptedAccessToken as Buffer,
      integration.tokenNonce as Buffer,
    );

    if (
      integration.accessTokenExpiry &&
      new Date() >= new Date(integration.accessTokenExpiry.getTime() - 5 * 60 * 1000)
    ) {
      const refreshToken =
        integration.encryptedRefreshToken && integration.refreshTokenNonce
          ? this.tokenEncryption.decrypt(
              integration.encryptedRefreshToken as Buffer,
              integration.refreshTokenNonce as Buffer,
            )
          : null;
      if (!refreshToken) throw new Error('Zoom refresh token yok');

      const clientId = this.config.get('ZOOM_CLIENT_ID');
      const clientSecret = this.config.get('ZOOM_CLIENT_SECRET');
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const res = await fetch(`${ZOOM_OAUTH}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });
      if (!res.ok) throw new Error('Zoom token yenileme başarısız');
      const data = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      accessToken = data.access_token;
      const { ciphertext, nonce } = this.tokenEncryption.encrypt(accessToken);
      const newExpiry = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null;
      await this.prisma.videoIntegration.update({
        where: { id: integrationId },
        data: {
          encryptedAccessToken: ciphertext,
          tokenNonce: nonce,
          accessTokenExpiry: newExpiry,
        },
      });
    }

    return accessToken;
  }

  async createMeeting(
    integrationId: string,
    topic: string,
    startTime: Date,
    duration: number,
  ): Promise<CreateMeetingResult> {
    const token = await this.getAccessToken(integrationId);
    const body = {
      topic: topic.slice(0, 200),
      type: 2,
      start_time: startTime.toISOString(),
      duration,
      timezone: 'Europe/Istanbul',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        waiting_room: true,
      },
    };

    const res = await fetch(`${ZOOM_API}/users/me/meetings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Zoom meeting oluşturulamadı: ${err}`);
    }

    const data = (await res.json()) as {
      id: string;
      join_url: string;
      start_url: string;
    };
    return {
      meetingId: data.id,
      meetingUrl: data.join_url,
      hostUrl: data.start_url,
    };
  }

  async deleteMeeting(integrationId: string, meetingId: string): Promise<void> {
    const token = await this.getAccessToken(integrationId);
    const res = await fetch(`${ZOOM_API}/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.text();
      throw new Error(`Zoom meeting silinemedi: ${err}`);
    }
  }
}
