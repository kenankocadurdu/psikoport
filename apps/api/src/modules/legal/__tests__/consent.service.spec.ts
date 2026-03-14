import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConsentType } from 'prisma-client';

import { ConsentService } from '../consent.service';
import { PrismaService } from '../../../database/prisma.service';

// ─── Mock factory ─────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    consentText: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    consent: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-consent-1';
const CLIENT_ID = 'client-consent-1';
const USER_ID = 'user-consent-1';
const CONSENT_TYPE = 'KVKK_DATA_PROCESSING' as ConsentType;
const TEXT_VERSION = 3;
const BODY_HASH = 'abc123hashvalue';
const CONSENT_TEXT_ID = 'ctext-1';
const CONSENT_ID = 'consent-record-1';

function makeConsentText(bodyHash = BODY_HASH) {
  return {
    id: CONSENT_TEXT_ID,
    consentType: CONSENT_TYPE,
    version: TEXT_VERSION,
    title: 'KVKK Aydınlatma Metni',
    bodyHtml: '<p>Metin...</p>',
    bodyHash,
    effectiveFrom: new Date('2025-01-01'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9.1 grantConsent()
// ─────────────────────────────────────────────────────────────────────────────

describe('ConsentService – 9.1 grantConsent()', () => {
  let service: ConsentService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ConsentService>(ConsentService);

    // Happy-path defaults
    prisma.consentText.findUnique.mockResolvedValue(makeConsentText());
    prisma.consent.create.mockResolvedValue({ id: CONSENT_ID });
  });

  // ── ConsentText lookup ────────────────────────────────────────────────────

  it('queries consentText with composite key {consentType, version}', async () => {
    await service.grantConsent(TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, BODY_HASH);
    expect(prisma.consentText.findUnique).toHaveBeenCalledWith({
      where: {
        consentType_version: { consentType: CONSENT_TYPE, version: TEXT_VERSION },
      },
    });
  });

  it('throws NotFoundException when consentText not found', async () => {
    prisma.consentText.findUnique.mockResolvedValue(null);
    await expect(
      service.grantConsent(TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, BODY_HASH),
    ).rejects.toThrow(NotFoundException);
  });

  it('NotFoundException message includes type and version', async () => {
    prisma.consentText.findUnique.mockResolvedValue(null);
    await expect(
      service.grantConsent(TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, BODY_HASH),
    ).rejects.toThrow(`${CONSENT_TYPE} v${TEXT_VERSION}`);
  });

  // ── Hash verification ─────────────────────────────────────────────────────

  it('throws BadRequestException when bodyHash does not match stored hash', async () => {
    prisma.consentText.findUnique.mockResolvedValue(makeConsentText('stored-hash'));
    await expect(
      service.grantConsent(TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, 'different-hash'),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not create consent when hash mismatch', async () => {
    prisma.consentText.findUnique.mockResolvedValue(makeConsentText('stored-hash'));
    await expect(
      service.grantConsent(TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, 'wrong'),
    ).rejects.toThrow();
    expect(prisma.consent.create).not.toHaveBeenCalled();
  });

  // ── Consent record creation ───────────────────────────────────────────────

  it('creates consent with isGranted: true', async () => {
    await service.grantConsent(TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, BODY_HASH);
    expect(prisma.consent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isGranted: true }) }),
    );
  });

  it('passes tenantId, consentType, version, and hash to create', async () => {
    await service.grantConsent(TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, BODY_HASH);
    expect(prisma.consent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          consentType: CONSENT_TYPE,
          consentTextVersion: TEXT_VERSION,
          consentTextHash: BODY_HASH,
        }),
      }),
    );
  });

  it('passes clientId when provided', async () => {
    await service.grantConsent(TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, BODY_HASH);
    expect(prisma.consent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientId: CLIENT_ID }) }),
    );
  });

  it('sets clientId to undefined when null (omits from create data)', async () => {
    await service.grantConsent(TENANT_ID, null, CONSENT_TYPE, TEXT_VERSION, BODY_HASH);
    const createData = prisma.consent.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(createData.clientId).toBeUndefined();
  });

  it('passes userId when provided', async () => {
    await service.grantConsent(
      TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, BODY_HASH,
      undefined, undefined, USER_ID,
    );
    expect(prisma.consent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: USER_ID }) }),
    );
  });

  it('sets userId to undefined when not provided', async () => {
    await service.grantConsent(TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, BODY_HASH);
    const createData = prisma.consent.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(createData.userId).toBeUndefined();
  });

  it('sets ipAddress from ip arg when provided', async () => {
    await service.grantConsent(
      TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, BODY_HASH, '192.168.1.1',
    );
    expect(prisma.consent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ipAddress: '192.168.1.1' }) }),
    );
  });

  it('sets ipAddress to null when ip not provided', async () => {
    await service.grantConsent(TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, BODY_HASH);
    expect(prisma.consent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ipAddress: null }) }),
    );
  });

  it('sets userAgent when provided', async () => {
    const ua = 'Mozilla/5.0';
    await service.grantConsent(
      TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, BODY_HASH, undefined, ua,
    );
    expect(prisma.consent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userAgent: ua }) }),
    );
  });

  it('sets userAgent to null when not provided', async () => {
    await service.grantConsent(TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, BODY_HASH);
    expect(prisma.consent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userAgent: null }) }),
    );
  });

  // ── Return value ──────────────────────────────────────────────────────────

  it('returns { id } of the created consent record', async () => {
    const result = await service.grantConsent(
      TENANT_ID, CLIENT_ID, CONSENT_TYPE, TEXT_VERSION, BODY_HASH,
    );
    expect(result).toEqual({ id: CONSENT_ID });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9.2 revokeConsent()
// ─────────────────────────────────────────────────────────────────────────────

describe('ConsentService – 9.2 revokeConsent()', () => {
  let service: ConsentService;
  let prisma: ReturnType<typeof makePrisma>;

  const NOW = new Date('2025-10-01T12:00:00.000Z');
  const EXISTING_CONSENT = { id: CONSENT_ID, tenantId: TENANT_ID, isGranted: true, revokedAt: null };

  beforeEach(async () => {
    prisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ConsentService>(ConsentService);

    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    prisma.consent.findFirst.mockResolvedValue(EXISTING_CONSENT);
    prisma.consent.update.mockResolvedValue({ ...EXISTING_CONSENT, isGranted: false, revokedAt: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Lookup ────────────────────────────────────────────────────────────────

  it('queries consent with consentId and tenantId', async () => {
    await service.revokeConsent(CONSENT_ID, TENANT_ID);
    expect(prisma.consent.findFirst).toHaveBeenCalledWith({
      where: { id: CONSENT_ID, tenantId: TENANT_ID },
    });
  });

  it('throws NotFoundException when consent record not found', async () => {
    prisma.consent.findFirst.mockResolvedValue(null);
    await expect(service.revokeConsent(CONSENT_ID, TENANT_ID)).rejects.toThrow(NotFoundException);
  });

  it('does not call update when consent not found', async () => {
    prisma.consent.findFirst.mockResolvedValue(null);
    await expect(service.revokeConsent(CONSENT_ID, TENANT_ID)).rejects.toThrow();
    expect(prisma.consent.update).not.toHaveBeenCalled();
  });

  // ── Update ────────────────────────────────────────────────────────────────

  it('updates consent where id matches consentId', async () => {
    await service.revokeConsent(CONSENT_ID, TENANT_ID);
    expect(prisma.consent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CONSENT_ID } }),
    );
  });

  it('sets isGranted to false', async () => {
    await service.revokeConsent(CONSENT_ID, TENANT_ID);
    expect(prisma.consent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isGranted: false }) }),
    );
  });

  it('sets revokedAt to current time', async () => {
    await service.revokeConsent(CONSENT_ID, TENANT_ID);
    expect(prisma.consent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokedAt: NOW }) }),
    );
  });

  // ── Return value ──────────────────────────────────────────────────────────

  it('returns void (undefined)', async () => {
    const result = await service.revokeConsent(CONSENT_ID, TENANT_ID);
    expect(result).toBeUndefined();
  });
});
