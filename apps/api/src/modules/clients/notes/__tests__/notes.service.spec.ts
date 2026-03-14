import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { NotesService } from '../notes.service';
import { PrismaService } from '../../../../database/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';
import type { CreateNoteDto } from '../dto/create-note.dto';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makePrisma() {
  return {
    client: { findFirst: jest.fn() },
    consultationNote: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeEncryption() {
  return { encrypt: jest.fn(), decrypt: jest.fn() };
}

// ─── Constants & fixtures ─────────────────────────────────────────────────────

const TENANT_ID = 'tenant-notes-1';
const CLIENT_ID = 'client-notes-1';
const NOTE_ID = 'note-1';

const CIPHERTEXT = Buffer.from('encrypted-body');
const NONCE = Buffer.from('nonce-value-1234');
const AUTH_TAG = Buffer.from('auth-tag-value12');

const EMPTY = Buffer.alloc(0);

const SESSION_DATE_STR = '2025-08-15T09:00:00.000Z';
const SESSION_DATE = new Date(SESSION_DATE_STR);

function makeBaseDto(overrides: Partial<CreateNoteDto> = {}): CreateNoteDto {
  return {
    // Frontend sends plaintext encoded as base64
    encryptedContent: Buffer.from('Seans notu içeriği', 'utf8').toString('base64'),
    sessionDate: SESSION_DATE_STR,
    ...overrides,
  } as CreateNoteDto;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10.1 create() — Encryption Format
// ─────────────────────────────────────────────────────────────────────────────

describe('NotesService – 10.1 create() — Encryption Format', () => {
  let service: NotesService;
  let prisma: ReturnType<typeof makePrisma>;
  let encryption: ReturnType<typeof makeEncryption>;

  beforeEach(async () => {
    prisma = makePrisma();
    encryption = makeEncryption();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);

    // Happy-path defaults
    prisma.client.findFirst.mockResolvedValue({ id: CLIENT_ID, tenantId: TENANT_ID });
    encryption.encrypt.mockResolvedValue({
      ciphertext: CIPHERTEXT,
      nonce: NONCE,
      authTag: AUTH_TAG,
    });
    prisma.consultationNote.create.mockResolvedValue({ id: NOTE_ID });
  });

  // ── Guard ─────────────────────────────────────────────────────────────────

  it('throws NotFoundException when client not found', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(service.create(CLIENT_ID, TENANT_ID, makeBaseDto())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('queries client with clientId and tenantId', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: CLIENT_ID, tenantId: TENANT_ID },
    });
  });

  // ── Base64 decoding ───────────────────────────────────────────────────────

  it('decodes base64-encoded content and passes plaintext to encrypt', async () => {
    const plaintext = 'Seans notu içeriği';
    const dto = makeBaseDto({
      encryptedContent: Buffer.from(plaintext, 'utf8').toString('base64'),
    });

    await service.create(CLIENT_ID, TENANT_ID, dto);

    expect(encryption.encrypt).toHaveBeenCalledWith(TENANT_ID, plaintext);
  });

  it('calls encrypt with tenantId as first argument', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    expect(encryption.encrypt).toHaveBeenCalledWith(TENANT_ID, expect.any(String));
  });

  // ── Ciphertext / nonce / authTag stored from encrypt result ──────────────

  it('stores ciphertext from encrypt as encryptedContent', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    expect(prisma.consultationNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ encryptedContent: CIPHERTEXT }),
      }),
    );
  });

  it('stores nonce from encrypt as contentNonce', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    expect(prisma.consultationNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contentNonce: NONCE }),
      }),
    );
  });

  it('stores authTag from encrypt as contentAuthTag', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    expect(prisma.consultationNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contentAuthTag: AUTH_TAG }),
      }),
    );
  });

  // ── Empty-buffer DEK sentinels (server-side format marker) ───────────────

  it('stores empty Buffer as encryptedDek sentinel', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    const data = prisma.consultationNote.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(Buffer.isBuffer(data.encryptedDek)).toBe(true);
    expect((data.encryptedDek as Buffer).length).toBe(0);
  });

  it('stores empty Buffer as dekNonce sentinel', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    const data = prisma.consultationNote.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(Buffer.isBuffer(data.dekNonce)).toBe(true);
    expect((data.dekNonce as Buffer).length).toBe(0);
  });

  it('stores empty Buffer as dekAuthTag sentinel', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    const data = prisma.consultationNote.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(Buffer.isBuffer(data.dekAuthTag)).toBe(true);
    expect((data.dekAuthTag as Buffer).length).toBe(0);
  });

  // ── Other DTO fields ──────────────────────────────────────────────────────

  it('parses sessionDate string into a Date object', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    expect(prisma.consultationNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionDate: SESSION_DATE }),
      }),
    );
  });

  it('sets sessionNumber to null when not provided', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    expect(prisma.consultationNote.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sessionNumber: null }) }),
    );
  });

  it('passes sessionNumber when provided', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto({ sessionNumber: 5 }));
    expect(prisma.consultationNote.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sessionNumber: 5 }) }),
    );
  });

  it('sets tags to [] when not provided', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    expect(prisma.consultationNote.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tags: [] }) }),
    );
  });

  it('sets symptomCategories to [] when not provided', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    expect(prisma.consultationNote.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ symptomCategories: [] }) }),
    );
  });

  it('sets moodRating to null when not provided', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    expect(prisma.consultationNote.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ moodRating: null }) }),
    );
  });

  it('sets durationMinutes to null when not provided', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    expect(prisma.consultationNote.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ durationMinutes: null }) }),
    );
  });

  it('passes tenantId and clientId to create', async () => {
    await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    expect(prisma.consultationNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_ID, clientId: CLIENT_ID }),
      }),
    );
  });

  // ── Return value ──────────────────────────────────────────────────────────

  it('returns { id } of the created note', async () => {
    const result = await service.create(CLIENT_ID, TENANT_ID, makeBaseDto());
    expect(result).toEqual({ id: NOTE_ID });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10.2 findOne() — Format Detection
// ─────────────────────────────────────────────────────────────────────────────

describe('NotesService – 10.2 findOne() — Format Detection', () => {
  let service: NotesService;
  let prisma: ReturnType<typeof makePrisma>;
  let encryption: ReturnType<typeof makeEncryption>;

  const CREATED_AT = new Date('2025-08-15T09:00:00.000Z');

  // Shared base fields present in both format responses
  const BASE_NOTE_FIELDS = {
    id: NOTE_ID,
    sessionDate: SESSION_DATE,
    sessionNumber: 3,
    sessionType: 'INDIVIDUAL',
    tags: ['anksiyete'],
    symptomCategories: ['uyku'],
    moodRating: 4,
    durationMinutes: 50,
    createdAt: CREATED_AT,
  };

  // Server-side encrypted note: encryptedDek is empty buffer
  function makeServerNote() {
    return {
      ...BASE_NOTE_FIELDS,
      encryptedContent: CIPHERTEXT,
      contentNonce: NONCE,
      contentAuthTag: AUTH_TAG,
      encryptedDek: EMPTY,       // sentinel → server-side format
      dekNonce: EMPTY,
      dekAuthTag: EMPTY,
    };
  }

  // Legacy CSE note: encryptedDek has actual content
  function makeLegacyNote() {
    return {
      ...BASE_NOTE_FIELDS,
      encryptedContent: Buffer.from('legacy-cipher'),
      contentNonce: Buffer.from('legacy-nonce123'),
      contentAuthTag: Buffer.from('legacy-auth-tag'),
      encryptedDek: Buffer.from('encrypted-dek-blob'),  // non-empty → legacy
      dekNonce: Buffer.from('dek-nonce-value1'),
      dekAuthTag: Buffer.from('dek-auth-tag-v1'),
    };
  }

  beforeEach(async () => {
    prisma = makePrisma();
    encryption = makeEncryption();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);

    encryption.decrypt.mockResolvedValue('Decrypted seans içeriği');
  });

  // ── Guard ─────────────────────────────────────────────────────────────────

  it('throws NotFoundException when note not found', async () => {
    prisma.consultationNote.findFirst.mockResolvedValue(null);
    await expect(service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID)).rejects.toThrow(NotFoundException);
  });

  it('queries note with noteId, clientId, and tenantId', async () => {
    prisma.consultationNote.findFirst.mockResolvedValue(makeServerNote());
    await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID);
    expect(prisma.consultationNote.findFirst).toHaveBeenCalledWith({
      where: { id: NOTE_ID, clientId: CLIENT_ID, tenantId: TENANT_ID },
    });
  });

  // ── Server-side format (encryptedDek.length === 0) ────────────────────────

  describe('server-side encrypted note', () => {
    beforeEach(() => {
      prisma.consultationNote.findFirst.mockResolvedValue(makeServerNote());
    });

    it('calls decrypt with tenantId, encryptedContent, nonce, and authTag', async () => {
      await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID);
      expect(encryption.decrypt).toHaveBeenCalledWith(
        TENANT_ID,
        CIPHERTEXT,
        NONCE,
        AUTH_TAG,
      );
    });

    it('returns content field with decrypted plaintext', async () => {
      const result = await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID);
      expect(result.content).toBe('Decrypted seans içeriği');
    });

    it('does not return encryptedContent, encryptedDek, or nonce fields', async () => {
      const result = await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID) as Record<string, unknown>;
      expect(result).not.toHaveProperty('encryptedContent');
      expect(result).not.toHaveProperty('encryptedDek');
      expect(result).not.toHaveProperty('contentNonce');
      expect(result).not.toHaveProperty('dekNonce');
    });

    it('includes all base metadata fields', async () => {
      const result = await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID);
      expect(result.id).toBe(NOTE_ID);
      expect(result.sessionDate).toEqual(SESSION_DATE);
      expect(result.sessionNumber).toBe(3);
      expect(result.sessionType).toBe('INDIVIDUAL');
      expect(result.tags).toEqual(['anksiyete']);
      expect(result.moodRating).toBe(4);
      expect(result.durationMinutes).toBe(50);
      expect(result.createdAt).toEqual(CREATED_AT);
    });
  });

  // ── Legacy CSE format (encryptedDek.length > 0) ───────────────────────────

  describe('legacy client-side encrypted note', () => {
    let legacyNote: ReturnType<typeof makeLegacyNote>;

    beforeEach(() => {
      legacyNote = makeLegacyNote();
      prisma.consultationNote.findFirst.mockResolvedValue(legacyNote);
    });

    it('does not call decrypt', async () => {
      await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID);
      expect(encryption.decrypt).not.toHaveBeenCalled();
    });

    it('does not return content field', async () => {
      const result = await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID) as Record<string, unknown>;
      expect(result).not.toHaveProperty('content');
    });

    it('returns encryptedContent as base64 string', async () => {
      const result = await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID);
      expect(result.encryptedContent).toBe(legacyNote.encryptedContent.toString('base64'));
    });

    it('returns encryptedDek as base64 string', async () => {
      const result = await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID);
      expect(result.encryptedDek).toBe(legacyNote.encryptedDek.toString('base64'));
    });

    it('returns contentNonce as base64 string', async () => {
      const result = await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID);
      expect(result.contentNonce).toBe(legacyNote.contentNonce.toString('base64'));
    });

    it('returns contentAuthTag as base64 string', async () => {
      const result = await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID);
      expect(result.contentAuthTag).toBe(legacyNote.contentAuthTag.toString('base64'));
    });

    it('returns dekNonce as base64 string', async () => {
      const result = await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID);
      expect(result.dekNonce).toBe(legacyNote.dekNonce.toString('base64'));
    });

    it('returns dekAuthTag as base64 string', async () => {
      const result = await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID);
      expect(result.dekAuthTag).toBe(legacyNote.dekAuthTag.toString('base64'));
    });

    it('includes all base metadata fields', async () => {
      const result = await service.findOne(CLIENT_ID, NOTE_ID, TENANT_ID);
      expect(result.id).toBe(NOTE_ID);
      expect(result.sessionDate).toEqual(SESSION_DATE);
      expect(result.tags).toEqual(['anksiyete']);
      expect(result.createdAt).toEqual(CREATED_AT);
    });
  });
});
