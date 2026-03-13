import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { calculateScore } from '@psikoport/scoring-engine';
import type { ScoringConfig } from '@psikoport/scoring-engine';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { runWithTenantContext } from '../../modules/common/context';
import { IdempotencyGuard } from '../guards/idempotency.guard';

export interface ScoringJobData {
  submissionId: string;
  formDefinitionId: string;
}

@Processor('scoring', {
  concurrency: 5,
  limiter: { max: 10, duration: 1000 },
})
export class ScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('crisis-alert') private readonly crisisQueue: Queue,
    private readonly idempotencyGuard: IdempotencyGuard,
  ) {
    super();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ScoringJobData>, err: Error): void {
    this.logger.error(
      `Scoring job failed (dead-letter): id=${job?.id} submissionId=${job?.data?.submissionId} attempts=${job?.attemptsMade} error=${err?.message}`,
      err?.stack,
    );
  }

  async process(job: Job<ScoringJobData>): Promise<void> {
    const { submissionId, formDefinitionId } = job.data;

    if (!(await this.idempotencyGuard.acquireLock(`idem:scoring:${submissionId}`, 3600))) {
      this.logger.warn(`Duplicate job skipped: scoring:${submissionId}`);
      return;
    }

    // Bootstrap query runs without ALS context (no RLS) to obtain tenantId
    const submissionForTenant = await this.prisma.formSubmission.findUniqueOrThrow({
      where: { id: submissionId },
      select: { tenantId: true },
    });

    await runWithTenantContext(
      { tenantId: submissionForTenant.tenantId, userId: 'system' },
      async () => {
        const [formDef, submission] = await Promise.all([
          this.prisma.formDefinition.findUniqueOrThrow({
            where: { id: formDefinitionId },
            select: { scoringConfig: true },
          }),
          this.prisma.formSubmission.findUniqueOrThrow({
            where: { id: submissionId },
            select: { responses: true, tenantId: true },
          }),
        ]);

        const scoringConfig = formDef.scoringConfig as ScoringConfig | null;
        if (!scoringConfig || typeof scoringConfig !== 'object') {
          this.logger.warn(`No scoring config for form ${formDefinitionId}`);
          return;
        }

        const responses = submission.responses as Record<string, unknown>;
        const result = calculateScore(responses, scoringConfig);

        await this.prisma.formSubmission.update({
          where: { id: submissionId },
          data: {
            scores: result as object,
            severityLevel: result.severityLevel ?? null,
            riskFlags: result.riskFlags,
          },
        });

        this.logger.log(
          `Scored submission ${submissionId}: total=${result.totalScore}, severity=${result.severityLevel ?? 'n/a'}`,
        );

        if (result.riskFlags.includes('suicide_risk')) {
          await this.crisisQueue.add('alert', {
            submissionId,
            formDefinitionId,
            tenantId: submission.tenantId,
            riskFlags: result.riskFlags,
          });
          this.logger.warn(`Crisis protocol triggered for submission ${submissionId}`);
        }
      },
    );
  }
}
