import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AvailabilityService } from '../availability.service';
import { PrismaService } from '../../../../database/prisma.service';

// ---------------------------------------------------------------------------
// Mock fabrikası
// ---------------------------------------------------------------------------

const makePrisma = () => ({
  user: { findFirst: jest.fn() },
  availabilitySlot: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    count: jest.fn(),
  },
  appointment: { findMany: jest.fn() },
  externalCalendarEvent: { findMany: jest.fn() },
  $transaction: jest.fn(),
});

// ---------------------------------------------------------------------------
// Yardımcı sabitler ve fonksiyonlar
// ---------------------------------------------------------------------------

const PSYCH_ID = 'psych-001';
const TENANT_ID = 'tenant-001';

/**
 * '2025-01-06' Pazartesi'dir (dayOfWeek = 1).
 * Saat bilgisi ekleyerek sadece tarih string'i kullanırken
 * UTC↔lokal saat farkından kaynaklanabilecek gün kaymasını önlüyoruz.
 */
const DATE_STR = '2025-01-06T12:00:00'; // Pazartesi, yerel öğle
const DATE_ONLY = '2025-01-06';

/** Gün içinde yerel saatle Date nesnesi oluşturur (appointment mock'ları için). */
const localTime = (h: number, m: number): Date =>
  new Date(`${DATE_ONLY}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);

/** Availability slot stub'ı (dayOfWeek=1 = Pazartesi). */
const slot = (startTime: string, endTime: string) => ({
  dayOfWeek: 1,
  startTime,
  endTime,
});

/** Appointment stub'ı. */
const appt = (startH: number, startM: number, endH: number, endM: number) => ({
  startTime: localTime(startH, startM),
  endTime: localTime(endH, endM),
});

/** External event stub'ı. */
const extEvent = (startH: number, startM: number, endH: number, endM: number) => ({
  startTime: localTime(startH, startM),
  endTime: localTime(endH, endM),
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AvailabilityService);
    jest.clearAllMocks();

    // Varsayılan: psikolog tenant'a ait, dış takvim eventi yok
    prisma.user.findFirst.mockResolvedValue({ id: PSYCH_ID, tenantId: TENANT_ID });
    prisma.externalCalendarEvent.findMany.mockResolvedValue([]);
  });

  // =========================================================================
  // 2.1 getAvailableSlots() — Temel Slot Hesaplama
  // =========================================================================

  describe('getAvailableSlots()', () => {
    // -----------------------------------------------------------------------
    // Guard conditions
    // -----------------------------------------------------------------------

    describe('guard conditions', () => {
      it('should throw NotFoundException when psychologist does not belong to tenant', async () => {
        prisma.user.findFirst.mockResolvedValue(null);

        await expect(
          service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw NotFoundException for an invalid date string', async () => {
        await expect(
          service.getAvailableSlots(PSYCH_ID, 'not-a-date', TENANT_ID),
        ).rejects.toThrow(NotFoundException);
      });

      it('should query availability slots by psychologistId, tenantId, and dayOfWeek', async () => {
        prisma.availabilitySlot.findMany.mockResolvedValue([]);
        prisma.appointment.findMany.mockResolvedValue([]);

        await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

        expect(prisma.availabilitySlot.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              psychologistId: PSYCH_ID,
              tenantId: TENANT_ID,
              dayOfWeek: 1, // Pazartesi
            }),
          }),
        );
      });
    });

    // -----------------------------------------------------------------------
    // Test 21 — availability tanımlı değil
    // -----------------------------------------------------------------------

    it('should return empty array when no availability slots defined for that day', async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([]);
      prisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

      expect(result).toEqual([]);
    });

    // -----------------------------------------------------------------------
    // Test 18 — randevu yokken tüm chunk'lar döner
    // -----------------------------------------------------------------------

    it('should return all 30-min chunks when no appointments exist (09:00–11:00)', async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([slot('09:00', '11:00')]);
      prisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

      // 09:00, 09:30, 10:00, 10:30 → 4 slot
      expect(result).toHaveLength(4);
    });

    it('should return slots each exactly 30 minutes long', async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([slot('09:00', '10:00')]);
      prisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

      for (const s of result) {
        const diff = new Date(s.end).getTime() - new Date(s.start).getTime();
        expect(diff).toBe(30 * 60 * 1000);
      }
    });

    it('should return slots in ascending time order', async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([slot('09:00', '11:00')]);
      prisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

      for (let i = 1; i < result.length; i++) {
        expect(new Date(result[i].start).getTime()).toBeGreaterThan(
          new Date(result[i - 1].start).getTime(),
        );
      }
    });

    it('should return ISO string timestamps', async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([slot('09:00', '09:30')]);
      prisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

      expect(result).toHaveLength(1);
      // ISO 8601 formatı: "YYYY-MM-DDTHH:mm:ss.sssZ"
      expect(result[0].start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result[0].end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    // -----------------------------------------------------------------------
    // Test 22 — tüm slotlar dolu
    // -----------------------------------------------------------------------

    it('should return empty array when the entire availability window is occupied', async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([slot('09:00', '10:00')]);
      prisma.appointment.findMany.mockResolvedValue([
        appt(9, 0, 10, 0), // tam pencereyi kaplar
      ]);

      const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

      expect(result).toEqual([]);
    });

    // -----------------------------------------------------------------------
    // Test 19 — tam eşleşen randevu
    // -----------------------------------------------------------------------

    it('should exclude slot that exactly matches an existing appointment (09:00–09:30)', async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([slot('09:00', '10:00')]);
      prisma.appointment.findMany.mockResolvedValue([appt(9, 0, 9, 30)]);

      const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

      // Sadece 09:30–10:00 kalmalı
      expect(result).toHaveLength(1);
      expect(new Date(result[0].start).getHours()).toBe(9);
      expect(new Date(result[0].start).getMinutes()).toBe(30);
    });

    // -----------------------------------------------------------------------
    // Test 20 — kısmi örtüşme
    // -----------------------------------------------------------------------

    it('should exclude all slots that partially overlap with a busy range (09:15–09:45)', async () => {
      // 09:15–09:45 randevusu:
      //   09:00–09:30 chunk: 09:00 < 09:45 AND 09:30 > 09:15 → bloke
      //   09:30–10:00 chunk: 09:30 < 09:45 AND 10:00 > 09:15 → bloke
      //   10:00–10:30 chunk: 10:00 < 09:45? hayır → serbest
      prisma.availabilitySlot.findMany.mockResolvedValue([slot('09:00', '11:00')]);
      prisma.appointment.findMany.mockResolvedValue([appt(9, 15, 9, 45)]);

      const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

      // 10:00 ve 10:30 serbest → 2 slot
      expect(result).toHaveLength(2);
      expect(new Date(result[0].start).getHours()).toBe(10);
      expect(new Date(result[0].start).getMinutes()).toBe(0);
    });

    // -----------------------------------------------------------------------
    // Birden fazla availability window
    // -----------------------------------------------------------------------

    it('should aggregate slots from multiple availability windows on the same day', async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([
        slot('09:00', '10:00'), // 2 slot
        slot('14:00', '15:00'), // 2 slot
      ]);
      prisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

      expect(result).toHaveLength(4);
    });

    // -----------------------------------------------------------------------
    // 2.2 Busy Range Merging
    // -----------------------------------------------------------------------

    describe('busy range merging', () => {
      // Test 23 — örtüşen iki range birleştirilir
      it('should merge two overlapping appointments into a single busy range', async () => {
        // Randevu 1: 09:00–09:45, Randevu 2: 09:30–10:15
        // Birleşik busy: 09:00–10:15
        // 09:00 bloke, 09:30 bloke, 10:00 bloke (10:00 < 10:15), 10:30 serbest
        prisma.availabilitySlot.findMany.mockResolvedValue([slot('09:00', '11:00')]);
        prisma.appointment.findMany.mockResolvedValue([
          appt(9, 0, 9, 45),
          appt(9, 30, 10, 15),
        ]);

        const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

        // Sadece 10:30 serbest
        expect(result).toHaveLength(1);
        expect(new Date(result[0].start).getHours()).toBe(10);
        expect(new Date(result[0].start).getMinutes()).toBe(30);
      });

      // Test 24 — örtüşmeyen iki range ayrı kalır
      it('should NOT merge two non-overlapping busy ranges (gap stays free)', async () => {
        // Randevu 1: 09:00–09:30, Randevu 2: 10:00–10:30
        // 09:00 bloke, 09:30 serbest, 10:00 bloke, 10:30 serbest
        prisma.availabilitySlot.findMany.mockResolvedValue([slot('09:00', '11:00')]);
        prisma.appointment.findMany.mockResolvedValue([
          appt(9, 0, 9, 30),
          appt(10, 0, 10, 30),
        ]);

        const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

        expect(result).toHaveLength(2);
        // 09:30 serbest
        expect(new Date(result[0].start).getMinutes()).toBe(30);
        // 10:30 serbest
        expect(new Date(result[1].start).getMinutes()).toBe(30);
      });

      // Test 25 — harici takvim eventi randevuyla birleştirilir
      it('should merge external calendar events with appointment busy ranges', async () => {
        // Randevu: 09:00–09:30, Dış event: 09:15–09:45
        // Birleşik busy: 09:00–09:45 → 09:00 ve 09:30 bloke, 10:00 serbest
        prisma.availabilitySlot.findMany.mockResolvedValue([slot('09:00', '11:00')]);
        prisma.appointment.findMany.mockResolvedValue([appt(9, 0, 9, 30)]);
        prisma.externalCalendarEvent.findMany.mockResolvedValue([extEvent(9, 15, 9, 45)]);

        const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

        // 09:00 ve 09:30 bloke; 10:00, 10:30 serbest
        expect(result).toHaveLength(2);
        expect(new Date(result[0].start).getHours()).toBe(10);
      });

      // Test 26 — bitişik (touching) range'ler birleşir (s <= e kontrolü)
      it('should merge adjacent (touching) busy ranges as they satisfy the s <= e condition', async () => {
        // Randevu 1: 09:00–09:30, Randevu 2: 09:30–10:00
        // Birleşme koşulu: interval.s (09:30) <= last.e (09:30) → DOĞRU → birleşir
        // Birleşik busy: 09:00–10:00 → 09:00 ve 09:30 bloke, 10:00 ve 10:30 serbest
        prisma.availabilitySlot.findMany.mockResolvedValue([slot('09:00', '11:00')]);
        prisma.appointment.findMany.mockResolvedValue([
          appt(9, 0, 9, 30),
          appt(9, 30, 10, 0),
        ]);

        const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

        // 10:00 ve 10:30 serbest
        expect(result).toHaveLength(2);
        expect(new Date(result[0].start).getHours()).toBe(10);
        expect(new Date(result[0].start).getMinutes()).toBe(0);
      });

      it('should include only non-deleted external events in busy range calculation', async () => {
        // Service sorgusu zaten `deleted: false` filtresi kullanıyor; mock bunu yansıtır
        prisma.availabilitySlot.findMany.mockResolvedValue([slot('09:00', '11:00')]);
        prisma.appointment.findMany.mockResolvedValue([]);
        prisma.externalCalendarEvent.findMany.mockResolvedValue([]);

        const result = await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

        expect(prisma.externalCalendarEvent.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ deleted: false }),
          }),
        );
        // Dış event yok → 4 slot serbest
        expect(result).toHaveLength(4);
      });

      it('should query only SCHEDULED appointments (not cancelled or completed)', async () => {
        prisma.availabilitySlot.findMany.mockResolvedValue([slot('09:00', '11:00')]);
        prisma.appointment.findMany.mockResolvedValue([]);

        await service.getAvailableSlots(PSYCH_ID, DATE_STR, TENANT_ID);

        expect(prisma.appointment.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ status: 'SCHEDULED' }),
          }),
        );
      });
    });
  });
});
