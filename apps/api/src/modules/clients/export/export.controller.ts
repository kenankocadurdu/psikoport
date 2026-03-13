import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { AssistantForbidden } from '../../common/decorators/assistant-forbidden.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request.types';

@Controller('clients/:clientId/export')
@Roles('psychologist', 'assistant')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @AssistantForbidden()
  @AuditLog({ action: 'export', resourceType: 'client' })
  @Get()
  async export(
    @Param('clientId') clientId: string,
    @Query('format') format: 'json' | 'csv' | 'gdpr-json' = 'json',
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
  ) {
    if (format === 'gdpr-json') {
      const payload = await this.exportService.exportGdprJson(clientId, user.tenantId);
      const filename = `gdpr-export-${clientId.slice(0, 8)}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.send(JSON.stringify(payload, null, 2));
      return;
    }

    const validFormat = format === 'csv' ? 'csv' : 'json';
    const { data, contentType, filename } =
      await this.exportService.exportClientData(
        clientId,
        user.tenantId,
        validFormat,
      );

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.send(data);
  }
}
