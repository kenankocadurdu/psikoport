import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { ExportService } from '../export.service';
import { PrismaService } from '../../../../database/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makePrisma() {
  return {
    client: { findFirst: jest.fn() },
    consultationNote: { findMany: jest.fn() },
    formSubmission: { findMany: jest.fn() },
    appointment: { findMany: jest.fn() },
    sessionPayment: { findMany: jest.fn() },
    clientFile: { findMany: jest.fn() },
  };
}

function makeEncryption() {
  return { decrypt: jest.fn() };
}

// ─── Constants & fixtures ─────────────────────────────────────────────────────

const TENANT_ID = 'tenant-gdpr-1';
const CLIENT_ID = 'client-gdpr-1';

const NOW = new Date('2025-09-01T08:00:00.000Z');
const BIRTH = new Date('1990-03-15T00:00:00.000Z');
const ANON_AT = new Date('2025-08-01T00:00:00.000Z');
const SESSION_DATE = new Date('2025-07-10T09:00:00.000Z');

function makeClient(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: CLIENT_ID,
    firstName: 'Ayşe',
    lastName: 'Kaya',
    email: 'ayse@test.com',
    phone: '05551234567',
    birthDate: BIRTH,
    gender: 'FEMALE',
    maritalStatus: 'SINGLE',
    educationLevel: 'UNIVERSITY',
    occupation: 'Mühendis',
    address: 'İstanbul',
    tags: ['anksiyete'],
    complaintAreas: ['iş stresi'],
    referralSource: 'internet',
    status: 'ACTIVE',
    createdAt: NOW,
    anonymizedAt: null,
    ...overrides,
  };
}

function makeNote(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'note-1',
    sessionDate: SESSION_DATE,
    sessionNumber: 3,
    sessionType: 'INDIVIDUAL',
    tags: ['kaygı'],
    symptomCategories: ['anksiyete'],
    moodRating: 4,
    durationMinutes: 50,
    encryptedContent: Buffer.from('ciphertext'),
    contentNonce: Buffer.from('nonce123456789012'),
    contentAuthTag: Buffer.from('authtagXY'),
    createdAt: NOW,
    ...overrides,
  };
}

function makeFormSubmission() {
  return {
    id: 'fs-1',
    formDefinition: { title: 'PHQ-9 Depresyon Ölçeği', code: 'PHQ9' },
    responses: { q1: '2', q2: '1' },
    scores: { total: 14 },
    severityLevel: 'MODERATE',
    completionStatus: 'COMPLETE',
    submittedAt: SESSION_DATE,
    createdAt: NOW,
  };
}

function makeAppointment() {
  return {
    id: 'appt-1',
    startTime: SESSION_DATE,
    endTime: new Date(SESSION_DATE.getTime() + 50 * 60 * 1000),
    status: 'COMPLETED',
    sessionType: 'INDIVIDUAL',
    locationType: 'ONLINE',
    cancellationReason: null,
    createdAt: NOW,
  };
}

function makePayment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'pay-1',
    sessionDate: SESSION_DATE,
    amount: { toNumber: () => 500, valueOf: () => 500 } as unknown as number, // Prisma Decimal
    currency: 'TRY',
    status: 'PAID',
    paidAmount: { toNumber: () => 500, valueOf: () => 500 } as unknown as number,
    paidAt: SESSION_DATE,
    paymentMethod: 'BANK_TRANSFER',
    createdAt: NOW,
    ...overrides,
  };
}

function makeFile() {
  return {
    id: 'file-1',
    fileName: 'rapor.pdf',
    fileSize: 204800,
    mimeType: 'application/pdf',
    createdAt: NOW,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8.1 exportGdprJson()
// ─────────────────────────────────────────────────────────────────────────────

describe('ExportService – 8.1 exportGdprJson()', () => {
  let service: ExportService;
  let prisma: ReturnType<typeof makePrisma>;
  let encryption: ReturnType<typeof makeEncryption>;

  beforeEach(async () => {
    prisma = makePrisma();
    encryption = makeEncryption();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);

    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    // Happy-path defaults — all empty
    prisma.client.findFirst.mockResolvedValue(makeClient());
    prisma.consultationNote.findMany.mockResolvedValue([]);
    prisma.formSubmission.findMany.mockResolvedValue([]);
    prisma.appointment.findMany.mockResolvedValue([]);
    prisma.sessionPayment.findMany.mockResolvedValue([]);
    prisma.clientFile.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Guard ─────────────────────────────────────────────────────────────────

  it('throws NotFoundException when client not found', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(service.exportGdprJson(CLIENT_ID, TENANT_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('queries client with correct clientId and tenantId', async () => {
    await service.exportGdprJson(CLIENT_ID, TENANT_ID);
    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: CLIENT_ID, tenantId: TENANT_ID },
    });
  });

  // ── Top-level metadata ────────────────────────────────────────────────────

  it('sets exportedAt to current time ISO string', async () => {
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    expect(result.exportedAt).toBe(NOW.toISOString());
  });

  it('sets exportVersion to "2.0"', async () => {
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    expect(result.exportVersion).toBe('2.0');
  });

  it('sets dataSubject to "client"', async () => {
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    expect(result.dataSubject).toBe('client');
  });

  // ── Client fields ─────────────────────────────────────────────────────────

  it('maps client scalar fields correctly', async () => {
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const c = result.client as Record<string, unknown>;

    expect(c.id).toBe(CLIENT_ID);
    expect(c.firstName).toBe('Ayşe');
    expect(c.lastName).toBe('Kaya');
    expect(c.email).toBe('ayse@test.com');
    expect(c.phone).toBe('05551234567');
    expect(c.gender).toBe('FEMALE');
    expect(c.status).toBe('ACTIVE');
    expect(c.referralSource).toBe('internet');
    expect(c.createdAt).toBe(NOW.toISOString());
  });

  it('converts birthDate to ISO string', async () => {
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const c = result.client as Record<string, unknown>;
    expect(c.birthDate).toBe(BIRTH.toISOString());
  });

  it('sets birthDate to null when absent', async () => {
    prisma.client.findFirst.mockResolvedValue(makeClient({ birthDate: null }));
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const c = result.client as Record<string, unknown>;
    expect(c.birthDate).toBeNull();
  });

  it('converts anonymizedAt to ISO string when set', async () => {
    prisma.client.findFirst.mockResolvedValue(makeClient({ anonymizedAt: ANON_AT }));
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const c = result.client as Record<string, unknown>;
    expect(c.anonymizedAt).toBe(ANON_AT.toISOString());
  });

  it('sets anonymizedAt to null when absent', async () => {
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const c = result.client as Record<string, unknown>;
    expect(c.anonymizedAt).toBeNull();
  });

  // ── Consultation notes — decryption ───────────────────────────────────────

  it('returns empty consultationNotes array when no notes', async () => {
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    expect(result.consultationNotes).toEqual([]);
  });

  it('decrypts note content and includes it in output', async () => {
    const note = makeNote();
    prisma.consultationNote.findMany.mockResolvedValue([note]);
    encryption.decrypt.mockResolvedValue('Seans içeriği burada');

    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const notes = result.consultationNotes as Array<Record<string, unknown>>;

    expect(notes[0].content).toBe('Seans içeriği burada');
  });

  it('calls decrypt with tenantId and correct Buffers from note', async () => {
    const note = makeNote();
    prisma.consultationNote.findMany.mockResolvedValue([note]);
    encryption.decrypt.mockResolvedValue('');

    await service.exportGdprJson(CLIENT_ID, TENANT_ID);

    expect(encryption.decrypt).toHaveBeenCalledWith(
      TENANT_ID,
      Buffer.from(note.encryptedContent as Buffer),
      Buffer.from(note.contentNonce as Buffer),
      Buffer.from(note.contentAuthTag as Buffer),
    );
  });

  it('uses fallback content when decryption throws', async () => {
    prisma.consultationNote.findMany.mockResolvedValue([makeNote()]);
    encryption.decrypt.mockRejectedValue(new Error('DEK not found'));

    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const notes = result.consultationNotes as Array<Record<string, unknown>>;

    expect(notes[0].content).toBe('[ŞİFRE ÇÖZÜLEMEZ — DEK imha edilmiş olabilir]');
  });

  it('maps note metadata fields correctly', async () => {
    const note = makeNote();
    prisma.consultationNote.findMany.mockResolvedValue([note]);
    encryption.decrypt.mockResolvedValue('content');

    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const n = (result.consultationNotes as Array<Record<string, unknown>>)[0];

    expect(n.id).toBe('note-1');
    expect(n.sessionDate).toBe(SESSION_DATE.toISOString());
    expect(n.sessionNumber).toBe(3);
    expect(n.sessionType).toBe('INDIVIDUAL');
    expect(n.moodRating).toBe(4);
    expect(n.durationMinutes).toBe(50);
    expect(n.createdAt).toBe(NOW.toISOString());
  });

  // ── Form submissions ───────────────────────────────────────────────────────

  it('returns empty formSubmissions array when none', async () => {
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    expect(result.formSubmissions).toEqual([]);
  });

  it('maps form submission fields including form title and code', async () => {
    prisma.formSubmission.findMany.mockResolvedValue([makeFormSubmission()]);

    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const fs = (result.formSubmissions as Array<Record<string, unknown>>)[0];

    expect(fs.id).toBe('fs-1');
    expect(fs.form).toEqual({ title: 'PHQ-9 Depresyon Ölçeği', code: 'PHQ9' });
    expect(fs.responses).toEqual({ q1: '2', q2: '1' });
    expect(fs.scores).toEqual({ total: 14 });
    expect(fs.severityLevel).toBe('MODERATE');
    expect(fs.completionStatus).toBe('COMPLETE');
    expect(fs.submittedAt).toBe(SESSION_DATE.toISOString());
    expect(fs.createdAt).toBe(NOW.toISOString());
  });

  it('sets submittedAt to null when missing', async () => {
    prisma.formSubmission.findMany.mockResolvedValue([
      { ...makeFormSubmission(), submittedAt: null },
    ]);
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const fs = (result.formSubmissions as Array<Record<string, unknown>>)[0];
    expect(fs.submittedAt).toBeNull();
  });

  // ── Appointments ──────────────────────────────────────────────────────────

  it('returns empty appointments array when none', async () => {
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    expect(result.appointments).toEqual([]);
  });

  it('converts appointment dates to ISO strings', async () => {
    prisma.appointment.findMany.mockResolvedValue([makeAppointment()]);

    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const appt = (result.appointments as Array<Record<string, unknown>>)[0];

    expect(appt.startTime).toBe(SESSION_DATE.toISOString());
    expect(typeof appt.endTime).toBe('string');
    expect(appt.createdAt).toBe(NOW.toISOString());
    expect(appt.status).toBe('COMPLETED');
  });

  // ── Payments ──────────────────────────────────────────────────────────────

  it('returns empty payments array when none', async () => {
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    expect(result.payments).toEqual([]);
  });

  it('converts Decimal amount and paidAmount to Number', async () => {
    prisma.sessionPayment.findMany.mockResolvedValue([makePayment()]);

    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const pay = (result.payments as Array<Record<string, unknown>>)[0];

    expect(pay.amount).toBe(500);
    expect(pay.paidAmount).toBe(500);
  });

  it('sets paidAmount to null when absent', async () => {
    prisma.sessionPayment.findMany.mockResolvedValue([makePayment({ paidAmount: null })]);

    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const pay = (result.payments as Array<Record<string, unknown>>)[0];

    expect(pay.paidAmount).toBeNull();
  });

  it('converts paidAt to ISO string', async () => {
    prisma.sessionPayment.findMany.mockResolvedValue([makePayment()]);
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const pay = (result.payments as Array<Record<string, unknown>>)[0];
    expect(pay.paidAt).toBe(SESSION_DATE.toISOString());
  });

  it('sets paidAt to null when absent', async () => {
    prisma.sessionPayment.findMany.mockResolvedValue([makePayment({ paidAt: null })]);
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const pay = (result.payments as Array<Record<string, unknown>>)[0];
    expect(pay.paidAt).toBeNull();
  });

  it('converts sessionDate to ISO string', async () => {
    prisma.sessionPayment.findMany.mockResolvedValue([makePayment()]);
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const pay = (result.payments as Array<Record<string, unknown>>)[0];
    expect(pay.sessionDate).toBe(SESSION_DATE.toISOString());
  });

  // ── Files ─────────────────────────────────────────────────────────────────

  it('returns empty files array when none', async () => {
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    expect(result.files).toEqual([]);
  });

  it('maps file fields and converts createdAt to ISO string', async () => {
    prisma.clientFile.findMany.mockResolvedValue([makeFile()]);
    const result = await service.exportGdprJson(CLIENT_ID, TENANT_ID) as Record<string, unknown>;
    const file = (result.files as Array<Record<string, unknown>>)[0];

    expect(file.id).toBe('file-1');
    expect(file.fileName).toBe('rapor.pdf');
    expect(file.fileSize).toBe(204800);
    expect(file.mimeType).toBe('application/pdf');
    expect(file.createdAt).toBe(NOW.toISOString());
  });

  // ── Parallel queries ──────────────────────────────────────────────────────

  it('fetches notes, formSubmissions, appointments, payments, files in parallel', async () => {
    await service.exportGdprJson(CLIENT_ID, TENANT_ID);

    // All five collection queries must be called (they run via Promise.all)
    expect(prisma.consultationNote.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.formSubmission.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.appointment.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.sessionPayment.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.clientFile.findMany).toHaveBeenCalledTimes(1);
  });
});
