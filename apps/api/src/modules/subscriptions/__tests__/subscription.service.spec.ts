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
});
