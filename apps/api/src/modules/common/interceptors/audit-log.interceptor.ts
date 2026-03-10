import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../../legal/audit-log.service';
import {
  AUDIT_LOG_KEY,
  AuditLogMetadata,
} from '../decorators/audit-log.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<AuditLogMetadata | undefined>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      user?: { tenantId?: string; userId?: string };
      ip?: string;
      connection?: { remoteAddress?: string };
      headers?: { 'user-agent'?: string };
    }>();
    const user = request.user;
    const ipAddress = request.ip ?? request.connection?.remoteAddress;
    const userAgent = request.headers?.['user-agent'] ?? null;

    return next.handle().pipe(
      tap({
        next: () => {
          if (user?.tenantId && user?.userId) {
            void this.auditLogService
              .logAction({
                tenantId: user.tenantId,
                userId: user.userId,
                action: metadata.action,
                resourceType: metadata.resourceType,
                resourceId: metadata.resourceId ?? undefined,
                details: metadata.details,
                ipAddress: ipAddress ?? undefined,
                userAgent: userAgent ?? undefined,
              })
              .catch(() => {
                /* fire-and-forget, non-blocking */
              });
          }
        },
      }),
    );
  }
}
