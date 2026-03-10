import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'auditLog';

export interface AuditLogMetadata {
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

export type AuditLogOptions =
  | { action: string; resourceType: string; resourceId?: string; details?: Record<string, unknown> }
  | [action: string, resourceType: string, resourceId?: string];

/**
 * Audit log decorator. Use on controller methods:
 * @AuditLog({ action: 'create', resourceType: 'client' })
 * @AuditLog({ action: 'update', resourceType: 'appointment', resourceId: 'id' })
 */
export function AuditLog(
  optionsOrAction: AuditLogOptions | string,
  resourceType?: string,
  resourceId?: string,
): ReturnType<typeof SetMetadata> {
  const metadata: AuditLogMetadata =
    typeof optionsOrAction === 'object' && !Array.isArray(optionsOrAction)
      ? optionsOrAction
      : Array.isArray(optionsOrAction)
        ? {
            action: optionsOrAction[0],
            resourceType: optionsOrAction[1],
            resourceId: optionsOrAction[2],
          }
        : {
            action: optionsOrAction,
            resourceType: resourceType ?? '',
            resourceId,
          };
  return SetMetadata(AUDIT_LOG_KEY, metadata);
}
