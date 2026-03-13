import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
  userId: string;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext {
  const context = tenantContextStorage.getStore();
  if (!context) {
    throw new Error('TenantContext not found. Ensure request is running within a tenant context.');
  }
  return context;
}

export function runWithTenantContext<T>(
  context: TenantContext,
  callback: () => T,
): T {
  return tenantContextStorage.run(context, callback);
}
