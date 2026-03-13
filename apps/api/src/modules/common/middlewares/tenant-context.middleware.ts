import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContextStorage, TenantContext } from '../context';

/**
 * Wraps every HTTP request in an AsyncLocalStorage run() call so that
 * the ALS tenant context is propagated through the entire NestJS lifecycle
 * (guards → interceptors → controller → service → Prisma extension).
 *
 * The store starts as an empty mutable object; the JwtAuthGuard fills in
 * tenantId and userId after token validation (see auth.guard.ts).
 * The Prisma tenant extension reads from this store to issue SET LOCAL.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    // Cast to TenantContext: the object is intentionally empty at this point.
    // The guard writes tenantId/userId into the same store reference via
    // Object.assign so that downstream code sees the populated values.
    tenantContextStorage.run({} as TenantContext, next);
  }
}
