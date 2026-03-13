import { Injectable, Logger } from '@nestjs/common';
import { TenantPlan } from 'prisma-client';
import { PrismaService } from '../../database/prisma.service';
import { StripeSubscriptionService } from '../payments/stripe-subscription.service';

const DEFAULT_QUOTAS: Record<TenantPlan, number> = {
  FREE: 25,
  PRO: 250,
  PROPLUS: 500,
};

const DEFAULT_PRICES: Record<TenantPlan, number> = {
  FREE: 0,
  PRO: 999,
  PROPLUS: 1200,
};

const DEFAULT_TRIAL_DAYS: Record<TenantPlan, number> = {
  FREE: 7,
  PRO: 0,
  PROPLUS: 0,
};

const DEFAULT_TESTS_PER_SESSION: Record<TenantPlan, number> = {
  FREE: 1,
  PRO: 5,
  PROPLUS: 10,
};

const DEFAULT_FORMS_PER_SESSION: Record<TenantPlan, number> = {
  FREE: 1,
  PRO: 5,
  PROPLUS: 10,
};

const DEFAULT_REMINDERS_PER_SESSION: Record<TenantPlan, number> = {
  FREE: 0,
  PRO: 2,
  PROPLUS: 5,
};

const DEFAULT_CUSTOM_FORM_QUOTA: Record<TenantPlan, number> = {
  FREE: 0,
  PRO: 1,
  PROPLUS: 10,
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeSubscription: StripeSubscriptionService,
  ) {}

  /** Belirli plan için en güncel PlanConfig'i döndürür. Yoksa varsayılanları kullanır. */
  async getCurrentPlanConfig(planCode: TenantPlan): Promise<{
    monthlySessionQuota: number;
    testsPerSession: number;
    formsPerSession: number;
    remindersPerSession: number;
    customFormQuota: number;
  }> {
    const config = await this.prisma.planConfig.findFirst({
      where: { planCode },
      orderBy: { createdAt: 'desc' },
    });
    return {
      monthlySessionQuota: config?.monthlySessionQuota ?? DEFAULT_QUOTAS[planCode],
      testsPerSession: config?.testsPerSession ?? DEFAULT_TESTS_PER_SESSION[planCode],
      formsPerSession: config?.formsPerSession ?? DEFAULT_FORMS_PER_SESSION[planCode],
      remindersPerSession: config?.remindersPerSession ?? DEFAULT_REMINDERS_PER_SESSION[planCode],
      customFormQuota: config?.customFormQuota ?? DEFAULT_CUSTOM_FORM_QUOTA[planCode],
    };
  }

  /** Tüm planların güncel config'lerini döndürür. */
  async getAllPlanConfigs(): Promise<{
    planCode: TenantPlan;
    monthlySessionQuota: number;
    testsPerSession: number;
    formsPerSession: number;
    remindersPerSession: number;
    customFormQuota: number;
    monthlyPrice: number;
    trialDays: number;
    updatedAt: Date;
  }[]> {
    const plans: TenantPlan[] = ['FREE', 'PRO', 'PROPLUS'];
    return Promise.all(
      plans.map(async (planCode) => {
        const config = await this.prisma.planConfig.findFirst({
          where: { planCode },
          orderBy: { createdAt: 'desc' },
        });
        return {
          planCode,
          monthlySessionQuota: config?.monthlySessionQuota ?? DEFAULT_QUOTAS[planCode],
          testsPerSession: config?.testsPerSession ?? DEFAULT_TESTS_PER_SESSION[planCode],
          formsPerSession: config?.formsPerSession ?? DEFAULT_FORMS_PER_SESSION[planCode],
          remindersPerSession: config?.remindersPerSession ?? DEFAULT_REMINDERS_PER_SESSION[planCode],
          customFormQuota: config?.customFormQuota ?? DEFAULT_CUSTOM_FORM_QUOTA[planCode],
          monthlyPrice: config?.monthlyPrice ?? DEFAULT_PRICES[planCode],
          trialDays: config?.trialDays ?? DEFAULT_TRIAL_DAYS[planCode],
          updatedAt: config?.updatedAt ?? new Date(0),
        };
      }),
    );
  }

  /** Yeni PlanConfig kaydı oluşturur (geçmiş korunur). */
  async upsertPlanConfig(
    planCode: TenantPlan,
    monthlySessionQuota: number,
    testsPerSession: number,
    formsPerSession: number,
    remindersPerSession: number,
    customFormQuota: number,
    monthlyPrice: number,
    trialDays: number,
    createdBy?: string,
  ) {
    return this.prisma.planConfig.create({
      data: {
        planCode, monthlySessionQuota,
        testsPerSession, formsPerSession, remindersPerSession,
        customFormQuota, monthlyPrice, trialDays, createdBy,
      },
    });
  }

  /**
   * Kayıt sırasında çağrılır. Aktif planın config'ini snapshot alır,
   * TenantSubscription oluşturur ve bu ay için MonthlySessionBudget hazırlar.
   */
  async createInitialSubscription(tenantId: string, planCode: TenantPlan) {
    const config = await this.getCurrentPlanConfig(planCode);

    await this.prisma.tenantSubscription.create({
      data: {
        tenantId,
        planCode,
        monthlySessionQuota: config.monthlySessionQuota,
        testsPerSession: config.testsPerSession,
        formsPerSession: config.formsPerSession,
        remindersPerSession: config.remindersPerSession,
        customFormQuota: config.customFormQuota,
      },
    });

    await this.ensureMonthlyBudget(tenantId, config.monthlySessionQuota);
    this.logger.log(
      `Subscription oluşturuldu: tenant=${tenantId} plan=${planCode} quota=${config.monthlySessionQuota}`,
    );
  }

  /**
   * Plan yükseltme (FREE→PRO).
   * - Eski aboneliği kapatır, yeni oluşturur.
   * - Bu ayki kalan hak KORUNUR ve yeni kotanın üzerine eklenir.
   * - Tenant.plan güncellenir.
   */
  async upgradePlan(tenantId: string, newPlan: TenantPlan) {
    const config = await this.getCurrentPlanConfig(newPlan);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Eski aboneliği kapat
    await this.prisma.tenantSubscription.updateMany({
      where: { tenantId, endDate: null },
      data: { endDate: now },
    });

    // Yeni abonelik snapshot'ı
    await this.prisma.tenantSubscription.create({
      data: {
        tenantId,
        planCode: newPlan,
        monthlySessionQuota: config.monthlySessionQuota,
        testsPerSession: config.testsPerSession,
        formsPerSession: config.formsPerSession,
        remindersPerSession: config.remindersPerSession,
        customFormQuota: config.customFormQuota,
        startDate: now,
      },
    });

    // Bu ayki bütçeye yeni kotayı ekle (kalan üzerine eklenir)
    const existing = await this.prisma.monthlySessionBudget.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });

    if (existing) {
      await this.prisma.monthlySessionBudget.update({
        where: { tenantId_year_month: { tenantId, year, month } },
        data: { totalQuota: { increment: config.monthlySessionQuota } },
      });
    } else {
      await this.prisma.monthlySessionBudget.create({
        data: { tenantId, year, month, totalQuota: config.monthlySessionQuota },
      });
    }

    // Tenant planını güncelle
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: newPlan },
    });

    // Stripe aboneliğini güncelle (opsiyonel — price ID yoksa atla)
    const priceId = this.stripeSubscription.getPriceId(newPlan);
    if (priceId) {
      try {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (tenant?.subscriptionId) {
          await this.stripeSubscription.updateSubscription(tenant.subscriptionId, priceId);
        }
      } catch (err) {
        this.logger.warn(`Stripe plan update failed for tenant ${tenantId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.logger.log(
      `Plan yükseltildi: tenant=${tenantId} → ${newPlan} ek_kota=${config.monthlySessionQuota}`,
    );
  }

  /**
   * Plan düşürme (PRO→FREE veya PROPLUS→PRO).
   * - Eski aboneliği kapatır, yeni oluşturur.
   * - Bu ayki kota yeni planın kotasıyla değiştirilir.
   * - Tenant.plan güncellenir.
   */
  async downgradePlan(tenantId: string, newPlan: TenantPlan) {
    const config = await this.getCurrentPlanConfig(newPlan);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Eski aboneliği kapat
    await this.prisma.tenantSubscription.updateMany({
      where: { tenantId, endDate: null },
      data: { endDate: now },
    });

    // Yeni abonelik snapshot'ı
    await this.prisma.tenantSubscription.create({
      data: {
        tenantId,
        planCode: newPlan,
        monthlySessionQuota: config.monthlySessionQuota,
        testsPerSession: config.testsPerSession,
        formsPerSession: config.formsPerSession,
        remindersPerSession: config.remindersPerSession,
        customFormQuota: config.customFormQuota,
        startDate: now,
      },
    });

    // Bu ayki bütçeyi yeni kota ile sıfırla (düşürme: mevcut kullanımı koru)
    const existing = await this.prisma.monthlySessionBudget.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });

    if (existing) {
      await this.prisma.monthlySessionBudget.update({
        where: { tenantId_year_month: { tenantId, year, month } },
        data: { totalQuota: config.monthlySessionQuota },
      });
    } else {
      await this.prisma.monthlySessionBudget.create({
        data: { tenantId, year, month, totalQuota: config.monthlySessionQuota },
      });
    }

    // Tenant planını güncelle
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: newPlan },
    });

    // Stripe aboneliğini güncelle
    const priceId = this.stripeSubscription.getPriceId(newPlan);
    if (priceId) {
      try {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (tenant?.subscriptionId) {
          await this.stripeSubscription.updateSubscription(tenant.subscriptionId, priceId);
        }
      } catch (err) {
        this.logger.warn(`Stripe downgrade failed for tenant ${tenantId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.logger.log(
      `Plan düşürüldü: tenant=${tenantId} → ${newPlan} yeni_kota=${config.monthlySessionQuota}`,
    );
  }

  /** Bu ayki bütçeyi döndürür, yoksa oluşturur. */
  async ensureMonthlyBudget(tenantId: string, quota?: number) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    let totalQuota = quota;
    if (totalQuota === undefined) {
      const sub = await this.prisma.tenantSubscription.findFirst({
        where: { tenantId, endDate: null },
        orderBy: { startDate: 'desc' },
      });
      totalQuota = sub?.monthlySessionQuota ?? DEFAULT_QUOTAS['FREE'];
    }

    return this.prisma.monthlySessionBudget.upsert({
      where: { tenantId_year_month: { tenantId, year, month } },
      create: { tenantId, year, month, totalQuota },
      update: {}, // zaten varsa dokunma
    });
  }

  /** Tenant'ın bu ayki seans kullanımını döndürür. */
  async getMonthlyUsage(tenantId: string) {
    const budget = await this.ensureMonthlyBudget(tenantId);
    const remaining = Math.max(0, budget.totalQuota - budget.usedCount);
    return {
      total: budget.totalQuota,
      used: budget.usedCount,
      remaining,
      year: budget.year,
      month: budget.month,
    };
  }

  /** Randevu tamamlandığında/iptal edildiğinde çağrılır. 1 seans düşer. */
  async consumeSession(tenantId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    await this.ensureMonthlyBudget(tenantId);

    await this.prisma.monthlySessionBudget.update({
      where: { tenantId_year_month: { tenantId, year, month } },
      data: { usedCount: { increment: 1 } },
    });
  }

  /** Tenant'ın mevcut aktif aboneliğini döndürür. */
  async getActiveSubscription(tenantId: string) {
    return this.prisma.tenantSubscription.findFirst({
      where: { tenantId, endDate: null },
      orderBy: { startDate: 'desc' },
    });
  }

  /** Belirli bir kaynak için kota kontrolü yapar. */
  async checkQuota(
    tenantId: string,
    resource: 'clients' | 'sessions' | 'custom_forms',
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    if (resource === 'sessions') {
      const usage = await this.getMonthlyUsage(tenantId);
      return {
        allowed: usage.remaining > 0,
        current: usage.used,
        limit: usage.total,
      };
    }

    const sub = await this.getActiveSubscription(tenantId);
    const planCode = sub?.planCode ?? 'FREE';
    const planConfig = await this.getCurrentPlanConfig(planCode);

    if (resource === 'clients') {
      const current = await this.prisma.client.count({
        where: { tenantId, deletedAt: null },
      });
      // No hard client limit in current plans — always allowed
      const limit = Number.MAX_SAFE_INTEGER;
      return { allowed: true, current, limit };
    }

    // custom_forms
    const current = await this.prisma.formDefinition.count({
      where: { tenantId, formType: 'CUSTOM' },
    });
    const limit = sub?.customFormQuota ?? planConfig.customFormQuota;
    return { allowed: current < limit, current, limit };
  }
}
