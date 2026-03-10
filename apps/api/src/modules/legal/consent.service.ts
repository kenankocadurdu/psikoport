import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConsentType } from 'prisma-client';
import * as Diff from 'diff';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function computeDiff(prevHtml: string, newHtml: string): string {
  const changes = Diff.diffLines(prevHtml, newHtml);
  const parts: string[] = [];
  for (const c of changes) {
    if (c.added) parts.push(`[+] ${c.value.replace(/\n/g, '\n[+] ')}`);
    else if (c.removed) parts.push(`[-] ${c.value.replace(/\n/g, '\n[-] ')}`);
  }
  return parts.join('').trim() || '(değişiklik yok)';
}

/** Required consent types for a client */
const REQUIRED_CONSENT_TYPES: ConsentType[] = [
  'KVKK_DATA_PROCESSING',
  'KVKK_SPECIAL_DATA',
  'PLATFORM_TOS',
];

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveConsentText(type: ConsentType): Promise<{
    id: string;
    consentType: string;
    version: number;
    title: string;
    bodyHtml: string;
    bodyHash: string;
    effectiveFrom: Date;
    diffFromPrevious?: string;
  } | null> {
    const now = new Date();
    const text = await this.prisma.consentText.findFirst({
      where: {
        consentType: type,
        effectiveFrom: { lte: now },
      },
      orderBy: { version: 'desc' },
    });
    if (!text) return null;
    return {
      id: text.id,
      consentType: text.consentType,
      version: text.version,
      title: text.title,
      bodyHtml: text.bodyHtml,
      bodyHash: text.bodyHash,
      effectiveFrom: text.effectiveFrom,
      diffFromPrevious: text.diffFromPrevious ?? undefined,
    };
  }

  /**
   * Create a new consent text version. Computes diff from previous version.
   * Use from seed or admin tool.
   */
  async createConsentTextVersion(
    consentType: ConsentType,
    version: number,
    title: string,
    bodyHtml: string,
    effectiveFrom: Date,
  ): Promise<{ id: string }> {
    const bodyHash = sha256(bodyHtml);
    const prev = await this.prisma.consentText.findFirst({
      where: { consentType },
      orderBy: { version: 'desc' },
    });
    const diffFromPrevious =
      prev && prev.version === version - 1 ? computeDiff(prev.bodyHtml, bodyHtml) : null;
    const text = await this.prisma.consentText.create({
      data: {
        consentType,
        version,
        title,
        bodyHtml,
        bodyHash,
        effectiveFrom,
        diffFromPrevious,
      },
    });
    return { id: text.id };
  }

  async grantConsent(
    tenantId: string,
    clientId: string | null,
    type: ConsentType,
    textVersion: number,
    bodyHash: string,
    ip?: string,
    userAgent?: string,
    userId?: string,
  ): Promise<{ id: string }> {
    const consentText = await this.prisma.consentText.findUnique({
      where: {
        consentType_version: { consentType: type, version: textVersion },
      },
    });
    if (!consentText) {
      throw new NotFoundException(
        `Rıza metni bulunamadı: ${type} v${textVersion}`,
      );
    }
    if (consentText.bodyHash !== bodyHash) {
      throw new BadRequestException(
        'Rıza metni hash doğrulaması başarısız. Metin değiştirilmiş olabilir.',
      );
    }

    const consent = await this.prisma.consent.create({
      data: {
        tenantId,
        clientId: clientId ?? undefined,
        userId: userId ?? undefined,
        consentType: type,
        consentTextVersion: textVersion,
        consentTextHash: bodyHash,
        isGranted: true,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });
    return { id: consent.id };
  }

  async revokeConsent(consentId: string, tenantId: string): Promise<void> {
    const consent = await this.prisma.consent.findFirst({
      where: { id: consentId, tenantId },
    });
    if (!consent) {
      throw new NotFoundException('Rıza kaydı bulunamadı');
    }
    await this.prisma.consent.update({
      where: { id: consentId },
      data: { revokedAt: new Date(), isGranted: false },
    });
  }

  async checkRequiredConsents(
    tenantId: string,
    clientId: string,
  ): Promise<{ type: ConsentType; granted: boolean; version?: number }[]> {
    const consents = await this.prisma.consent.findMany({
      where: {
        tenantId,
        clientId,
        isGranted: true,
        revokedAt: null,
      },
    });
    const grantedByType = new Map<ConsentType, number>();
    for (const c of consents as { consentType: ConsentType; consentTextVersion: number }[]) {
      const current = grantedByType.get(c.consentType);
      if (current === undefined || c.consentTextVersion > current) {
        grantedByType.set(c.consentType, c.consentTextVersion);
      }
    }

    return REQUIRED_CONSENT_TYPES.map((type) => {
      const version = grantedByType.get(type);
      return {
        type,
        granted: version !== undefined,
        version,
      };
    });
  }

  /** Pending consents for psychologist (latest version > granted version) */
  async getPendingConsentsForUser(
    tenantId: string,
    userId: string,
  ): Promise<{
    consentType: string;
    version: number;
    title: string;
    diffFromPrevious?: string;
  }[]> {
    const userConsents = await this.prisma.consent.findMany({
      where: {
        tenantId,
        userId,
        clientId: null, // only user self-consents (e.g. PLATFORM_TOS)
        isGranted: true,
        revokedAt: null,
      },
    });
    const grantedByType = new Map<ConsentType, number>();
    for (const c of userConsents as { consentType: ConsentType; consentTextVersion: number }[]) {
      const current = grantedByType.get(c.consentType);
      if (current === undefined || c.consentTextVersion > current) {
        grantedByType.set(c.consentType, c.consentTextVersion);
      }
    }

    const pending: { consentType: string; version: number; title: string; diffFromPrevious?: string }[] = [];
    for (const type of REQUIRED_CONSENT_TYPES) {
      const latest = await this.prisma.consentText.findFirst({
        where: { consentType: type, effectiveFrom: { lte: new Date() } },
        orderBy: { version: 'desc' },
      });
      if (!latest) continue;
      const granted = grantedByType.get(type) ?? 0;
      if (latest.version > granted) {
        pending.push({
          consentType: latest.consentType,
          version: latest.version,
          title: latest.title,
          diffFromPrevious: latest.diffFromPrevious ?? undefined,
        });
      }
    }
    return pending;
  }

  async getClientConsents(
    tenantId: string,
    clientId: string,
  ): Promise<
    {
      id: string;
      consentType: string;
      version: number;
      isGranted: boolean;
      grantedAt: Date;
      revokedAt: Date | null;
    }[]
  > {
    const consents = await this.prisma.consent.findMany({
      where: { tenantId, clientId },
      orderBy: { grantedAt: 'desc' },
    });
    return consents.map((c) => ({
      id: c.id,
      consentType: c.consentType,
      version: c.consentTextVersion,
      isGranted: c.isGranted,
      grantedAt: c.grantedAt,
      revokedAt: c.revokedAt,
    }));
  }
}
