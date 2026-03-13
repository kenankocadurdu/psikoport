import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CompletionStatus } from 'prisma-client';
import { PrismaService } from '../../../database/prisma.service';
import type { CreateFormSubmissionDto } from './dto/create-form-submission.dto';
import type { UpdateFormSubmissionDraftDto } from './dto/update-form-submission-draft.dto';
import type { FormSubmissionQueryDto } from './dto/form-submission-query.dto';
import type { SubmitByTokenDto } from './dto/submit-by-token.dto';
import type { PaginatedResponse } from '../../legal/audit-log.service';
import type { ScoringJobData } from '../../../queue/processors/scoring.processor';
import type { CrisisAlertJobData } from '../../../queue/processors/crisis-alert.processor';

function checkCrisisTrigger(
  schema: unknown,
  responses: Record<string, unknown>,
): boolean {
  if (!schema || typeof schema !== 'object') return false;
  const s = schema as { sections?: Array<{ fields?: Array<{ id?: string; crisisTrigger?: { values: Array<string> } }> }> };
  const sections = s.sections ?? [];
  for (const sec of sections) {
    const fields = sec.fields ?? [];
    for (const f of fields) {
      const ct = f.crisisTrigger;
      if (!ct?.values?.length || !f.id) continue;
      const val = responses[f.id];
      const strVal = typeof val === 'string' ? val : val != null ? String(val) : null;
      if (strVal && ct.values.includes(strVal)) return true;
    }
  }
  return false;
}

@Injectable()
export class FormSubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('scoring') private readonly scoringQueue: Queue,
    @InjectQueue('crisis-alert') private readonly crisisQueue: Queue,
  ) {}

  async create(
    dto: CreateFormSubmissionDto,
    tenantId: string,
    psychologistId: string,
  ) {
    await this.assertClientBelongsToTenant(dto.clientId, tenantId);
    const formDef = await this.prisma.formDefinition.findFirst({
      where: {
        id: dto.formDefinitionId,
        isActive: true,
        OR: [{ tenantId: null }, { tenantId }],
      },
      select: { id: true, code: true, version: true, scoringConfig: true, schema: true },
    });
    if (!formDef) {
      throw new NotFoundException('Form tanımı bulunamadı');
    }

    if (dto.completionStatus === 'COMPLETE') {
      return this.createAndComplete(
        dto,
        tenantId,
        psychologistId,
        formDef,
      );
    }
    return this.prisma.formSubmission.create({
      data: {
        tenantId,
        clientId: dto.clientId,
        formDefinitionId: dto.formDefinitionId,
        psychologistId,
        sessionId: dto.sessionId ?? null,
        responses: dto.responses as object,
        completionStatus: 'DRAFT',
        formVersion: formDef.version,
      },
    });
  }

  private async createAndComplete(
    dto: CreateFormSubmissionDto,
    tenantId: string,
    psychologistId: string,
    formDef: {
      id: string;
      code: string;
      version: number;
      scoringConfig: unknown;
      schema: unknown;
    },
  ) {
    const responses = (dto.responses ?? {}) as Record<string, unknown>;
    const crisisFromForm = checkCrisisTrigger(formDef.schema, responses);
    const riskFlags = crisisFromForm ? ['suicide_risk'] : [];

    const submission = await this.prisma.formSubmission.create({
      data: {
        tenantId,
        clientId: dto.clientId,
        formDefinitionId: dto.formDefinitionId,
        psychologistId,
        sessionId: dto.sessionId ?? null,
        responses: dto.responses as object,
        completionStatus: 'COMPLETE',
        submittedAt: new Date(),
        formVersion: formDef.version,
        riskFlags,
        scoringConfigSnapshot: formDef.scoringConfig ?? null,
        schemaSnapshot: formDef.schema,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    if (formDef.scoringConfig && typeof formDef.scoringConfig === 'object') {
      await this.enqueueScoring(submission.id, formDef.id);
    }

    if (crisisFromForm) {
      await this.enqueueCrisisAlert(submission.id, formDef.id, tenantId, riskFlags);
    }

    return submission;
  }

  async saveDraft(
    id: string,
    dto: UpdateFormSubmissionDraftDto,
    tenantId: string,
  ) {
    const existing = await this.findById(id, tenantId);
    if (existing.completionStatus !== 'DRAFT') {
      throw new BadRequestException('Sadece draft formlar güncellenebilir');
    }
    return this.prisma.formSubmission.update({
      where: { id },
      data: { responses: dto.responses as object },
    });
  }

  async complete(id: string, tenantId: string) {
    const existing = await this.findById(id, tenantId);
    if (existing.completionStatus !== 'DRAFT') {
      throw new BadRequestException('Form zaten tamamlanmış veya süresi dolmuş');
    }
    const formDef = await this.prisma.formDefinition.findUniqueOrThrow({
      where: { id: existing.formDefinitionId },
      select: { id: true, scoringConfig: true, schema: true },
    });
    const responses = (existing.responses ?? {}) as Record<string, unknown>;
    const crisisFromForm = checkCrisisTrigger(formDef.schema, responses);
    const riskFlags = crisisFromForm ? ['suicide_risk'] : [];

    const submission = await this.prisma.formSubmission.update({
      where: { id },
      data: {
        completionStatus: 'COMPLETE',
        submittedAt: new Date(),
        ...(crisisFromForm && { riskFlags }),
        scoringConfigSnapshot: formDef.scoringConfig ?? null,
        schemaSnapshot: formDef.schema,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    if (
      formDef.scoringConfig &&
      typeof formDef.scoringConfig === 'object'
    ) {
      await this.enqueueScoring(submission.id, formDef.id);
    }

    if (crisisFromForm) {
      await this.enqueueCrisisAlert(
        submission.id,
        formDef.id,
        tenantId,
        riskFlags,
      );
    }

    return submission;
  }

  async findByClient(
    clientId: string,
    query: FormSubmissionQueryDto,
    tenantId: string,
  ): Promise<
    PaginatedResponse<{
      id: string;
      formDefinitionId: string;
      formDefinition: { code: string; title: string };
      completionStatus: string;
      submittedAt: Date | null;
      createdAt: Date;
      scores: unknown;
      severityLevel: string | null;
      riskFlags: string[];
    }>
  > {
    await this.assertClientBelongsToTenant(clientId, tenantId);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: {
      clientId: string;
      tenantId: string;
      completionStatus?: CompletionStatus;
      formDefinitionId?: string;
    } = {
      clientId,
      tenantId,
    };
    if (query.completionStatus) {
      where.completionStatus = query.completionStatus as CompletionStatus;
    }
    if (query.formDefinitionId) {
      where.formDefinitionId = query.formDefinitionId;
    }

    const [data, total] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          formDefinition: { select: { code: true, title: true } },
        },
      }),
      this.prisma.formSubmission.count({ where }),
    ]);

    return {
      data: data.map((d) => ({
        id: d.id,
        formDefinitionId: d.formDefinitionId,
        formDefinition: d.formDefinition,
        completionStatus: d.completionStatus,
        submittedAt: d.submittedAt,
        createdAt: d.createdAt,
        scores: d.scores,
        severityLevel: d.severityLevel,
        riskFlags: (d.riskFlags as string[] | null) ?? [],
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    return this.findById(id, tenantId);
  }

  private async findById(id: string, tenantId: string) {
    const submission = await this.prisma.formSubmission.findFirst({
      where: { id, tenantId },
      include: {
        formDefinition: { select: { code: true, title: true, schema: true, scoringConfig: true } },
      },
    });
    if (!submission) {
      throw new NotFoundException('Form yanıtı bulunamadı');
    }
    return submission;
  }

  // --- Token-based (client, no Auth0) ---

  async getFormSchemaByToken(tokenPayload: {
    clientId: string;
    formDefinitionId: string;
    tenantId: string;
  }) {
    await this.setTenantContext(tokenPayload.tenantId);
    await this.assertClientBelongsToTenant(
      tokenPayload.clientId,
      tokenPayload.tenantId,
    );
    const formDef = await this.prisma.formDefinition.findFirst({
      where: {
        id: tokenPayload.formDefinitionId,
        isActive: true,
        OR: [
          { tenantId: null },
          { tenantId: tokenPayload.tenantId },
        ],
      },
    });
    if (!formDef) {
      throw new NotFoundException('Form tanımı bulunamadı');
    }
    return {
      id: formDef.id,
      code: formDef.code,
      title: formDef.title,
      schema: formDef.schema,
    };
  }

  async submitByToken(
    tokenPayload: {
      clientId: string;
      formDefinitionId: string;
      tenantId: string;
      psychologistId: string;
    },
    dto: SubmitByTokenDto,
  ) {
    await this.setTenantContext(tokenPayload.tenantId);
    await this.assertClientBelongsToTenant(
      tokenPayload.clientId,
      tokenPayload.tenantId,
    );
    const formDef = await this.prisma.formDefinition.findFirst({
      where: {
        id: tokenPayload.formDefinitionId,
        isActive: true,
        OR: [
          { tenantId: null },
          { tenantId: tokenPayload.tenantId },
        ],
      },
    });
    if (!formDef) {
      throw new NotFoundException('Form tanımı bulunamadı');
    }
    const createDto: CreateFormSubmissionDto = {
      clientId: tokenPayload.clientId,
      formDefinitionId: tokenPayload.formDefinitionId,
      responses: dto.responses,
      completionStatus: dto.completionStatus,
    };
    return this.create(
      createDto,
      tokenPayload.tenantId,
      tokenPayload.psychologistId,
    );
  }

  private async setTenantContext(tenantId: string) {
    await this.prisma.$executeRaw`SELECT set_current_tenant(${tenantId})`;
  }

  private async assertClientBelongsToTenant(clientId: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) {
      throw new ForbiddenException('Danışan bulunamadı veya erişim yetkiniz yok');
    }
  }

  private async enqueueScoring(submissionId: string, formDefinitionId: string) {
    const jobData: ScoringJobData = { submissionId, formDefinitionId };
    await this.scoringQueue.add('score', jobData, { jobId: `scoring:${submissionId}` });
  }

  private async enqueueCrisisAlert(
    submissionId: string,
    formDefinitionId: string,
    tenantId: string,
    riskFlags: string[],
  ) {
    const jobData: CrisisAlertJobData = {
      submissionId,
      formDefinitionId,
      tenantId,
      riskFlags,
    };
    await this.crisisQueue.add('alert', jobData);
  }
}
