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
