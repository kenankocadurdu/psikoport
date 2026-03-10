/**
 * Abonelik planları — MASTER_README Section 8
 */

export const PLAN_LIMITS = {
  free: {
    maxClients: 10,
    maxTestsPerMonth: 5,
    aiSummaries: 0,
    maxUsers: 1,
  },
  pro: {
    maxClients: Infinity,
    maxTestsPerMonth: Infinity,
    aiSummaries: 20,
    maxUsers: 1,
  },
  enterprise: {
    maxClients: Infinity,
    maxTestsPerMonth: Infinity,
    aiSummaries: Infinity,
    maxUsers: 5,
  },
} as const;

export interface SubscriptionPlanInfo {
  code: 'free' | 'pro' | 'enterprise';
  name: string;
  nameEn?: string;
  priceMonthly?: number;
  priceYearly?: number;
  currency?: string;
  features: readonly string[];
}

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlanInfo[] = [
  {
    code: 'free',
    name: 'Ücretsiz',
    nameEn: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'TRY',
    features: [
      '10 danışan',
      '5 test/ay',
      'Temel CRM + notlar',
      'Temel gelir takibi',
      'Online görüşme linki',
    ],
  },
  {
    code: 'pro',
    name: 'Pro',
    nameEn: 'Pro',
    priceMonthly: 999,
    priceYearly: 9990,
    currency: 'TRY',
    features: [
      'Sınırsız danışan',
      'Sınırsız test',
      'Tam CRM + şablon',
      'Gelişmiş raporlar',
      '20 AI özet/ay (Faz 2)',
    ],
  },
  {
    code: 'enterprise',
    name: 'Kurum',
    nameEn: 'Enterprise',
    priceMonthly: 2999,
    priceYearly: 29990,
    currency: 'TRY',
    features: [
      'Sınırsız danışan',
      'Sınırsız test + özel',
      'Tam CRM + şablon',
      'Çoklu psikolog (5)',
      'Asistan paneli',
      'Sınırsız AI özet (Faz 2)',
    ],
  },
] as const;
