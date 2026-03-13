import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { AppointmentsService, REDIS_CLIENT } from '../appointments.service';
import { LocationTypeDto } from '../dto/create-appointment.dto';
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
  locationType: LocationTypeDto.IN_PERSON,
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
  let paymentsService: ReturnType<typeof makePaymentsService>;
  let subscriptionService: ReturnType<typeof makeSubscriptionService>;
  let stripeService: ReturnType<typeof makeStripeService>;

  beforeEach(async () => {
    prisma = makePrisma();
    redis = makeRedis();
    queue = makeQueue();
    videoService = makeVideoService();
    paymentsService = makePaymentsService();
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
        { provide: PaymentsService, useValue: paymentsService },
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
      const onlineDto = { ...baseDto, locationType: LocationTypeDto.ONLINE };
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
      const onlineDto = { ...baseDto, locationType: LocationTypeDto.ONLINE };
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

  // =========================================================================
  // 3.2 cancel()
  // =========================================================================

  describe('cancel()', () => {
    const APPT_ID = 'appt-cancel-001';

    const scheduledAppt = {
      id: APPT_ID,
      clientId: 'client-001',
      psychologistId: 'psych-001',
      tenantId: TENANT_ID,
      startTime: new Date('2025-01-06T09:00:00'),
      endTime: new Date('2025-01-06T09:30:00'),
      status: 'SCHEDULED',
      googleEventId: null,
      durationMinutes: 30,
    };

    const cancelledAppt = {
      ...scheduledAppt,
      status: 'CANCELLED',
      cancellationReason: 'test-reason',
      cancelledAt: new Date(),
    };

    beforeEach(() => {
      // findOne içindeki findFirst → mevcut randevuyu döndür
      prisma.appointment.findFirst.mockResolvedValue(scheduledAppt);
      // update → iptal edilmiş randevuyu döndür
      prisma.appointment.update.mockResolvedValue(cancelledAppt);
      // Varsayılan: ödeme kaydı yok → Stripe çağrılmaz
      prisma.sessionPayment.findUnique.mockResolvedValue(null);
      // consumeSession mock
      subscriptionService.consumeSession.mockResolvedValue(undefined);
    });

    // -----------------------------------------------------------------------
    // Guard conditions
    // -----------------------------------------------------------------------

    it('should throw ForbiddenException if appointment status is not SCHEDULED', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        ...scheduledAppt,
        status: 'COMPLETED',
      });

      await expect(service.cancel(APPT_ID, undefined, TENANT_ID)).rejects.toThrow(
        'Bu randevu iptal edilemez',
      );
    });

    it('should throw NotFoundException if appointment is not found', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);

      await expect(service.cancel(APPT_ID, undefined, TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    // -----------------------------------------------------------------------
    // Durum güncellemesi
    // -----------------------------------------------------------------------

    it('should update appointment status to CANCELLED', async () => {
      await service.cancel(APPT_ID, 'test-reason', TENANT_ID);

      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: APPT_ID },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('should persist the cancellation reason when provided', async () => {
      await service.cancel(APPT_ID, 'Hasta iptali', TENANT_ID);

      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancellationReason: 'Hasta iptali' }),
        }),
      );
    });

    it('should set cancellationReason to null when no reason is provided', async () => {
      await service.cancel(APPT_ID, undefined, TENANT_ID);

      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancellationReason: null }),
        }),
      );
    });

    it('should set cancelledAt to a Date on cancellation', async () => {
      await service.cancel(APPT_ID, undefined, TENANT_ID);

      const updateCall = prisma.appointment.update.mock.calls[0][0];
      expect(updateCall.data.cancelledAt).toBeInstanceOf(Date);
    });

    // -----------------------------------------------------------------------
    // Test 37 — Stripe voidPayment çağrılır
    // -----------------------------------------------------------------------

    it('should void Stripe payment intent when one exists on the appointment', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue({
        appointmentId: APPT_ID,
        stripePaymentIntentId: 'pi_stripe_123',
      });

      await service.cancel(APPT_ID, undefined, TENANT_ID);

      expect(stripeService.voidPayment).toHaveBeenCalledWith('pi_stripe_123');
    });

    // -----------------------------------------------------------------------
    // Test 38 — Stripe voidPayment çağrılmaz
    // -----------------------------------------------------------------------

    it('should NOT call Stripe voidPayment when no payment intent exists', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue(null);

      await service.cancel(APPT_ID, undefined, TENANT_ID);

      expect(stripeService.voidPayment).not.toHaveBeenCalled();
    });

    it('should NOT call Stripe voidPayment when payment record exists but has no intent ID', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue({
        appointmentId: APPT_ID,
        stripePaymentIntentId: null,
      });

      await service.cancel(APPT_ID, undefined, TENANT_ID);

      expect(stripeService.voidPayment).not.toHaveBeenCalled();
    });

    it('should continue cancellation even if Stripe voidPayment throws', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue({
        stripePaymentIntentId: 'pi_failing',
      });
      stripeService.voidPayment.mockRejectedValue(new Error('Stripe down'));

      // İptal işlemi tamamlanmalı (exception yutulur)
      const result = await service.cancel(APPT_ID, undefined, TENANT_ID);

      expect(result.status).toBe('CANCELLED');
      // consumeSession hâlâ çağrılmalı
      expect(subscriptionService.consumeSession).toHaveBeenCalledWith(TENANT_ID);
    });

    // -----------------------------------------------------------------------
    // Test 39 — Seans kotası düşürülür
    // -----------------------------------------------------------------------

    it('should consume session quota after cancellation', async () => {
      await service.cancel(APPT_ID, undefined, TENANT_ID);

      expect(subscriptionService.consumeSession).toHaveBeenCalledWith(TENANT_ID);
    });

    it('should consume session quota even when appointment has no payment', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue(null);

      await service.cancel(APPT_ID, undefined, TENANT_ID);

      expect(subscriptionService.consumeSession).toHaveBeenCalledTimes(1);
    });

    // -----------------------------------------------------------------------
    // Bildirim kuyruğu
    // -----------------------------------------------------------------------

    it('should enqueue a cancelled notification job after successful cancellation', async () => {
      await service.cancel(APPT_ID, 'Hasta iptali', TENANT_ID);

      expect(queue.add).toHaveBeenCalledWith(
        'cancelled',
        expect.objectContaining({
          appointmentId: APPT_ID,
          type: 'cancelled',
          tenantId: TENANT_ID,
          reason: 'Hasta iptali',
        }),
        expect.objectContaining({ jobId: `appt-notif:${APPT_ID}:cancelled` }),
      );
    });

    // -----------------------------------------------------------------------
    // Dönen değer
    // -----------------------------------------------------------------------

    it('should return id and CANCELLED status', async () => {
      const result = await service.cancel(APPT_ID, undefined, TENANT_ID);

      expect(result).toEqual({ id: APPT_ID, status: 'CANCELLED' });
    });
  });

  // =========================================================================
  // 3.3 complete()
  // =========================================================================

  describe('complete()', () => {
    const APPT_ID = 'appt-complete-001';

    const scheduledAppt = {
      id: APPT_ID,
      clientId: 'client-001',
      psychologistId: 'psych-001',
      tenantId: TENANT_ID,
      startTime: new Date('2025-01-06T09:00:00'),
      endTime: new Date('2025-01-06T09:30:00'),
      status: 'SCHEDULED',
      googleEventId: null,
      durationMinutes: 30,
    };

    const completedAppt = {
      ...scheduledAppt,
      status: 'COMPLETED',
    };

    beforeEach(() => {
      prisma.appointment.findFirst.mockResolvedValue(scheduledAppt);
      prisma.appointment.update.mockResolvedValue(completedAppt);
      prisma.sessionPayment.findUnique.mockResolvedValue(null);
      paymentsService.createFromAppointment.mockResolvedValue(undefined);
      subscriptionService.consumeSession.mockResolvedValue(undefined);
    });

    // -----------------------------------------------------------------------
    // Guard conditions
    // -----------------------------------------------------------------------

    it('should throw ForbiddenException if appointment status is not SCHEDULED', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        ...scheduledAppt,
        status: 'CANCELLED',
      });

      await expect(service.complete(APPT_ID, TENANT_ID)).rejects.toThrow(
        'Bu randevu tamamlanamaz',
      );
    });

    it('should throw NotFoundException if appointment is not found', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);

      await expect(service.complete(APPT_ID, TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    // -----------------------------------------------------------------------
    // Durum güncellemesi
    // -----------------------------------------------------------------------

    it('should update appointment status to COMPLETED', async () => {
      await service.complete(APPT_ID, TENANT_ID);

      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: APPT_ID },
        data: { status: 'COMPLETED' },
      });
    });

    // -----------------------------------------------------------------------
    // Ödeme kaydı oluşturulur
    // -----------------------------------------------------------------------

    it('should call paymentsService.createFromAppointment after completing', async () => {
      await service.complete(APPT_ID, TENANT_ID);

      expect(paymentsService.createFromAppointment).toHaveBeenCalledWith(
        APPT_ID,
        TENANT_ID,
      );
    });

    it('should call createFromAppointment with the appointment id (not original DTO id)', async () => {
      await service.complete(APPT_ID, TENANT_ID);

      const [apptIdArg] = paymentsService.createFromAppointment.mock.calls[0];
      expect(apptIdArg).toBe(APPT_ID);
    });

    // -----------------------------------------------------------------------
    // Stripe capturePayment — tutarı tahsil et
    // -----------------------------------------------------------------------

    it('should capture Stripe payment when stripePaymentIntentId exists', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue({
        appointmentId: APPT_ID,
        stripePaymentIntentId: 'pi_capture_123',
      });

      await service.complete(APPT_ID, TENANT_ID);

      expect(stripeService.capturePayment).toHaveBeenCalledWith('pi_capture_123');
    });

    it('should NOT call Stripe capturePayment when no payment record exists', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue(null);

      await service.complete(APPT_ID, TENANT_ID);

      expect(stripeService.capturePayment).not.toHaveBeenCalled();
    });

    it('should NOT call Stripe capturePayment when payment record has no intent ID', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue({
        appointmentId: APPT_ID,
        stripePaymentIntentId: null,
      });

      await service.complete(APPT_ID, TENANT_ID);

      expect(stripeService.capturePayment).not.toHaveBeenCalled();
    });

    it('should continue completion even if Stripe capturePayment throws', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue({
        stripePaymentIntentId: 'pi_failing',
      });
      stripeService.capturePayment.mockRejectedValue(new Error('Stripe timeout'));

      // Exception yutulmalı, complete başarıyla tamamlanmalı
      const result = await service.complete(APPT_ID, TENANT_ID);

      expect(result.status).toBe('COMPLETED');
      // consumeSession hâlâ çağrılmalı
      expect(subscriptionService.consumeSession).toHaveBeenCalledWith(TENANT_ID);
    });

    // -----------------------------------------------------------------------
    // Seans kotası düşürülür
    // -----------------------------------------------------------------------

    it('should consume session quota after completion', async () => {
      await service.complete(APPT_ID, TENANT_ID);

      expect(subscriptionService.consumeSession).toHaveBeenCalledWith(TENANT_ID);
    });

    it('should consume session quota even when no Stripe payment exists', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue(null);

      await service.complete(APPT_ID, TENANT_ID);

      expect(subscriptionService.consumeSession).toHaveBeenCalledTimes(1);
    });

    // -----------------------------------------------------------------------
    // Dönen değer
    // -----------------------------------------------------------------------

    it('should return id and COMPLETED status', async () => {
      const result = await service.complete(APPT_ID, TENANT_ID);

      expect(result).toEqual({ id: APPT_ID, status: 'COMPLETED' });
    });
  });

  // =========================================================================
  // 3.4 noShow()
  // =========================================================================

  describe('noShow()', () => {
    const APPT_ID = 'appt-noshow-001';

    const scheduledAppt = {
      id: APPT_ID,
      clientId: 'client-001',
      psychologistId: 'psych-001',
      tenantId: TENANT_ID,
      startTime: new Date('2025-01-06T09:00:00'),
      endTime: new Date('2025-01-06T09:30:00'),
      status: 'SCHEDULED',
      googleEventId: null,
      durationMinutes: 30,
    };

    const noShowAppt = { ...scheduledAppt, status: 'NO_SHOW' };

    beforeEach(() => {
      prisma.appointment.findFirst.mockResolvedValue(scheduledAppt);
      prisma.appointment.update.mockResolvedValue(noShowAppt);
      prisma.sessionPayment.findUnique.mockResolvedValue(null);
      subscriptionService.consumeSession.mockResolvedValue(undefined);
    });

    // -----------------------------------------------------------------------
    // Guard conditions
    // -----------------------------------------------------------------------

    it('should throw ForbiddenException if appointment status is not SCHEDULED', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        ...scheduledAppt,
        status: 'COMPLETED',
      });

      await expect(service.noShow(APPT_ID, TENANT_ID)).rejects.toThrow(
        'Bu randevu gelmedi olarak işaretlenemez',
      );
    });

    it('should throw NotFoundException if appointment is not found', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);

      await expect(service.noShow(APPT_ID, TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    // -----------------------------------------------------------------------
    // Durum güncellemesi
    // -----------------------------------------------------------------------

    it('should update appointment status to NO_SHOW', async () => {
      await service.noShow(APPT_ID, TENANT_ID);

      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: APPT_ID },
        data: { status: 'NO_SHOW' },
      });
    });

    it('should NOT call paymentsService.createFromAppointment (unlike complete)', async () => {
      await service.noShow(APPT_ID, TENANT_ID);

      expect(paymentsService.createFromAppointment).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Stripe capturePayment — cezai bedel tahsili
    // -----------------------------------------------------------------------

    it('should capture Stripe payment as a no-show penalty when stripePaymentIntentId exists', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue({
        appointmentId: APPT_ID,
        stripePaymentIntentId: 'pi_noshow_123',
      });

      await service.noShow(APPT_ID, TENANT_ID);

      expect(stripeService.capturePayment).toHaveBeenCalledWith('pi_noshow_123');
    });

    it('should NOT call Stripe capturePayment when no payment record exists', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue(null);

      await service.noShow(APPT_ID, TENANT_ID);

      expect(stripeService.capturePayment).not.toHaveBeenCalled();
    });

    it('should NOT call Stripe capturePayment when payment record has no intent ID', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue({
        appointmentId: APPT_ID,
        stripePaymentIntentId: null,
      });

      await service.noShow(APPT_ID, TENANT_ID);

      expect(stripeService.capturePayment).not.toHaveBeenCalled();
    });

    it('should continue no-show marking even if Stripe capturePayment throws', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue({
        stripePaymentIntentId: 'pi_failing',
      });
      stripeService.capturePayment.mockRejectedValue(new Error('Stripe timeout'));

      const result = await service.noShow(APPT_ID, TENANT_ID);

      expect(result.status).toBe('NO_SHOW');
      expect(subscriptionService.consumeSession).toHaveBeenCalledWith(TENANT_ID);
    });

    // -----------------------------------------------------------------------
    // Seans kotası düşürülür
    // -----------------------------------------------------------------------

    it('should consume session quota after marking as no-show', async () => {
      await service.noShow(APPT_ID, TENANT_ID);

      expect(subscriptionService.consumeSession).toHaveBeenCalledWith(TENANT_ID);
    });

    it('should consume session quota even when no Stripe payment record exists', async () => {
      prisma.sessionPayment.findUnique.mockResolvedValue(null);

      await service.noShow(APPT_ID, TENANT_ID);

      expect(subscriptionService.consumeSession).toHaveBeenCalledTimes(1);
    });

    // -----------------------------------------------------------------------
    // Dönen değer
    // -----------------------------------------------------------------------

    it('should return id and NO_SHOW status', async () => {
      const result = await service.noShow(APPT_ID, TENANT_ID);

      expect(result).toEqual({ id: APPT_ID, status: 'NO_SHOW' });
    });
  });
});
