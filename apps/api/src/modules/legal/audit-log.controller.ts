import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService, AuditLogFilters } from './audit-log.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtUser } from '../common/types/request.types';

@Controller('legal/audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Get audit logs. super_admin: any tenant (pass tenantId). psychologist: own tenant only.
   */
  @Roles('super_admin', 'psychologist')
  @Get()
  async getAuditLogs(
    @CurrentUser() user: JwtUser,
    @Query('tenantId') tenantIdQuery?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const isSuperAdmin = user.role?.toUpperCase() === 'SUPER_ADMIN';
    const tenantId = isSuperAdmin ? tenantIdQuery : user.tenantId;

    if (!tenantId) {
      return {
        data: [],
        meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
      };
    }

    const filters: AuditLogFilters = {
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    return this.auditLogService.getAuditLogs(filters);
  }
}
