/**
 * Auth & Multi-Tenant types — MASTER_README Section 6
 */

export type UserRole = 'super_admin' | 'psychologist' | 'assistant';

export type PlanType = 'free' | 'pro' | 'enterprise';

/** JWT payload — Auth0 / custom token */
export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

/** Tenant claim — plan ve limit bilgisi */
export interface TenantClaim {
  tenantId: string;
  plan: PlanType;
  maxClients: number;
}
