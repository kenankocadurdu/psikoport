import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../../modules/common/services/notification.service';
import { AuditLogService } from '../../modules/legal/audit-log.service';
import { runWithTenantContext } from '../../modules/common/context';
import { IdempotencyGuard } from '../guards/idempotency.guard';

export interface CrisisAlertJobData {
  submissionId: string;
  formDefinitionId: string;
  tenantId: string;
  riskFlags: string[];
}

@Processor('crisis-alert')
export class CrisisAlertProcessor extends WorkerHost {
  private readonly logger = new Logger(CrisisAlertProcessor.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
    private readonly auditLog: AuditLogService,
    private readonly idempotencyGuard: IdempotencyGuard,
    @InjectQueue('crisis-alert') private readonly crisisQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<CrisisAlertJobData>): Promise<void> {
    const { submissionId, tenantId } = job.data;

    if (job.name === 'escalation') {
      const submission = await this.prisma.formSubmission.findUnique({
        where: { id: submissionId },
        select: { crisisAcknowledgedAt: true },
      });
      if (!submission || submission.crisisAcknowledgedAt !== null) {
        this.logger.log(`Escalation skipped (acknowledged): crisis:${submissionId}`);
        return;
      }
    }

    if (!(await this.idempotencyGuard.acquireLock(`idem:crisis:${submissionId}`, 3600))) {
      this.logger.warn(`Duplicate job skipped: crisis:${submissionId}`);
      return;
    }

    await runWithTenantContext({ tenantId, userId: 'system' }, async () => {
      const submission = await this.prisma.formSubmission.findUniqueOrThrow({
        where: { id: submissionId },
        include: {
          psychologist: { select: { email: true, fullName: true, phone: true } },
          client: { select: { firstName: true, lastName: true } },
          formDefinition: { select: { title: true } },
        },
      });

      const { psychologist, client, formDefinition } = submission;
      const clientName = `${client.firstName} ${client.lastName}`.trim() || 'Danışan';
      const formTitle = formDefinition.title;
      const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const link = `${frontendUrl}/tests/submissions/${submissionId}`;

      await this.notification.sendEmailRaw(
        psychologist.email,
        '[ACİL] Psikoport — Risk Uyarısı',
        `
        <p>Sayın ${psychologist.fullName},</p>
        <p><strong>ACİL:</strong> ${clientName} tarafından doldurulan "${formTitle}" formunda risk göstergesi tespit edildi.</p>
        <p>Lütfen en kısa sürede inceleyin: <a href="${link}">${link}</a></p>
        <p>— Psikoport</p>
      `,
        `ACİL: ${clientName} - "${formTitle}" formunda risk. İnceleyin: ${link}`,
        'crisis-alert',
      );

      if (psychologist.phone) {
        const msg = `⚠️ ${clientName} kriz belirtisi tespit edildi. Lütfen acil kontrol edin. Psikoport.`;
        await this.notification.sendSms(psychologist.phone, msg, 'crisis-alert');
      }

      await this.auditLog.logAction({
        tenantId,
        userId: submission.psychologistId,
        action: 'crisis_triggered',
        resourceType: 'form_submission',
        resourceId: submissionId,
        details: {
          clientId: submission.clientId,
          formDefinitionId: submission.formDefinitionId,
          riskFlags: job.data.riskFlags,
        },
      });

      this.logger.warn(`Crisis alert sent for submission ${submissionId}`);

      if (job.name !== 'escalation') {
        await this.crisisQueue.add(
          'escalation',
          { submissionId, tenantId },
          { delay: 30 * 60 * 1000, jobId: `crisis-esc:${submissionId}` },
        );
      }
    });
  }
}
