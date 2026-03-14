import { createHash } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConsentType } from 'prisma-client';

import { ConsentService } from '../consent.service';
import { PrismaService } from '../../../database/prisma.service';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

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

// ─────────────────────────────────────────────────────────────────────────────
// 9.3 getPendingConsentsForUser()
// ─────────────────────────────────────────────────────────────────────────────

describe('ConsentService – 9.3 getPendingConsentsForUser()', () => {
  let service: ConsentService;
  let prisma: ReturnType<typeof makePrisma>;

  const NOW = new Date('2025-11-01T00:00:00.000Z');
  const USER_ID_LOCAL = 'user-pending-1';

  // Required types in iteration order (matches REQUIRED_CONSENT_TYPES constant)
  const TYPE_KVKK = 'KVKK_DATA_PROCESSING' as ConsentType;
  const TYPE_SPECIAL = 'KVKK_SPECIAL_DATA' as ConsentType;
  const TYPE_TOS = 'PLATFORM_TOS' as ConsentType;

  function makeConsentTextRecord(
    type: ConsentType,
    version: number,
    diffFromPrevious: string | null = null,
  ) {
    return {
      id: `ctext-${type}-${version}`,
      consentType: type,
      version,
      title: `${type} v${version}`,
      bodyHtml: '<p>metin</p>',
      bodyHash: 'hash',
      effectiveFrom: new Date('2025-01-01'),
      diffFromPrevious,
    };
  }

  function makeUserConsent(type: ConsentType, textVersion: number) {
    return {
      id: `consent-${type}`,
      tenantId: TENANT_ID,
      userId: USER_ID_LOCAL,
      clientId: null,
      consentType: type,
      consentTextVersion: textVersion,
      isGranted: true,
      revokedAt: null,
    };
  }

  /**
   * Build a consentText.findFirst mock that returns different records per consentType.
   * Pass null for a type to simulate no text existing for that type.
   */
  function mockConsentTexts(map: Partial<Record<string, ReturnType<typeof makeConsentTextRecord> | null>>) {
    prisma.consentText.findFirst.mockImplementation(
      ({ where }: { where: { consentType: string } }) =>
        Promise.resolve(map[where.consentType] ?? null),
    );
  }

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

    // Default: no granted consents
    prisma.consent.findMany.mockResolvedValue([]);

    // Default: all three types have latest version 1
    mockConsentTexts({
      [TYPE_KVKK]: makeConsentTextRecord(TYPE_KVKK, 1),
      [TYPE_SPECIAL]: makeConsentTextRecord(TYPE_SPECIAL, 1),
      [TYPE_TOS]: makeConsentTextRecord(TYPE_TOS, 1),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── User consent query ────────────────────────────────────────────────────

  it('queries consent.findMany with tenantId, userId, clientId:null, isGranted:true, revokedAt:null', async () => {
    await service.getPendingConsentsForUser(TENANT_ID, USER_ID_LOCAL);
    expect(prisma.consent.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_ID,
        userId: USER_ID_LOCAL,
        clientId: null,
        isGranted: true,
        revokedAt: null,
      },
    });
  });

  // ── ConsentText lookup ────────────────────────────────────────────────────

  it('queries consentText.findFirst for each required type with effectiveFrom lte now', async () => {
    await service.getPendingConsentsForUser(TENANT_ID, USER_ID_LOCAL);
    // Called once per required type (3 types)
    expect(prisma.consentText.findFirst).toHaveBeenCalledTimes(3);
    expect(prisma.consentText.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          consentType: TYPE_KVKK,
          effectiveFrom: { lte: NOW },
        }),
      }),
    );
  });

  // ── Pending detection ─────────────────────────────────────────────────────

  it('returns all three types as pending when user has no granted consents', async () => {
    const result = await service.getPendingConsentsForUser(TENANT_ID, USER_ID_LOCAL);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.consentType)).toEqual(
      expect.arrayContaining([TYPE_KVKK, TYPE_SPECIAL, TYPE_TOS]),
    );
  });

  it('returns empty array when user has all consents at latest version', async () => {
    prisma.consent.findMany.mockResolvedValue([
      makeUserConsent(TYPE_KVKK, 1),
      makeUserConsent(TYPE_SPECIAL, 1),
      makeUserConsent(TYPE_TOS, 1),
    ]);
    const result = await service.getPendingConsentsForUser(TENANT_ID, USER_ID_LOCAL);
    expect(result).toHaveLength(0);
  });

  it('includes type in pending when latest version > granted version', async () => {
    // User granted v1, latest is v2
    prisma.consent.findMany.mockResolvedValue([makeUserConsent(TYPE_KVKK, 1)]);
    mockConsentTexts({
      [TYPE_KVKK]: makeConsentTextRecord(TYPE_KVKK, 2), // newer version
      [TYPE_SPECIAL]: makeConsentTextRecord(TYPE_SPECIAL, 1),
      [TYPE_TOS]: makeConsentTextRecord(TYPE_TOS, 1),
    });
    // User also granted SPECIAL and TOS v1
    prisma.consent.findMany.mockResolvedValue([
      makeUserConsent(TYPE_KVKK, 1),
      makeUserConsent(TYPE_SPECIAL, 1),
      makeUserConsent(TYPE_TOS, 1),
    ]);

    const result = await service.getPendingConsentsForUser(TENANT_ID, USER_ID_LOCAL);
    expect(result).toHaveLength(1);
    expect(result[0].consentType).toBe(TYPE_KVKK);
    expect(result[0].version).toBe(2);
  });

  it('does NOT include type in pending when latest version equals granted version', async () => {
    prisma.consent.findMany.mockResolvedValue([
      makeUserConsent(TYPE_KVKK, 2),
      makeUserConsent(TYPE_SPECIAL, 1),
      makeUserConsent(TYPE_TOS, 1),
    ]);
    mockConsentTexts({
      [TYPE_KVKK]: makeConsentTextRecord(TYPE_KVKK, 2), // same as granted
      [TYPE_SPECIAL]: makeConsentTextRecord(TYPE_SPECIAL, 1),
      [TYPE_TOS]: makeConsentTextRecord(TYPE_TOS, 1),
    });

    const result = await service.getPendingConsentsForUser(TENANT_ID, USER_ID_LOCAL);
    expect(result.map((r) => r.consentType)).not.toContain(TYPE_KVKK);
  });

  it('skips type when no consentText exists for it', async () => {
    mockConsentTexts({
      [TYPE_KVKK]: makeConsentTextRecord(TYPE_KVKK, 1),
      [TYPE_SPECIAL]: null, // no text for this type
      [TYPE_TOS]: makeConsentTextRecord(TYPE_TOS, 1),
    });

    const result = await service.getPendingConsentsForUser(TENANT_ID, USER_ID_LOCAL);
    expect(result.map((r) => r.consentType)).not.toContain(TYPE_SPECIAL);
    expect(result).toHaveLength(2);
  });

  it('uses highest granted version when user has multiple consents for the same type', async () => {
    // Two consents for KVKK — v1 and v2. Latest is v2. Should NOT be pending.
    prisma.consent.findMany.mockResolvedValue([
      makeUserConsent(TYPE_KVKK, 1),
      makeUserConsent(TYPE_KVKK, 2), // higher version wins
      makeUserConsent(TYPE_SPECIAL, 1),
      makeUserConsent(TYPE_TOS, 1),
    ]);
    mockConsentTexts({
      [TYPE_KVKK]: makeConsentTextRecord(TYPE_KVKK, 2),
      [TYPE_SPECIAL]: makeConsentTextRecord(TYPE_SPECIAL, 1),
      [TYPE_TOS]: makeConsentTextRecord(TYPE_TOS, 1),
    });

    const result = await service.getPendingConsentsForUser(TENANT_ID, USER_ID_LOCAL);
    expect(result.map((r) => r.consentType)).not.toContain(TYPE_KVKK);
  });

  // ── Returned item shape ───────────────────────────────────────────────────

  it('pending item includes consentType, version, and title', async () => {
    const result = await service.getPendingConsentsForUser(TENANT_ID, USER_ID_LOCAL);
    const kvkk = result.find((r) => r.consentType === TYPE_KVKK);
    expect(kvkk).toMatchObject({
      consentType: TYPE_KVKK,
      version: 1,
      title: `${TYPE_KVKK} v1`,
    });
  });

  it('includes diffFromPrevious when set on consentText', async () => {
    mockConsentTexts({
      [TYPE_KVKK]: makeConsentTextRecord(TYPE_KVKK, 2, '+ yeni madde eklendi'),
      [TYPE_SPECIAL]: makeConsentTextRecord(TYPE_SPECIAL, 1),
      [TYPE_TOS]: makeConsentTextRecord(TYPE_TOS, 1),
    });

    const result = await service.getPendingConsentsForUser(TENANT_ID, USER_ID_LOCAL);
    const kvkk = result.find((r) => r.consentType === TYPE_KVKK);
    expect(kvkk?.diffFromPrevious).toBe('+ yeni madde eklendi');
  });

  it('omits diffFromPrevious (undefined) when null on consentText', async () => {
    // Default setup has null diffFromPrevious
    const result = await service.getPendingConsentsForUser(TENANT_ID, USER_ID_LOCAL);
    const kvkk = result.find((r) => r.consentType === TYPE_KVKK);
    expect(kvkk?.diffFromPrevious).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9.4 createConsentTextVersion()
// ─────────────────────────────────────────────────────────────────────────────

describe('ConsentService – 9.4 createConsentTextVersion()', () => {
  let service: ConsentService;
  let prisma: ReturnType<typeof makePrisma>;

  const TYPE = 'PLATFORM_TOS' as ConsentType;
  const EFFECTIVE_FROM = new Date('2025-06-01T00:00:00.000Z');
  const BODY_HTML_V1 = '<p>İlk sürüm metni.</p>';
  const BODY_HTML_V2 = '<p>Güncellenmiş metin.</p>';
  const TEXT_ID = 'ctext-new-1';

  beforeEach(async () => {
    prisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ConsentService>(ConsentService);

    // Default: no previous version
    prisma.consentText.findFirst.mockResolvedValue(null);
    prisma.consentText.create.mockResolvedValue({ id: TEXT_ID });
  });

  // ── findFirst query ───────────────────────────────────────────────────────

  it('queries previous version with consentType filter ordered by version desc', async () => {
    await service.createConsentTextVersion(TYPE, 1, 'Başlık', BODY_HTML_V1, EFFECTIVE_FROM);
    expect(prisma.consentText.findFirst).toHaveBeenCalledWith({
      where: { consentType: TYPE },
      orderBy: { version: 'desc' },
    });
  });

  // ── bodyHash ──────────────────────────────────────────────────────────────

  it('passes sha256 of bodyHtml as bodyHash in create data', async () => {
    await service.createConsentTextVersion(TYPE, 1, 'Başlık', BODY_HTML_V1, EFFECTIVE_FROM);
    expect(prisma.consentText.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bodyHash: sha256(BODY_HTML_V1) }),
      }),
    );
  });

  // ── diffFromPrevious: null cases ──────────────────────────────────────────

  it('sets diffFromPrevious to null when no previous version exists', async () => {
    prisma.consentText.findFirst.mockResolvedValue(null);
    await service.createConsentTextVersion(TYPE, 1, 'Başlık', BODY_HTML_V1, EFFECTIVE_FROM);
    expect(prisma.consentText.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ diffFromPrevious: null }),
      }),
    );
  });

  it('sets diffFromPrevious to null when previous version is not consecutive (version gap)', async () => {
    // Creating v3, but prev is v1 (not v2 = 3-1)
    prisma.consentText.findFirst.mockResolvedValue({
      id: 'prev', consentType: TYPE, version: 1, bodyHtml: BODY_HTML_V1,
    });
    await service.createConsentTextVersion(TYPE, 3, 'Başlık', BODY_HTML_V2, EFFECTIVE_FROM);
    expect(prisma.consentText.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ diffFromPrevious: null }),
      }),
    );
  });

  // ── diffFromPrevious: computed diff cases ─────────────────────────────────

  it('computes diff when previous version is consecutive (version - 1)', async () => {
    prisma.consentText.findFirst.mockResolvedValue({
      id: 'prev', consentType: TYPE, version: 1, bodyHtml: BODY_HTML_V1,
    });
    await service.createConsentTextVersion(TYPE, 2, 'Başlık', BODY_HTML_V2, EFFECTIVE_FROM);
    const createData = prisma.consentText.create.mock.calls[0][0].data as Record<string, unknown>;
    // diffFromPrevious should be a non-null string (computed diff)
    expect(typeof createData.diffFromPrevious).toBe('string');
    expect(createData.diffFromPrevious).not.toBeNull();
  });

  it('diff contains removed line marker when content changed', async () => {
    prisma.consentText.findFirst.mockResolvedValue({
      id: 'prev', consentType: TYPE, version: 1, bodyHtml: BODY_HTML_V1,
    });
    await service.createConsentTextVersion(TYPE, 2, 'Başlık', BODY_HTML_V2, EFFECTIVE_FROM);
    const createData = prisma.consentText.create.mock.calls[0][0].data as Record<string, unknown>;
    // Real diff lib: changed lines appear as [-] removed / [+] added
    expect(createData.diffFromPrevious as string).toMatch(/\[-\]/);
    expect(createData.diffFromPrevious as string).toMatch(/\[\+\]/);
  });

  it('diff is "(değişiklik yok)" when bodyHtml is identical to previous', async () => {
    prisma.consentText.findFirst.mockResolvedValue({
      id: 'prev', consentType: TYPE, version: 1, bodyHtml: BODY_HTML_V1,
    });
    // Creating v2 with identical HTML
    await service.createConsentTextVersion(TYPE, 2, 'Başlık', BODY_HTML_V1, EFFECTIVE_FROM);
    const createData = prisma.consentText.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(createData.diffFromPrevious).toBe('(değişiklik yok)');
  });

  // ── create data fields ────────────────────────────────────────────────────

  it('passes all fields to consentText.create', async () => {
    await service.createConsentTextVersion(TYPE, 1, 'TOS Başlık', BODY_HTML_V1, EFFECTIVE_FROM);
    expect(prisma.consentText.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consentType: TYPE,
          version: 1,
          title: 'TOS Başlık',
          bodyHtml: BODY_HTML_V1,
          effectiveFrom: EFFECTIVE_FROM,
        }),
      }),
    );
  });

  // ── Return value ──────────────────────────────────────────────────────────

  it('returns { id } of the created consent text', async () => {
    const result = await service.createConsentTextVersion(
      TYPE, 1, 'Başlık', BODY_HTML_V1, EFFECTIVE_FROM,
    );
    expect(result).toEqual({ id: TEXT_ID });
  });
});
