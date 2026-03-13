import { Prisma } from 'prisma-client';
import { tenantContextStorage } from '../modules/common/context/tenant-context';

export const tenantExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const context = tenantContextStorage.getStore();

          if (!context?.tenantId) {
            // No tenant context (public endpoints, migrations, etc.) — run as-is
            return query(args);
          }

          // Wrap in a transaction so SET LOCAL is scoped to this connection slot
          // and auto-resets when the transaction ends (no connection pool pollution)
          return client.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.current_tenant', ${context.tenantId}, true)`;
            // Call the operation directly on the transaction client to avoid
            // re-triggering this extension (tx is a raw transaction client)
            return (tx as any)[model][operation](args);
          });
        },
      },
    },
  });
});
