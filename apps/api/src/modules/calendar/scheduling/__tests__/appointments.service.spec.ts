import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { AppointmentsService, REDIS_CLIENT } from '../appointments.service';
import { PrismaService } from '../../../../database/prisma.service';
import { CalendarSyncService } from '../../calendar-sync/calendar-sync.service';
import { VideoService } from '../../video/video.service';
import { PaymentsService } from '../../../finance/payments.service';
import { SubscriptionService } from '../../../subscriptions/subscription.service';
import { StripeService } from '../../../payments/stripe.service';

// ---------------------------------------------------------------------------
// Mock fabrikaları
// ---------------------------------------------------------------------------

const makePrisma = () => ({
  client: { findFirst: jest.fn() },
  user: { findFirst: jest.fn() },
  appointment: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  sessionPayment: { findUnique: jest.fn() },
  calendarIntegration: { findFirst: jest.fn() },
});

const makeRedis = () => ({
  set: jest.fn(),
  del: jest.fn(),
});

const makeQueue = () => ({
  add: jest.fn().mockResolvedValue({}),
});

const makeCalendarSync = () => ({ push: jest.fn() });
const makeVideoService = () => ({ createVideoMeeting: jest.fn() });
const makePaymentsService = () => ({ createFromAppointment: jest.fn() });
const makeSubscriptionService = () => ({ consumeSession: jest.fn() });
const makeStripeService = () => ({
  voidPayment: jest.fn(),
  capturePayment: jest.fn(),
});

// ---------------------------------------------------------------------------
// Test sabitleri
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-001';
const USER_ID = 'user-001';

const baseDto = {
  clientId: 'client-001',
  psychologistId: 'psych-001',
  startTime: '2025-01-06T09:00:00',
  endTime: '2025-01-06T09:30:00',
  durationMinutes: 30,
  locationType: 'IN_PERSON' as const,
};

const createdAppt = {
  id: 'appt-001',
  clientId: 'client-001',
  psychologistId: 'psych-001',
  tenantId: TENANT_ID,
  startTime: new Date('2025-01-06T09:00:00'),
  endTime: new Date('2025-01-06T09:30:00'),
  durationMinutes: 30,
  status: 'SCHEDULED',
  googleEventId: null,
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: ReturnType<typeof makePrisma>;
  let redis: ReturnType<typeof makeRedis>;
  let queue: ReturnType<typeof makeQueue>;
  let videoService: ReturnType<typeof makeVideoService>;
  let subscriptionService: ReturnType<typeof makeSubscriptionService>;
  let stripeService: ReturnType<typeof makeStripeService>;

  beforeEach(async () => {
    prisma = makePrisma();
    redis = makeRedis();
    queue = makeQueue();
    videoService = makeVideoService();
    subscriptionService = makeSubscriptionService();
    stripeService = makeStripeService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: getQueueToken('appointment-notification'), useValue: queue },
        { provide: CalendarSyncService, useValue: makeCalendarSync() },
        { provide: VideoService, useValue: videoService },
        { provide: PaymentsService, useValue: makePaymentsService() },
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: StripeService, useValue: stripeService },
      ],
    }).compile();

    service = module.get(AppointmentsService);
    jest.clearAllMocks();

    // Varsayılan "happy path" setup
    redis.set.mockResolvedValue('OK');                          // lock alındı
    redis.del.mockResolvedValue(1);                            // lock bırakıldı
    prisma.client.findFirst.mockResolvedValue({ id: baseDto.clientId });   // client var
    prisma.user.findFirst.mockResolvedValue({ id: baseDto.psychologistId }); // psych var
    prisma.appointment.findFirst.mockResolvedValue(null);      // çakışma yok
    prisma.appointment.create.mockResolvedValue(createdAppt);  // kayıt başarılı
    prisma.calendarIntegration.findFirst.mockResolvedValue(null); // sync yok
  });

  // =========================================================================
  // 3.1 create() — Slot Locking & Validation
  // =========================================================================

  describe('create()', () => {
    // -----------------------------------------------------------------------
    // Test 29 — Redis lock alınır
    // -----------------------------------------------------------------------

    it('should acquire Redis lock before creating appointment (set with NX)', async () => {
      await service.create(baseDto, TENANT_ID, USER_ID);

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('appointment:slot:'),
        '1',
        'EX',
        300,
        'NX',
      );
    });

    it('should include psychologistId and startTime ISO string in the lock key', async () => {
      await service.create(baseDto, TENANT_ID, USER_ID);

      const lockKey: string = redis.set.mock.calls[0][0];
      expect(lockKey).toContain(baseDto.psychologistId);
    });

    // -----------------------------------------------------------------------
    // Test 30 — Lock alınamazsa ConflictException
    // -----------------------------------------------------------------------

    it('should throw ConflictException if Redis lock cannot be acquired (set returns null)', async () => {
      redis.set.mockResolvedValue(null);

      await expect(service.create(baseDto, TENANT_ID, USER_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should NOT query the database when Redis lock cannot be acquired', async () => {
      redis.set.mockResolvedValue(null);

      await expect(service.create(baseDto, TENANT_ID, USER_ID)).rejects.toThrow();

      expect(prisma.client.findFirst).not.toHaveBeenCalled();
      expect(prisma.appointment.create).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Test 33 — Client tenant'a ait değilse NotFoundException
    // -----------------------------------------------------------------------

    it('should throw NotFoundException if client does not belong to tenant', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(service.create(baseDto, TENANT_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if psychologist does not belong to tenant', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.create(baseDto, TENANT_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    // -----------------------------------------------------------------------
    // Test 31 — Çakışan randevu varsa ConflictException
    // -----------------------------------------------------------------------

    it('should throw ConflictException if overlapping appointment exists in DB', async () => {
      prisma.appointment.findFirst.mockResolvedValue({ id: 'existing-appt' });

      await expect(service.create(baseDto, TENANT_ID, USER_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should NOT call appointment.create when a slot conflict exists', async () => {
      prisma.appointment.findFirst.mockResolvedValue({ id: 'existing-appt' });

      await expect(service.create(baseDto, TENANT_ID, USER_ID)).rejects.toThrow();

      expect(prisma.appointment.create).not.toHaveBeenCalled();
    });

    it('should check conflict with SCHEDULED status filter', async () => {
      await service.create(baseDto, TENANT_ID, USER_ID);

      expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SCHEDULED' }),
        }),
      );
    });

    // -----------------------------------------------------------------------
    // Test 32 — Finally bloğunda lock serbest bırakılır
    // -----------------------------------------------------------------------

    it('should release Redis lock in finally block even when client guard throws', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(service.create(baseDto, TENANT_ID, USER_ID)).rejects.toThrow();

      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining('appointment:slot:'),
      );
    });

    it('should release Redis lock in finally block even when slot conflict throws', async () => {
      prisma.appointment.findFirst.mockResolvedValue({ id: 'conflict' });

      await expect(service.create(baseDto, TENANT_ID, USER_ID)).rejects.toThrow();

      expect(redis.del).toHaveBeenCalled();
    });

    it('should release Redis lock after successful appointment creation', async () => {
      await service.create(baseDto, TENANT_ID, USER_ID);

      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining('appointment:slot:'),
      );
    });

    // -----------------------------------------------------------------------
    // Test 34 — ONLINE → video toplantısı oluşturulur
    // -----------------------------------------------------------------------

    it('should create a video meeting when locationType is ONLINE', async () => {
      const onlineDto = { ...baseDto, locationType: 'ONLINE' as const };
      videoService.createVideoMeeting.mockResolvedValue({
        provider: 'ZOOM',
        meetingUrl: 'https://zoom.us/j/123',
        meetingId: 'zoom-123',
        hostUrl: 'https://zoom.us/s/123',
      });

      await service.create(onlineDto, TENANT_ID, USER_ID);

      expect(videoService.createVideoMeeting).toHaveBeenCalledWith(
        expect.objectContaining({
          psychologistId: baseDto.psychologistId,
          tenantId: TENANT_ID,
        }),
      );
    });

    // -----------------------------------------------------------------------
    // Test 35 — IN_PERSON → video toplantısı oluşturulmaz
    // -----------------------------------------------------------------------

    it('should NOT create a video meeting when locationType is IN_PERSON', async () => {
      await service.create(baseDto, TENANT_ID, USER_ID);

      expect(videoService.createVideoMeeting).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Test 36 — Başarılı oluşturmada bildirim kuyruğuna eklenir (ONLINE için)
    // -----------------------------------------------------------------------

    it('should enqueue notification job for ONLINE appointment with video URL', async () => {
      const onlineDto = { ...baseDto, locationType: 'ONLINE' as const };
      videoService.createVideoMeeting.mockResolvedValue({
        provider: 'ZOOM',
        meetingUrl: 'https://zoom.us/j/123',
        meetingId: 'zoom-123',
        hostUrl: 'https://zoom.us/s/123',
      });

      await service.create(onlineDto, TENANT_ID, USER_ID);

      expect(queue.add).toHaveBeenCalledWith(
        'created',
        expect.objectContaining({
          appointmentId: createdAppt.id,
          type: 'created',
          tenantId: TENANT_ID,
        }),
        expect.objectContaining({ jobId: expect.stringContaining('appt-notif') }),
      );
    });

    it('should NOT enqueue notification job for IN_PERSON appointment', async () => {
      await service.create(baseDto, TENANT_ID, USER_ID);

      expect(queue.add).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Başarılı oluşturma — dönen değer
    // -----------------------------------------------------------------------

    it('should return id, clientId, psychologistId, startTime, endTime, status on success', async () => {
      const result = await service.create(baseDto, TENANT_ID, USER_ID);

      expect(result).toEqual({
        id: createdAppt.id,
        clientId: createdAppt.clientId,
        psychologistId: createdAppt.psychologistId,
        startTime: createdAppt.startTime,
        endTime: createdAppt.endTime,
        status: createdAppt.status,
      });
    });

    it('should persist appointment with correct tenantId, clientId, and psychologistId', async () => {
      await service.create(baseDto, TENANT_ID, USER_ID);

      expect(prisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            clientId: baseDto.clientId,
            psychologistId: baseDto.psychologistId,
          }),
        }),
      );
    });
  });
});
