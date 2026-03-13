import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../legal/audit-log.service';

@Injectable()
export class CrisisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getActiveAlerts(tenantId: string) {
    const items = await this.prisma.formSubmission.findMany({
      where: {
        tenantId,
        riskFlags: { has: 'suicide_risk' },
        crisisAcknowledgedAt: null,
        completionStatus: 'COMPLETE',
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
        formDefinition: {
          select: { id: true, title: true },
        },
      },
    });

    return items.map((s) => ({
      id: s.id,
      clientId: s.clientId,
      clientName: `${s.client.firstName} ${s.client.lastName}`.trim() || 'Danışan',
      formDefinitionId: s.formDefinitionId,
      formTitle: s.formDefinition.title,
      submittedAt: s.submittedAt,
    }));
  }

  async acknowledge(
    submissionId: string,
    tenantId: string,
    userId: string,
    notes?: string,
  ) {
    const submission = await this.prisma.formSubmission.findFirst({
      where: { id: submissionId, tenantId },
      include: {
        client: { select: { firstName: true, lastName: true } },
      },
    });
    if (!submission) {
      throw new NotFoundException('Form yanıtı bulunamadı');
    }
    if (!submission.riskFlags.includes('suicide_risk')) {
      throw new NotFoundException('Bu yanıtta kriz bayrağı yok');
    }
    if (submission.crisisAcknowledgedAt) {
      return { id: submissionId, acknowledged: true };
    }

    await this.prisma.formSubmission.update({
      where: { id: submissionId },
      data: { crisisAcknowledgedAt: new Date() },
    });

    const clientName = `${submission.client.firstName} ${submission.client.lastName}`.trim() || 'Danışan';

    await this.auditLog.logAction({
      tenantId,
      userId,
      action: 'crisis_acknowledged',
      resourceType: 'form_submission',
      resourceId: submissionId,
      details: {
        clientId: submission.clientId,
        clientName,
        formDefinitionId: submission.formDefinitionId,
        notes,
        acknowledgedBy: userId,
      },
    });

    return { id: submissionId, acknowledged: true };
  }
}
