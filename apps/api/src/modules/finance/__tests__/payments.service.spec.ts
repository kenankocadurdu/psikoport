import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { PrismaService } from '../../../database/prisma.service';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------
function makePrisma() {
  return {
    appointment: {
      findFirst: jest.fn(),
    },
    paymentSettings: {
      findUnique: jest.fn(),
    },
    sessionPayment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TENANT_ID = 'tenant-1';
const APPOINTMENT_ID = 'appt-1';
const CLIENT_ID = 'client-1';
const PSYCHOLOGIST_ID = 'psych-1';
const PAYMENT_ID = 'pay-1';

function makeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: APPOINTMENT_ID,
    tenantId: TENANT_ID,
    clientId: CLIENT_ID,
    psychologistId: PSYCHOLOGIST_ID,
    startTime: new Date('2025-03-01T10:00:00Z'),
    client: {
      sessionFee: null,
      ...((overrides.client as object) ?? {}),
    },
    tenant: {
      defaultSessionFee: null,
      defaultCurrency: 'TRY',
      ...((overrides.tenant as object) ?? {}),
    },
    ...overrides,
  };
}

function makePaymentSettings(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT_ID,
    psychologistId: PSYCHOLOGIST_ID,
    defaultSessionFee: null,
    currency: null,
    supportedCurrencies: ['TRY'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 4.1 createFromAppointment — Fee Hierarchy
// ---------------------------------------------------------------------------
describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe('4.1 createFromAppointment — Fee Hierarchy', () => {
    describe('happy path — fee resolution', () => {
      it('uses clientFee when all three tiers are set (client wins)', async () => {
        prisma.appointment.findFirst.mockResolvedValue(
          makeAppointment({
            client: { sessionFee: 300 },
            tenant: { defaultSessionFee: 100, defaultCurrency: 'TRY' },
          }),
        );
        prisma.paymentSettings.findUnique.mockResolvedValue(
          makePaymentSettings({ defaultSessionFee: 200 }),
        );
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(prisma.sessionPayment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ amount: 300 }) }),
        );
      });

      it('falls back to psychologistFee when clientFee is null', async () => {
        prisma.appointment.findFirst.mockResolvedValue(
          makeAppointment({
            client: { sessionFee: null },
            tenant: { defaultSessionFee: 100, defaultCurrency: 'TRY' },
          }),
        );
        prisma.paymentSettings.findUnique.mockResolvedValue(
          makePaymentSettings({ defaultSessionFee: 200 }),
        );
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(prisma.sessionPayment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ amount: 200 }) }),
        );
      });

      it('falls back to tenantFee when clientFee and psychologistFee are null', async () => {
        prisma.appointment.findFirst.mockResolvedValue(
          makeAppointment({
            client: { sessionFee: null },
            tenant: { defaultSessionFee: 100, defaultCurrency: 'TRY' },
          }),
        );
        prisma.paymentSettings.findUnique.mockResolvedValue(
          makePaymentSettings({ defaultSessionFee: null }),
        );
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(prisma.sessionPayment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ amount: 100 }) }),
        );
      });

      it('uses 0 when all fee tiers are null', async () => {
        prisma.appointment.findFirst.mockResolvedValue(
          makeAppointment({
            client: { sessionFee: null },
            tenant: { defaultSessionFee: null, defaultCurrency: 'TRY' },
          }),
        );
        prisma.paymentSettings.findUnique.mockResolvedValue(
          makePaymentSettings({ defaultSessionFee: null }),
        );
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(prisma.sessionPayment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ amount: 0 }) }),
        );
      });

      it('uses 0 when no paymentSettings row exists and all fees are null', async () => {
        prisma.appointment.findFirst.mockResolvedValue(
          makeAppointment({
            client: { sessionFee: null },
            tenant: { defaultSessionFee: null, defaultCurrency: 'TRY' },
          }),
        );
        prisma.paymentSettings.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(prisma.sessionPayment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ amount: 0 }) }),
        );
      });

      it('treats falsy sessionFee (0) as null and falls through', async () => {
        prisma.appointment.findFirst.mockResolvedValue(
          makeAppointment({
            client: { sessionFee: 0 },
            tenant: { defaultSessionFee: null, defaultCurrency: 'TRY' },
          }),
        );
        prisma.paymentSettings.findUnique.mockResolvedValue(
          makePaymentSettings({ defaultSessionFee: 150 }),
        );
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        // sessionFee=0 is falsy → clientFee=null → falls to psychologistFee=150
        expect(prisma.sessionPayment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ amount: 150 }) }),
        );
      });
    });

    describe('currency resolution', () => {
      it('uses paymentSettings.currency when it is in supportedCurrencies', async () => {
        prisma.appointment.findFirst.mockResolvedValue(
          makeAppointment({
            client: { sessionFee: null },
            tenant: { defaultSessionFee: null, defaultCurrency: 'TRY' },
          }),
        );
        prisma.paymentSettings.findUnique.mockResolvedValue(
          makePaymentSettings({ currency: 'USD', supportedCurrencies: ['USD', 'EUR'] }),
        );
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(prisma.sessionPayment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ currency: 'USD' }) }),
        );
      });

      it('falls back to first supportedCurrency when preferredCurrency is not supported', async () => {
        prisma.appointment.findFirst.mockResolvedValue(
          makeAppointment({
            client: { sessionFee: null },
            tenant: { defaultSessionFee: null, defaultCurrency: 'TRY' },
          }),
        );
        // preferredCurrency = 'TRY' (from tenant), but TRY not in supportedCurrencies
        prisma.paymentSettings.findUnique.mockResolvedValue(
          makePaymentSettings({ currency: null, supportedCurrencies: ['USD', 'EUR'] }),
        );
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(prisma.sessionPayment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ currency: 'USD' }) }),
        );
      });

      it('uses TRY when no paymentSettings row exists (supportedCurrencies defaults to [TRY])', async () => {
        // When paymentSettings is null, supported defaults to ['TRY'].
        // Even if tenant.defaultCurrency is 'EUR', it's not in ['TRY'],
        // so currency falls back to supported[0] = 'TRY'.
        prisma.appointment.findFirst.mockResolvedValue(
          makeAppointment({
            client: { sessionFee: null },
            tenant: { defaultSessionFee: null, defaultCurrency: 'EUR' },
          }),
        );
        prisma.paymentSettings.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(prisma.sessionPayment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ currency: 'TRY' }) }),
        );
      });

      it('defaults currency to TRY when everything is null', async () => {
        prisma.appointment.findFirst.mockResolvedValue(
          makeAppointment({
            client: { sessionFee: null },
            tenant: { defaultSessionFee: null, defaultCurrency: null },
          }),
        );
        prisma.paymentSettings.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(prisma.sessionPayment.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ currency: 'TRY' }) }),
        );
      });
    });

    describe('idempotency — existing payment', () => {
      it('returns existing payment id without creating a new record', async () => {
        const existingPayment = { id: 'existing-pay-1' };
        prisma.appointment.findFirst.mockResolvedValue(makeAppointment());
        prisma.paymentSettings.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.findUnique.mockResolvedValue(existingPayment as never);

        const result = await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(result).toEqual({ id: 'existing-pay-1' });
        expect(prisma.sessionPayment.create).not.toHaveBeenCalled();
      });
    });

    describe('payment record fields', () => {
      it('creates payment with correct clientId, psychologistId, appointmentId, tenantId', async () => {
        const appt = makeAppointment({
          client: { sessionFee: 250 },
          tenant: { defaultSessionFee: null, defaultCurrency: 'TRY' },
        });
        prisma.appointment.findFirst.mockResolvedValue(appt);
        prisma.paymentSettings.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(prisma.sessionPayment.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            clientId: CLIENT_ID,
            appointmentId: APPOINTMENT_ID,
            psychologistId: PSYCHOLOGIST_ID,
            status: 'PENDING',
          }),
        });
      });

      it('sets sessionDate to appointment.startTime', async () => {
        const startTime = new Date('2025-06-15T09:00:00Z');
        const appt = makeAppointment({ startTime, client: { sessionFee: null }, tenant: { defaultSessionFee: null, defaultCurrency: 'TRY' } });
        prisma.appointment.findFirst.mockResolvedValue(appt);
        prisma.paymentSettings.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(prisma.sessionPayment.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ sessionDate: startTime }),
          }),
        );
      });

      it('returns the id from the created payment record', async () => {
        prisma.appointment.findFirst.mockResolvedValue(makeAppointment());
        prisma.paymentSettings.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        const result = await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(result).toEqual({ id: PAYMENT_ID });
      });
    });

    describe('error handling', () => {
      it('throws NotFoundException when appointment does not exist', async () => {
        prisma.appointment.findFirst.mockResolvedValue(null);

        await expect(
          service.createFromAppointment('non-existent', TENANT_ID),
        ).rejects.toThrow(NotFoundException);
      });

      it('throws NotFoundException when appointment belongs to a different tenant', async () => {
        // findFirst with { id, tenantId } returns null for wrong tenant
        prisma.appointment.findFirst.mockResolvedValue(null);

        await expect(
          service.createFromAppointment(APPOINTMENT_ID, 'other-tenant'),
        ).rejects.toThrow(NotFoundException);
      });

      it('looks up paymentSettings with correct composite key', async () => {
        const appt = makeAppointment();
        prisma.appointment.findFirst.mockResolvedValue(appt);
        prisma.paymentSettings.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.findUnique.mockResolvedValue(null);
        prisma.sessionPayment.create.mockResolvedValue({ id: PAYMENT_ID });

        await service.createFromAppointment(APPOINTMENT_ID, TENANT_ID);

        expect(prisma.paymentSettings.findUnique).toHaveBeenCalledWith({
          where: {
            tenantId_psychologistId: {
              tenantId: TENANT_ID,
              psychologistId: PSYCHOLOGIST_ID,
            },
          },
        });
      });
    });
  });
});
