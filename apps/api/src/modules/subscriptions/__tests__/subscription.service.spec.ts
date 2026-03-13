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
});
