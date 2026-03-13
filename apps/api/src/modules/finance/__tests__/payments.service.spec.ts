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

  // -------------------------------------------------------------------------
  // 4.2 getRevenueSummary
  // -------------------------------------------------------------------------
  describe('4.2 getRevenueSummary', () => {
    const NOW = new Date('2025-06-15T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    function makePayment(overrides: {
      amount: number;
      paidAmount?: number | null;
      status?: string;
    }) {
      return {
        amount: overrides.amount,
        paidAmount: overrides.paidAmount ?? null,
        status: overrides.status ?? 'PENDING',
      };
    }

    describe('aggregation calculations', () => {
      it('returns totalRevenue as sum of all amounts', async () => {
        prisma.sessionPayment.findMany.mockResolvedValue([
          makePayment({ amount: 100, status: 'PAID' }),
          makePayment({ amount: 200, status: 'PAID' }),
          makePayment({ amount: 50, status: 'PENDING' }),
        ] as never);

        const result = await service.getRevenueSummary(TENANT_ID, 'monthly');

        expect(result.totalRevenue).toBe(350);
      });

      it('returns collected as sum of paidAmount (non-null entries only)', async () => {
        prisma.sessionPayment.findMany.mockResolvedValue([
          makePayment({ amount: 100, paidAmount: 100, status: 'PAID' }),
          makePayment({ amount: 200, paidAmount: 150, status: 'PARTIAL' }),
          makePayment({ amount: 50, paidAmount: null, status: 'PENDING' }),
        ] as never);

        const result = await service.getRevenueSummary(TENANT_ID, 'monthly');

        expect(result.collected).toBe(250);
      });

      it('returns pending = totalRevenue - collected', async () => {
        prisma.sessionPayment.findMany.mockResolvedValue([
          makePayment({ amount: 300, paidAmount: 200, status: 'PARTIAL' }),
        ] as never);

        const result = await service.getRevenueSummary(TENANT_ID, 'monthly');

        expect(result.pending).toBe(100);
      });

      it('returns unpaidCount as count of PENDING-status payments only', async () => {
        prisma.sessionPayment.findMany.mockResolvedValue([
          makePayment({ amount: 100, status: 'PENDING' }),
          makePayment({ amount: 200, status: 'PAID' }),
          makePayment({ amount: 50, status: 'PENDING' }),
          makePayment({ amount: 75, status: 'PARTIAL' }),
        ] as never);

        const result = await service.getRevenueSummary(TENANT_ID, 'monthly');

        expect(result.unpaidCount).toBe(2);
      });

      it('returns zeros when no payments exist', async () => {
        prisma.sessionPayment.findMany.mockResolvedValue([] as never);

        const result = await service.getRevenueSummary(TENANT_ID, 'weekly');

        expect(result).toMatchObject({
          totalRevenue: 0,
          collected: 0,
          pending: 0,
          unpaidCount: 0,
        });
      });
    });

    describe('date range — weekly', () => {
      it('queries from 7 days ago for weekly period', async () => {
        prisma.sessionPayment.findMany.mockResolvedValue([] as never);

        await service.getRevenueSummary(TENANT_ID, 'weekly');

        const expectedStart = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
        expect(prisma.sessionPayment.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              sessionDate: { gte: expectedStart },
            }),
          }),
        );
      });

      it('returns period="weekly" and correct from/to in result', async () => {
        prisma.sessionPayment.findMany.mockResolvedValue([] as never);

        const result = await service.getRevenueSummary(TENANT_ID, 'weekly');

        const expectedStart = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
        expect(result.period).toBe('weekly');
        expect(result.from).toBe(expectedStart.toISOString());
        expect(result.to).toBe(NOW.toISOString());
      });
    });

    describe('date range — monthly', () => {
      it('queries from first day of current month for monthly period', async () => {
        prisma.sessionPayment.findMany.mockResolvedValue([] as never);

        await service.getRevenueSummary(TENANT_ID, 'monthly');

        // NOW = 2025-06-15 → first day of June 2025
        const expectedStart = new Date(2025, 5, 1); // month is 0-indexed
        expect(prisma.sessionPayment.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              sessionDate: { gte: expectedStart },
            }),
          }),
        );
      });

      it('returns period="monthly" in result', async () => {
        prisma.sessionPayment.findMany.mockResolvedValue([] as never);

        const result = await service.getRevenueSummary(TENANT_ID, 'monthly');

        expect(result.period).toBe('monthly');
      });
    });

    describe('psychologistId filter', () => {
      it('adds psychologistId to query when provided', async () => {
        prisma.sessionPayment.findMany.mockResolvedValue([] as never);

        await service.getRevenueSummary(TENANT_ID, 'monthly', PSYCHOLOGIST_ID);

        expect(prisma.sessionPayment.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ psychologistId: PSYCHOLOGIST_ID }),
          }),
        );
      });

      it('does not add psychologistId to query when not provided', async () => {
        prisma.sessionPayment.findMany.mockResolvedValue([] as never);

        await service.getRevenueSummary(TENANT_ID, 'monthly');

        const call = prisma.sessionPayment.findMany.mock.calls[0][0] as {
          where: Record<string, unknown>;
        };
        expect(call.where).not.toHaveProperty('psychologistId');
      });
    });

    describe('query filters', () => {
      it('always filters by tenantId and status in [PENDING, PAID, PARTIAL]', async () => {
        prisma.sessionPayment.findMany.mockResolvedValue([] as never);

        await service.getRevenueSummary(TENANT_ID, 'monthly');

        expect(prisma.sessionPayment.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              tenantId: TENANT_ID,
              status: { in: ['PENDING', 'PAID', 'PARTIAL'] },
            }),
          }),
        );
      });
    });
  });
});
