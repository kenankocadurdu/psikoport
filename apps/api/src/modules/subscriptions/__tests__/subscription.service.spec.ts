import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from '../subscription.service';
import { PrismaService } from '../../../database/prisma.service';
import { StripeSubscriptionService } from '../../payments/stripe-subscription.service';

// ---------------------------------------------------------------------------
// Mock fabrikaları
// ---------------------------------------------------------------------------

const makePrisma = () => ({
  planConfig: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  tenantSubscription: {
    create: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
  },
  monthlySessionBudget: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  tenant: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  client: { count: jest.fn() },
  formDefinition: { count: jest.fn() },
});

const makeStripe = () => ({
  getPriceId: jest.fn().mockReturnValue(null), // default: Stripe devre dışı
  updateSubscription: jest.fn(),
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prisma: ReturnType<typeof makePrisma>;
  let stripe: ReturnType<typeof makeStripe>;

  beforeEach(async () => {
    prisma = makePrisma();
    stripe = makeStripe();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeSubscriptionService, useValue: stripe },
      ],
    }).compile();

    service = module.get(SubscriptionService);
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1.1 getCurrentPlanConfig()
  // =========================================================================

  describe('getCurrentPlanConfig()', () => {
    it('should return plan config from DB when it exists', async () => {
      const dbRecord = {
        monthlySessionQuota: 100,
        testsPerSession: 3,
        formsPerSession: 3,
        remindersPerSession: 1,
        customFormQuota: 2,
      };
      prisma.planConfig.findFirst.mockResolvedValue(dbRecord);

      const result = await service.getCurrentPlanConfig('PRO');

      expect(result).toEqual({
        monthlySessionQuota: 100,
        testsPerSession: 3,
        formsPerSession: 3,
        remindersPerSession: 1,
        customFormQuota: 2,
      });
      expect(prisma.planConfig.findFirst).toHaveBeenCalledWith({
        where: { planCode: 'PRO' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return hardcoded FREE defaults when no DB config found', async () => {
      prisma.planConfig.findFirst.mockResolvedValue(null);

      const result = await service.getCurrentPlanConfig('FREE');

      expect(result.monthlySessionQuota).toBe(25);
      expect(result.testsPerSession).toBe(1);
      expect(result.formsPerSession).toBe(1);
      expect(result.remindersPerSession).toBe(0);
      expect(result.customFormQuota).toBe(0);
    });

    it('should return hardcoded PRO defaults when no DB config found', async () => {
      prisma.planConfig.findFirst.mockResolvedValue(null);

      const result = await service.getCurrentPlanConfig('PRO');

      expect(result.monthlySessionQuota).toBe(250);
      expect(result.testsPerSession).toBe(5);
      expect(result.formsPerSession).toBe(5);
      expect(result.remindersPerSession).toBe(2);
      expect(result.customFormQuota).toBe(1);
    });

    it('should return hardcoded PROPLUS defaults when no DB config found', async () => {
      prisma.planConfig.findFirst.mockResolvedValue(null);

      const result = await service.getCurrentPlanConfig('PROPLUS');

      expect(result.monthlySessionQuota).toBe(500);
      expect(result.testsPerSession).toBe(10);
      expect(result.formsPerSession).toBe(10);
      expect(result.remindersPerSession).toBe(5);
      expect(result.customFormQuota).toBe(10);
    });

    it('should use DB value only for fields present, default for missing fields', async () => {
      // DB kaydında sadece monthlySessionQuota var, geri kalanlar null
      const partialRecord = {
        monthlySessionQuota: 999,
        testsPerSession: null,
        formsPerSession: null,
        remindersPerSession: null,
        customFormQuota: null,
      };
      prisma.planConfig.findFirst.mockResolvedValue(partialRecord);

      const result = await service.getCurrentPlanConfig('PRO');

      expect(result.monthlySessionQuota).toBe(999);  // DB'den
      expect(result.testsPerSession).toBe(5);         // PRO default
      expect(result.formsPerSession).toBe(5);         // PRO default
    });
  });

  // =========================================================================
  // 1.2 upgradePlan()
  // =========================================================================

  describe('upgradePlan()', () => {
    const TENANT_ID = 'tenant-abc';

    /** PRO planı için standart DB config mock'u */
    const setupProConfig = () => {
      prisma.planConfig.findFirst.mockResolvedValue({
        monthlySessionQuota: 250,
        testsPerSession: 5,
        formsPerSession: 5,
        remindersPerSession: 2,
        customFormQuota: 1,
      });
    };

    it('should close old subscription by setting endDate to now', async () => {
      setupProConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({ totalQuota: 250, usedCount: 0 });

      await service.upgradePlan(TENANT_ID, 'PRO');

      expect(prisma.tenantSubscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, endDate: null },
          data: expect.objectContaining({ endDate: expect.any(Date) }),
        }),
      );
    });

    it('should create a new subscription snapshot for the new plan', async () => {
      setupProConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({ totalQuota: 250, usedCount: 0 });

      await service.upgradePlan(TENANT_ID, 'PRO');

      expect(prisma.tenantSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            planCode: 'PRO',
            monthlySessionQuota: 250,
          }),
        }),
      );
    });

    it('should ADD new quota on top of existing monthly budget (additive on upgrade)', async () => {
      setupProConfig();
      // Bu ay zaten bir budget var: 10 kullanılmış, toplam 25
      prisma.monthlySessionBudget.findUnique.mockResolvedValue({
        tenantId: TENANT_ID,
        totalQuota: 25,
        usedCount: 10,
      });
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});

      await service.upgradePlan(TENANT_ID, 'PRO');

      // Mevcut budget'a 250 eklenmeli (replace değil, increment)
      expect(prisma.monthlySessionBudget.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totalQuota: { increment: 250 } },
        }),
      );
      // create çağrılmamalı
      expect(prisma.monthlySessionBudget.create).not.toHaveBeenCalled();
    });

    it('should create a fresh monthly budget when none exists for the current month', async () => {
      setupProConfig();
      // Bu ay hiç budget yok
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});

      await service.upgradePlan(TENANT_ID, 'PRO');

      expect(prisma.monthlySessionBudget.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            totalQuota: 250,
          }),
        }),
      );
      // update çağrılmamalı
      expect(prisma.monthlySessionBudget.update).not.toHaveBeenCalled();
    });

    it('should update tenant.plan to the new plan', async () => {
      setupProConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});

      await service.upgradePlan(TENANT_ID, 'PRO');

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TENANT_ID },
          data: { plan: 'PRO' },
        }),
      );
    });

    it('should NOT call Stripe when no priceId is configured', async () => {
      setupProConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});
      stripe.getPriceId.mockReturnValue(null); // Stripe yapılandırılmamış

      await service.upgradePlan(TENANT_ID, 'PRO');

      expect(stripe.updateSubscription).not.toHaveBeenCalled();
    });

    it('should call Stripe updateSubscription when priceId is configured and tenant has subscriptionId', async () => {
      setupProConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});
      stripe.getPriceId.mockReturnValue('price_pro_123');
      prisma.tenant.findUnique.mockResolvedValue({
        id: TENANT_ID,
        subscriptionId: 'sub_stripe_456',
      });

      await service.upgradePlan(TENANT_ID, 'PRO');

      expect(stripe.updateSubscription).toHaveBeenCalledWith('sub_stripe_456', 'price_pro_123');
    });

    it('should NOT call Stripe updateSubscription when tenant has no subscriptionId', async () => {
      setupProConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});
      stripe.getPriceId.mockReturnValue('price_pro_123');
      prisma.tenant.findUnique.mockResolvedValue({
        id: TENANT_ID,
        subscriptionId: null, // Stripe aboneliği yok
      });

      await service.upgradePlan(TENANT_ID, 'PRO');

      expect(stripe.updateSubscription).not.toHaveBeenCalled();
    });

    it('should complete upgrade successfully even if Stripe throws an error', async () => {
      setupProConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});
      stripe.getPriceId.mockReturnValue('price_pro_123');
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, subscriptionId: 'sub_456' });
      stripe.updateSubscription.mockRejectedValue(new Error('Stripe API down'));

      // Stripe hatası upgrade işlemini patlatmamalı
      await expect(service.upgradePlan(TENANT_ID, 'PRO')).resolves.not.toThrow();
      // Tenant planı yine de güncellenmiş olmalı
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { plan: 'PRO' } }),
      );
    });
  });

  // =========================================================================
  // 1.3 downgradePlan()
  // =========================================================================

  describe('downgradePlan()', () => {
    const TENANT_ID = 'tenant-xyz';

    /** FREE planı için standart DB config mock'u */
    const setupFreeConfig = () => {
      prisma.planConfig.findFirst.mockResolvedValue({
        monthlySessionQuota: 25,
        testsPerSession: 1,
        formsPerSession: 1,
        remindersPerSession: 0,
        customFormQuota: 0,
      });
    };

    it('should close old subscription by setting endDate to now', async () => {
      setupFreeConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({ totalQuota: 25, usedCount: 0 });

      await service.downgradePlan(TENANT_ID, 'FREE');

      expect(prisma.tenantSubscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, endDate: null },
          data: expect.objectContaining({ endDate: expect.any(Date) }),
        }),
      );
    });

    it('should create a new subscription snapshot for the new plan', async () => {
      setupFreeConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({ totalQuota: 25, usedCount: 0 });

      await service.downgradePlan(TENANT_ID, 'FREE');

      expect(prisma.tenantSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            planCode: 'FREE',
            monthlySessionQuota: 25,
          }),
        }),
      );
    });

    it('should REPLACE monthly budget with new plan quota on downgrade (not additive)', async () => {
      setupFreeConfig();
      // Mevcut PRO budget: toplam 250
      prisma.monthlySessionBudget.findUnique.mockResolvedValue({
        tenantId: TENANT_ID,
        totalQuota: 250,
        usedCount: 10,
      });
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});

      await service.downgradePlan(TENANT_ID, 'FREE');

      // 250'ye 25 EKLENMEMELI; doğrudan 25 olarak set edilmeli
      expect(prisma.monthlySessionBudget.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totalQuota: 25 },           // increment değil, sabit değer
        }),
      );
      expect(prisma.monthlySessionBudget.create).not.toHaveBeenCalled();
    });

    it('should NOT use increment on downgrade budget update (unlike upgrade)', async () => {
      setupFreeConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue({
        totalQuota: 250,
        usedCount: 5,
      });
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});

      await service.downgradePlan(TENANT_ID, 'FREE');

      const updateCall = prisma.monthlySessionBudget.update.mock.calls[0][0];
      // data.totalQuota bir nesne (increment wrapper) olmamalı, sayı olmalı
      expect(typeof updateCall.data.totalQuota).toBe('number');
      expect(updateCall.data.totalQuota).toBe(25);
    });

    it('should create a fresh budget with new quota when no budget exists for the current month', async () => {
      setupFreeConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});

      await service.downgradePlan(TENANT_ID, 'FREE');

      expect(prisma.monthlySessionBudget.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            totalQuota: 25,
          }),
        }),
      );
      expect(prisma.monthlySessionBudget.update).not.toHaveBeenCalled();
    });

    it('should update tenant.plan to the new (lower) plan', async () => {
      setupFreeConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});

      await service.downgradePlan(TENANT_ID, 'FREE');

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TENANT_ID },
          data: { plan: 'FREE' },
        }),
      );
    });

    it('should NOT call Stripe when no priceId is configured', async () => {
      setupFreeConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});
      stripe.getPriceId.mockReturnValue(null);

      await service.downgradePlan(TENANT_ID, 'FREE');

      expect(stripe.updateSubscription).not.toHaveBeenCalled();
    });

    it('should call Stripe updateSubscription when priceId is configured and tenant has subscriptionId', async () => {
      setupFreeConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});
      stripe.getPriceId.mockReturnValue('price_free_000');
      prisma.tenant.findUnique.mockResolvedValue({
        id: TENANT_ID,
        subscriptionId: 'sub_stripe_789',
      });

      await service.downgradePlan(TENANT_ID, 'FREE');

      expect(stripe.updateSubscription).toHaveBeenCalledWith('sub_stripe_789', 'price_free_000');
    });

    it('should complete downgrade successfully even if Stripe throws an error', async () => {
      setupFreeConfig();
      prisma.monthlySessionBudget.findUnique.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({});
      stripe.getPriceId.mockReturnValue('price_free_000');
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, subscriptionId: 'sub_789' });
      stripe.updateSubscription.mockRejectedValue(new Error('Stripe timeout'));

      await expect(service.downgradePlan(TENANT_ID, 'FREE')).resolves.not.toThrow();
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { plan: 'FREE' } }),
      );
    });
  });

  // =========================================================================
  // 1.4 consumeSession()
  // =========================================================================

  describe('consumeSession()', () => {
    const TENANT_ID = 'tenant-consume';

    /** ensureMonthlyBudget içindeki upsert'i başarılı yapan minimum mock */
    const setupBudgetUpsert = () => {
      prisma.tenantSubscription.findFirst.mockResolvedValue(null); // sub yok → FREE default
      prisma.monthlySessionBudget.upsert.mockResolvedValue({
        tenantId: TENANT_ID,
        totalQuota: 25,
        usedCount: 3,
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
      });
    };

    it('should increment usedCount by exactly 1 using Prisma increment operator', async () => {
      setupBudgetUpsert();
      prisma.monthlySessionBudget.update.mockResolvedValue({});

      await service.consumeSession(TENANT_ID);

      expect(prisma.monthlySessionBudget.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { usedCount: { increment: 1 } },
        }),
      );
    });

    it('should call ensureMonthlyBudget (upsert) before the increment update', async () => {
      setupBudgetUpsert();
      prisma.monthlySessionBudget.update.mockResolvedValue({});

      await service.consumeSession(TENANT_ID);

      // upsert önce, update sonra çağrılmalı
      const upsertOrder = prisma.monthlySessionBudget.upsert.mock.invocationCallOrder[0];
      const updateOrder = prisma.monthlySessionBudget.update.mock.invocationCallOrder[0];
      expect(upsertOrder).toBeLessThan(updateOrder);
    });

    it('should use current year and month in the update where clause', async () => {
      // Zamanı sabit bir noktaya kilitle
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-08-15T10:00:00Z'));

      setupBudgetUpsert();
      prisma.monthlySessionBudget.update.mockResolvedValue({});

      await service.consumeSession(TENANT_ID);

      expect(prisma.monthlySessionBudget.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_year_month: {
              tenantId: TENANT_ID,
              year: 2025,
              month: 8,
            },
          },
        }),
      );

      jest.useRealTimers();
    });

    it('should pass tenantId to the update where clause', async () => {
      setupBudgetUpsert();
      prisma.monthlySessionBudget.update.mockResolvedValue({});

      await service.consumeSession(TENANT_ID);

      const updateCall = prisma.monthlySessionBudget.update.mock.calls[0][0];
      expect(updateCall.where.tenantId_year_month.tenantId).toBe(TENANT_ID);
    });

    it('should upsert budget with FREE default quota when no active subscription exists', async () => {
      // Aktif abonelik yok → ensureMonthlyBudget FREE quota (25) kullanmalı
      prisma.tenantSubscription.findFirst.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({ totalQuota: 25, usedCount: 0 });
      prisma.monthlySessionBudget.update.mockResolvedValue({});

      await service.consumeSession(TENANT_ID);

      expect(prisma.monthlySessionBudget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ totalQuota: 25 }),
        }),
      );
    });

    it('should upsert budget with subscription quota when active subscription exists', async () => {
      // Aktif PRO abonelik var → ensureMonthlyBudget 250 kullanmalı
      prisma.tenantSubscription.findFirst.mockResolvedValue({
        monthlySessionQuota: 250,
        endDate: null,
      });
      prisma.monthlySessionBudget.upsert.mockResolvedValue({ totalQuota: 250, usedCount: 5 });
      prisma.monthlySessionBudget.update.mockResolvedValue({});

      await service.consumeSession(TENANT_ID);

      expect(prisma.monthlySessionBudget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ totalQuota: 250 }),
        }),
      );
    });
  });

  // =========================================================================
  // 1.5 checkQuota()
  // =========================================================================

  describe('checkQuota()', () => {
    const TENANT_ID = 'tenant-quota';

    /**
     * sessions branch için: getMonthlyUsage → ensureMonthlyBudget → upsert
     * totalQuota ve usedCount değerlerini dışarıdan parametre olarak alır.
     */
    const setupSessionsBudget = (totalQuota: number, usedCount: number) => {
      prisma.tenantSubscription.findFirst.mockResolvedValue(null);
      prisma.monthlySessionBudget.upsert.mockResolvedValue({
        totalQuota,
        usedCount,
        year: 2025,
        month: 8,
      });
    };

    /**
     * clients / custom_forms branch için: getActiveSubscription → findFirst
     */
    const setupActiveSub = (sub: Record<string, unknown> | null) => {
      prisma.tenantSubscription.findFirst.mockResolvedValue(sub);
    };

    // -----------------------------------------------------------------------
    // sessions
    // -----------------------------------------------------------------------

    describe('resource: sessions', () => {
      it('should return allowed=true when remaining sessions > 0', async () => {
        setupSessionsBudget(25, 10); // remaining = 15

        const result = await service.checkQuota(TENANT_ID, 'sessions');

        expect(result.allowed).toBe(true);
        expect(result.current).toBe(10);
        expect(result.limit).toBe(25);
      });

      it('should return allowed=false when all sessions are consumed (usedCount === totalQuota)', async () => {
        setupSessionsBudget(25, 25); // remaining = 0

        const result = await service.checkQuota(TENANT_ID, 'sessions');

        expect(result.allowed).toBe(false);
        expect(result.current).toBe(25);
        expect(result.limit).toBe(25);
      });

      it('should return allowed=false when usedCount exceeds totalQuota (Math.max guard)', async () => {
        setupSessionsBudget(25, 30); // remaining = Math.max(0, -5) = 0

        const result = await service.checkQuota(TENANT_ID, 'sessions');

        expect(result.allowed).toBe(false);
      });

      it('should return allowed=true when budget is completely untouched (usedCount === 0)', async () => {
        setupSessionsBudget(25, 0); // remaining = 25

        const result = await service.checkQuota(TENANT_ID, 'sessions');

        expect(result.allowed).toBe(true);
        expect(result.current).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    // clients
    // -----------------------------------------------------------------------

    describe('resource: clients', () => {
      beforeEach(() => {
        // clients branch planConfig'e de ulaşır → findFirst iki kez: getActiveSubscription + getCurrentPlanConfig
        setupActiveSub(null);
        prisma.planConfig.findFirst.mockResolvedValue(null); // FREE defaults
      });

      it('should always return allowed=true regardless of client count', async () => {
        prisma.client.count.mockResolvedValue(9999);

        const result = await service.checkQuota(TENANT_ID, 'clients');

        expect(result.allowed).toBe(true);
      });

      it('should return the actual client count as current', async () => {
        prisma.client.count.mockResolvedValue(42);

        const result = await service.checkQuota(TENANT_ID, 'clients');

        expect(result.current).toBe(42);
      });

      it('should return Number.MAX_SAFE_INTEGER as limit for clients', async () => {
        prisma.client.count.mockResolvedValue(0);

        const result = await service.checkQuota(TENANT_ID, 'clients');

        expect(result.limit).toBe(Number.MAX_SAFE_INTEGER);
      });

      it('should query only non-deleted clients (deletedAt: null)', async () => {
        prisma.client.count.mockResolvedValue(5);

        await service.checkQuota(TENANT_ID, 'clients');

        expect(prisma.client.count).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ tenantId: TENANT_ID, deletedAt: null }),
          }),
        );
      });
    });

    // -----------------------------------------------------------------------
    // custom_forms
    // -----------------------------------------------------------------------

    describe('resource: custom_forms', () => {

      it('should return allowed=true when form count is below subscription quota', async () => {
        setupActiveSub({ planCode: 'PRO', customFormQuota: 5, endDate: null });
        prisma.planConfig.findFirst.mockResolvedValue(null);
        prisma.formDefinition.count.mockResolvedValue(3); // 3 < 5

        const result = await service.checkQuota(TENANT_ID, 'custom_forms');

        expect(result.allowed).toBe(true);
        expect(result.current).toBe(3);
        expect(result.limit).toBe(5);
      });

      it('should return allowed=false when form count equals subscription quota', async () => {
        setupActiveSub({ planCode: 'PRO', customFormQuota: 5, endDate: null });
        prisma.planConfig.findFirst.mockResolvedValue(null);
        prisma.formDefinition.count.mockResolvedValue(5); // 5 === 5, not < 5

        const result = await service.checkQuota(TENANT_ID, 'custom_forms');

        expect(result.allowed).toBe(false);
        expect(result.current).toBe(5);
        expect(result.limit).toBe(5);
      });

      it('should return allowed=false when form count exceeds subscription quota', async () => {
        setupActiveSub({ planCode: 'PRO', customFormQuota: 5, endDate: null });
        prisma.planConfig.findFirst.mockResolvedValue(null);
        prisma.formDefinition.count.mockResolvedValue(7); // 7 > 5

        const result = await service.checkQuota(TENANT_ID, 'custom_forms');

        expect(result.allowed).toBe(false);
      });

      it('should use planConfig customFormQuota as fallback when no active subscription', async () => {
        setupActiveSub(null); // sub yok → planCode = 'FREE'
        prisma.planConfig.findFirst.mockResolvedValue({
          monthlySessionQuota: 25,
          testsPerSession: 1,
          formsPerSession: 1,
          remindersPerSession: 0,
          customFormQuota: 0, // FREE: özel form yok
        });
        prisma.formDefinition.count.mockResolvedValue(0);

        const result = await service.checkQuota(TENANT_ID, 'custom_forms');

        // 0 < 0 = false → allowed=false, limit=0
        expect(result.limit).toBe(0);
        expect(result.allowed).toBe(false);
      });

      it('should prefer subscription customFormQuota over planConfig when both exist', async () => {
        // Abonelik kaydında quota=10, planConfig'de quota=1 → abonelik kazanmalı
        setupActiveSub({ planCode: 'PRO', customFormQuota: 10, endDate: null });
        prisma.planConfig.findFirst.mockResolvedValue({ customFormQuota: 1 });
        prisma.formDefinition.count.mockResolvedValue(3);

        const result = await service.checkQuota(TENANT_ID, 'custom_forms');

        expect(result.limit).toBe(10); // sub.customFormQuota kazandı
        expect(result.allowed).toBe(true);
      });

      it('should query only CUSTOM type forms', async () => {
        setupActiveSub({ planCode: 'PRO', customFormQuota: 5, endDate: null });
        prisma.planConfig.findFirst.mockResolvedValue(null);
        prisma.formDefinition.count.mockResolvedValue(2);

        await service.checkQuota(TENANT_ID, 'custom_forms');

        expect(prisma.formDefinition.count).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ tenantId: TENANT_ID, formType: 'CUSTOM' }),
          }),
        );
      });
    });
  });

  // =========================================================================
  // 1.6 ensureMonthlyBudget()
  // =========================================================================

  describe('ensureMonthlyBudget()', () => {
    const TENANT_ID = 'tenant-budget';

    const mockUpsert = (returnValue = { tenantId: TENANT_ID, totalQuota: 25, usedCount: 0, year: 2025, month: 8 }) => {
      prisma.monthlySessionBudget.upsert.mockResolvedValue(returnValue);
    };

    // -----------------------------------------------------------------------
    // quota parametresi sağlandığında
    // -----------------------------------------------------------------------

    describe('when quota argument is provided', () => {
      it('should skip subscription query and use provided quota directly', async () => {
        mockUpsert();

        await service.ensureMonthlyBudget(TENANT_ID, 100);

        expect(prisma.tenantSubscription.findFirst).not.toHaveBeenCalled();
      });

      it('should create budget with the exact provided quota', async () => {
        mockUpsert();

        await service.ensureMonthlyBudget(TENANT_ID, 100);

        expect(prisma.monthlySessionBudget.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({ totalQuota: 100 }),
          }),
        );
      });

      it('should return the upserted budget record', async () => {
        const budget = { tenantId: TENANT_ID, totalQuota: 100, usedCount: 5, year: 2025, month: 8 };
        prisma.monthlySessionBudget.upsert.mockResolvedValue(budget);

        const result = await service.ensureMonthlyBudget(TENANT_ID, 100);

        expect(result).toEqual(budget);
      });
    });

    // -----------------------------------------------------------------------
    // quota parametresi verilmediğinde — abonelik sorgusu yapılır
    // -----------------------------------------------------------------------

    describe('when quota argument is NOT provided', () => {
      it('should query the active subscription to derive quota', async () => {
        prisma.tenantSubscription.findFirst.mockResolvedValue({ monthlySessionQuota: 250, endDate: null });
        mockUpsert({ tenantId: TENANT_ID, totalQuota: 250, usedCount: 0, year: 2025, month: 8 });

        await service.ensureMonthlyBudget(TENANT_ID);

        expect(prisma.tenantSubscription.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { tenantId: TENANT_ID, endDate: null },
            orderBy: { startDate: 'desc' },
          }),
        );
      });

      it('should use subscription monthlySessionQuota when active subscription exists', async () => {
        prisma.tenantSubscription.findFirst.mockResolvedValue({ monthlySessionQuota: 250, endDate: null });
        mockUpsert();

        await service.ensureMonthlyBudget(TENANT_ID);

        expect(prisma.monthlySessionBudget.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({ totalQuota: 250 }),
          }),
        );
      });

      it('should fall back to FREE default quota (25) when no active subscription exists', async () => {
        prisma.tenantSubscription.findFirst.mockResolvedValue(null);
        mockUpsert();

        await service.ensureMonthlyBudget(TENANT_ID);

        expect(prisma.monthlySessionBudget.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({ totalQuota: 25 }),
          }),
        );
      });
    });

    // -----------------------------------------------------------------------
    // upsert davranışı
    // -----------------------------------------------------------------------

    describe('upsert behavior', () => {
      it('should use tenantId_year_month composite key in the where clause', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-08-15T10:00:00Z'));

        prisma.tenantSubscription.findFirst.mockResolvedValue(null);
        mockUpsert();

        await service.ensureMonthlyBudget(TENANT_ID);

        expect(prisma.monthlySessionBudget.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              tenantId_year_month: { tenantId: TENANT_ID, year: 2025, month: 8 },
            },
          }),
        );

        jest.useRealTimers();
      });

      it('should pass empty update object so existing budgets are NOT overwritten', async () => {
        prisma.tenantSubscription.findFirst.mockResolvedValue(null);
        mockUpsert();

        await service.ensureMonthlyBudget(TENANT_ID);

        const upsertArg = prisma.monthlySessionBudget.upsert.mock.calls[0][0];
        expect(upsertArg.update).toEqual({});
      });

      it('should include tenantId, year, and month in the create payload', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-08-15T10:00:00Z'));

        prisma.tenantSubscription.findFirst.mockResolvedValue(null);
        mockUpsert();

        await service.ensureMonthlyBudget(TENANT_ID, 50);

        expect(prisma.monthlySessionBudget.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: { tenantId: TENANT_ID, year: 2025, month: 8, totalQuota: 50 },
          }),
        );

        jest.useRealTimers();
      });
    });
  });
});
