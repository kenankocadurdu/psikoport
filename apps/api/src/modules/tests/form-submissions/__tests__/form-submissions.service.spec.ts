import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';

import { FormSubmissionsService } from '../form-submissions.service';
import { PrismaService } from '../../../../database/prisma.service';
import type { CreateFormSubmissionDto } from '../dto/create-form-submission.dto';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makePrisma() {
  return {
    formSubmission: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    formDefinition: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };
}

/**
 * Build a minimal schema with one section containing the given fields.
 * crisisTrigger shape: { values: string[] }
 */
function makeSchema(
  fields: Array<{ id?: string; crisisTrigger?: { values: string[] } }> = [],
) {
  return { sections: [{ fields }] };
}

const TENANT_ID = 'tenant-fs-1';
const SUBMISSION_ID = 'submission-1';
const FORM_DEF_ID = 'formdef-1';

function makeDraftSubmission(responses: Record<string, unknown> = {}) {
  return {
    id: SUBMISSION_ID,
    tenantId: TENANT_ID,
    formDefinitionId: FORM_DEF_ID,
    completionStatus: 'DRAFT',
    responses,
    formDefinition: {
      code: 'PHQ9',
      title: 'PHQ-9',
      schema: null,
      scoringConfig: null,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7.1 checkCrisisTrigger()
// Tested indirectly through complete() which calls checkCrisisTrigger internally
// ─────────────────────────────────────────────────────────────────────────────

describe('FormSubmissionsService – 7.1 checkCrisisTrigger()', () => {
  let service: FormSubmissionsService;
  let prisma: ReturnType<typeof makePrisma>;
  let crisisQueue: { add: jest.Mock };
  let scoringQueue: { add: jest.Mock };

  beforeEach(async () => {
    prisma = makePrisma();
    crisisQueue = { add: jest.fn().mockResolvedValue(undefined) };
    scoringQueue = { add: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormSubmissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken('scoring'), useValue: scoringQueue },
        { provide: getQueueToken('crisis-alert'), useValue: crisisQueue },
      ],
    }).compile();

    service = module.get<FormSubmissionsService>(FormSubmissionsService);

    // Default update return (used by complete())
    prisma.formSubmission.update.mockResolvedValue({
      id: SUBMISSION_ID,
      completionStatus: 'COMPLETE',
      submittedAt: new Date(),
    });
  });

  /**
   * Run complete() with the given responses and schema.
   * Drives checkCrisisTrigger(schema, responses) internally.
   */
  async function runComplete(responses: Record<string, unknown>, schema: unknown) {
    prisma.formSubmission.findFirst.mockResolvedValue(makeDraftSubmission(responses));
    prisma.formDefinition.findUniqueOrThrow.mockResolvedValue({
      id: FORM_DEF_ID,
      schema,
      scoringConfig: null, // no scoring → scoringQueue stays silent
    });
    return service.complete(SUBMISSION_ID, TENANT_ID);
  }

  // ── No crisis (returns false) ────────────────────────────────────────────

  describe('no crisis detected → crisisQueue.add not called', () => {
    it('schema is null', async () => {
      await runComplete({ q1: 'yes' }, null);
      expect(crisisQueue.add).not.toHaveBeenCalled();
    });

    it('schema is a string (not an object)', async () => {
      await runComplete({ q1: 'yes' }, 'invalid-schema');
      expect(crisisQueue.add).not.toHaveBeenCalled();
    });

    it('schema has no sections property', async () => {
      await runComplete({ q1: 'yes' }, {});
      expect(crisisQueue.add).not.toHaveBeenCalled();
    });

    it('schema sections array is empty', async () => {
      await runComplete({ q1: 'yes' }, { sections: [] });
      expect(crisisQueue.add).not.toHaveBeenCalled();
    });

    it('field has no crisisTrigger', async () => {
      const schema = makeSchema([{ id: 'q1' }]);
      await runComplete({ q1: 'yes' }, schema);
      expect(crisisQueue.add).not.toHaveBeenCalled();
    });

    it('field crisisTrigger.values is empty array', async () => {
      const schema = makeSchema([{ id: 'q1', crisisTrigger: { values: [] } }]);
      await runComplete({ q1: 'yes' }, schema);
      expect(crisisQueue.add).not.toHaveBeenCalled();
    });

    it('field has no id → skipped even if trigger matches', async () => {
      const schema = makeSchema([{ crisisTrigger: { values: ['yes'] } }]); // no id
      await runComplete({ q1: 'yes' }, schema);
      expect(crisisQueue.add).not.toHaveBeenCalled();
    });

    it('response value does not match any trigger value', async () => {
      const schema = makeSchema([{ id: 'q1', crisisTrigger: { values: ['always'] } }]);
      await runComplete({ q1: 'never' }, schema);
      expect(crisisQueue.add).not.toHaveBeenCalled();
    });

    it('response key is missing (value is undefined)', async () => {
      const schema = makeSchema([{ id: 'q1', crisisTrigger: { values: ['yes'] } }]);
      await runComplete({}, schema); // q1 not present
      expect(crisisQueue.add).not.toHaveBeenCalled();
    });

    it('response value is null', async () => {
      const schema = makeSchema([{ id: 'q1', crisisTrigger: { values: ['yes'] } }]);
      await runComplete({ q1: null }, schema);
      expect(crisisQueue.add).not.toHaveBeenCalled();
    });
  });

  // ── Crisis detected (returns true) ───────────────────────────────────────

  describe('crisis detected → crisisQueue.add called with suicide_risk', () => {
    it('string response exactly matches trigger value', async () => {
      const schema = makeSchema([{ id: 'q1', crisisTrigger: { values: ['always'] } }]);
      await runComplete({ q1: 'always' }, schema);

      expect(crisisQueue.add).toHaveBeenCalledWith(
        'alert',
        expect.objectContaining({
          submissionId: SUBMISSION_ID,
          riskFlags: ['suicide_risk'],
        }),
      );
    });

    it('riskFlags set to ["suicide_risk"] in the submission update', async () => {
      const schema = makeSchema([{ id: 'q1', crisisTrigger: { values: ['always'] } }]);
      await runComplete({ q1: 'always' }, schema);

      expect(prisma.formSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ riskFlags: ['suicide_risk'] }),
        }),
      );
    });

    it('numeric response converted to string matches trigger value', async () => {
      const schema = makeSchema([{ id: 'severity', crisisTrigger: { values: ['3'] } }]);
      await runComplete({ severity: 3 }, schema);
      expect(crisisQueue.add).toHaveBeenCalled();
    });

    it('boolean response converted to string matches trigger value', async () => {
      const schema = makeSchema([{ id: 'risk', crisisTrigger: { values: ['true'] } }]);
      await runComplete({ risk: true }, schema);
      expect(crisisQueue.add).toHaveBeenCalled();
    });

    it('match in second section → still detects crisis', async () => {
      const schema = {
        sections: [
          { fields: [{ id: 'q1' }] }, // no crisis trigger
          { fields: [{ id: 'q2', crisisTrigger: { values: ['yes'] } }] },
        ],
      };
      await runComplete({ q2: 'yes' }, schema);
      expect(crisisQueue.add).toHaveBeenCalled();
    });

    it('match in second field of same section → still detects crisis', async () => {
      const schema = makeSchema([
        { id: 'q1', crisisTrigger: { values: ['always'] } },
        { id: 'q2', crisisTrigger: { values: ['yes'] } },
      ]);
      await runComplete({ q1: 'never', q2: 'yes' }, schema);
      expect(crisisQueue.add).toHaveBeenCalled();
    });

    it('first matching field triggers crisis → crisis queue called exactly once', async () => {
      // Both fields have triggers; both match — should enqueue crisis only once
      const schema = makeSchema([
        { id: 'q1', crisisTrigger: { values: ['yes'] } },
        { id: 'q2', crisisTrigger: { values: ['always'] } },
      ]);
      await runComplete({ q1: 'yes', q2: 'always' }, schema);
      expect(crisisQueue.add).toHaveBeenCalledTimes(1);
    });

    it('trigger value is one of several in the values array', async () => {
      const schema = makeSchema([
        { id: 'q1', crisisTrigger: { values: ['rarely', 'sometimes', 'always'] } },
      ]);
      await runComplete({ q1: 'sometimes' }, schema);
      expect(crisisQueue.add).toHaveBeenCalled();
    });
  });

  // ── Interaction with update (no riskFlags when no crisis) ───────────────

  describe('update data when no crisis', () => {
    it('riskFlags not included in update data when no crisis detected', async () => {
      const schema = makeSchema([{ id: 'q1', crisisTrigger: { values: ['always'] } }]);
      await runComplete({ q1: 'never' }, schema);

      const updateCall = prisma.formSubmission.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data).not.toHaveProperty('riskFlags');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7.2 createAndComplete()
// Private method — tested through create() with completionStatus: 'COMPLETE'
// ─────────────────────────────────────────────────────────────────────────────

describe('FormSubmissionsService – 7.2 createAndComplete()', () => {
  let service: FormSubmissionsService;
  let prisma: ReturnType<typeof makePrisma>;
  let crisisQueue: { add: jest.Mock };
  let scoringQueue: { add: jest.Mock };

  const CLIENT_ID = 'client-1';
  const PSYCHOLOGIST_ID = 'psychologist-1';
  const NOW = new Date('2025-06-01T10:00:00.000Z');

  const BASE_FORM_DEF = {
    id: FORM_DEF_ID,
    code: 'PHQ9',
    version: 3,
    scoringConfig: null as unknown,
    schema: null as unknown,
  };

  const BASE_DTO: CreateFormSubmissionDto = {
    clientId: CLIENT_ID,
    formDefinitionId: FORM_DEF_ID,
    responses: { q1: 'never' },
    completionStatus: 'COMPLETE',
  };

  const CREATED_SUBMISSION = {
    id: SUBMISSION_ID,
    completionStatus: 'COMPLETE',
    submittedAt: NOW,
  };

  beforeEach(async () => {
    prisma = makePrisma();
    crisisQueue = { add: jest.fn().mockResolvedValue(undefined) };
    scoringQueue = { add: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormSubmissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken('scoring'), useValue: scoringQueue },
        { provide: getQueueToken('crisis-alert'), useValue: crisisQueue },
      ],
    }).compile();

    service = module.get<FormSubmissionsService>(FormSubmissionsService);

    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    // Default: client exists, formDef found, submission created
    prisma.client.findFirst.mockResolvedValue({ id: CLIENT_ID, tenantId: TENANT_ID });
    prisma.formDefinition.findFirst.mockResolvedValue(BASE_FORM_DEF);
    prisma.formSubmission.create.mockResolvedValue(CREATED_SUBMISSION);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function runCreate(
    dtoOverrides: Partial<CreateFormSubmissionDto> = {},
    formDefOverrides: Partial<typeof BASE_FORM_DEF> = {},
  ) {
    prisma.formDefinition.findFirst.mockResolvedValue({
      ...BASE_FORM_DEF,
      ...formDefOverrides,
    });
    return service.create(
      { ...BASE_DTO, ...dtoOverrides },
      TENANT_ID,
      PSYCHOLOGIST_ID,
    );
  }

  // ── Submission creation fields ─────────────────────────────────────────────

  it('creates submission with completionStatus COMPLETE', async () => {
    await runCreate();
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ completionStatus: 'COMPLETE' }),
      }),
    );
  });

  it('sets submittedAt to current time', async () => {
    await runCreate();
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ submittedAt: NOW }),
      }),
    );
  });

  it('sets formVersion from formDef.version', async () => {
    await runCreate({}, { version: 7 });
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ formVersion: 7 }),
      }),
    );
  });

  it('sets sessionId to null when not provided in DTO', async () => {
    await runCreate({ sessionId: undefined });
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionId: null }),
      }),
    );
  });

  it('sets sessionId from DTO when provided', async () => {
    await runCreate({ sessionId: 'session-42' });
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionId: 'session-42' }),
      }),
    );
  });

  it('returns the created submission', async () => {
    const result = await runCreate();
    expect(result).toBe(CREATED_SUBMISSION);
  });

  // ── riskFlags ─────────────────────────────────────────────────────────────

  it('sets riskFlags to ["suicide_risk"] when crisis detected', async () => {
    const schema = makeSchema([{ id: 'q1', crisisTrigger: { values: ['always'] } }]);
    await runCreate({ responses: { q1: 'always' } }, { schema });
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ riskFlags: ['suicide_risk'] }),
      }),
    );
  });

  it('sets riskFlags to [] when no crisis detected', async () => {
    const schema = makeSchema([{ id: 'q1', crisisTrigger: { values: ['always'] } }]);
    await runCreate({ responses: { q1: 'never' } }, { schema });
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ riskFlags: [] }),
      }),
    );
  });

  // ── Snapshots ─────────────────────────────────────────────────────────────

  it('sets scoringConfigSnapshot to formDef.scoringConfig when present', async () => {
    const scoringConfig = { algorithm: 'phq', maxScore: 27 };
    await runCreate({}, { scoringConfig });
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ scoringConfigSnapshot: scoringConfig }),
      }),
    );
  });

  it('sets scoringConfigSnapshot to null when scoringConfig is null', async () => {
    await runCreate({}, { scoringConfig: null });
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ scoringConfigSnapshot: null }),
      }),
    );
  });

  it('sets schemaSnapshot to formDef.schema', async () => {
    const schema = makeSchema([{ id: 'q1' }]);
    await runCreate({}, { schema });
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schemaSnapshot: schema }),
      }),
    );
  });

  // ── Scoring queue ─────────────────────────────────────────────────────────

  it('enqueues scoring job when scoringConfig is an object', async () => {
    const scoringConfig = { algorithm: 'phq' };
    await runCreate({}, { scoringConfig });
    expect(scoringQueue.add).toHaveBeenCalledWith(
      'score',
      { submissionId: SUBMISSION_ID, formDefinitionId: FORM_DEF_ID },
      { jobId: `scoring:${SUBMISSION_ID}` },
    );
  });

  it('does not enqueue scoring job when scoringConfig is null', async () => {
    await runCreate({}, { scoringConfig: null });
    expect(scoringQueue.add).not.toHaveBeenCalled();
  });

  it('does not enqueue scoring job when scoringConfig is a string (not an object)', async () => {
    await runCreate({}, { scoringConfig: 'legacy' });
    expect(scoringQueue.add).not.toHaveBeenCalled();
  });

  // ── Crisis queue ──────────────────────────────────────────────────────────

  it('enqueues crisis alert when crisis detected', async () => {
    const schema = makeSchema([{ id: 'q1', crisisTrigger: { values: ['always'] } }]);
    await runCreate({ responses: { q1: 'always' } }, { schema });
    expect(crisisQueue.add).toHaveBeenCalledWith(
      'alert',
      {
        submissionId: SUBMISSION_ID,
        formDefinitionId: FORM_DEF_ID,
        tenantId: TENANT_ID,
        riskFlags: ['suicide_risk'],
      },
    );
  });

  it('does not enqueue crisis alert when no crisis detected', async () => {
    await runCreate({ responses: { q1: 'never' } });
    expect(crisisQueue.add).not.toHaveBeenCalled();
  });

  // ── Both queues ───────────────────────────────────────────────────────────

  it('enqueues both scoring and crisis when scoringConfig set and crisis detected', async () => {
    const schema = makeSchema([{ id: 'q1', crisisTrigger: { values: ['always'] } }]);
    const scoringConfig = { algorithm: 'phq' };
    await runCreate({ responses: { q1: 'always' } }, { schema, scoringConfig });
    expect(scoringQueue.add).toHaveBeenCalledTimes(1);
    expect(crisisQueue.add).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7.4 submitByToken()
// ─────────────────────────────────────────────────────────────────────────────

describe('FormSubmissionsService – 7.4 submitByToken()', () => {
  let service: FormSubmissionsService;
  let prisma: ReturnType<typeof makePrisma>;
  let crisisQueue: { add: jest.Mock };
  let scoringQueue: { add: jest.Mock };

  const CLIENT_ID = 'client-token-1';
  const PSYCHOLOGIST_ID = 'psychologist-token-1';

  const TOKEN_PAYLOAD = {
    clientId: CLIENT_ID,
    formDefinitionId: FORM_DEF_ID,
    tenantId: TENANT_ID,
    psychologistId: PSYCHOLOGIST_ID,
  };

  const BASE_FORM_DEF = {
    id: FORM_DEF_ID,
    code: 'PHQ9',
    version: 2,
    scoringConfig: null as unknown,
    schema: null as unknown,
  };

  const CREATED_SUBMISSION = { id: SUBMISSION_ID, completionStatus: 'DRAFT' };

  beforeEach(async () => {
    prisma = makePrisma();
    crisisQueue = { add: jest.fn().mockResolvedValue(undefined) };
    scoringQueue = { add: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormSubmissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken('scoring'), useValue: scoringQueue },
        { provide: getQueueToken('crisis-alert'), useValue: crisisQueue },
      ],
    }).compile();

    service = module.get<FormSubmissionsService>(FormSubmissionsService);

    // Happy-path defaults — both submitByToken and inner create() call these
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.client.findFirst.mockResolvedValue({ id: CLIENT_ID, tenantId: TENANT_ID });
    prisma.formDefinition.findFirst.mockResolvedValue(BASE_FORM_DEF);
    prisma.formSubmission.create.mockResolvedValue(CREATED_SUBMISSION);
  });

  // ── Tenant context ────────────────────────────────────────────────────────

  it('sets tenant context via $executeRaw before other operations', async () => {
    await service.submitByToken(TOKEN_PAYLOAD, {
      responses: { q1: 'a' },
      completionStatus: 'DRAFT',
    });
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  // ── Client validation ─────────────────────────────────────────────────────

  it('queries client with clientId and tenantId from tokenPayload', async () => {
    await service.submitByToken(TOKEN_PAYLOAD, {
      responses: { q1: 'a' },
      completionStatus: 'DRAFT',
    });
    expect(prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CLIENT_ID, tenantId: TENANT_ID },
      }),
    );
  });

  it('throws ForbiddenException when client not found in tenant', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(
      service.submitByToken(TOKEN_PAYLOAD, { responses: {}, completionStatus: 'DRAFT' }),
    ).rejects.toThrow('Danışan bulunamadı veya erişim yetkiniz yok');
  });

  // ── Form definition lookup ────────────────────────────────────────────────

  it('queries formDef with isActive:true and tenantId OR null', async () => {
    await service.submitByToken(TOKEN_PAYLOAD, {
      responses: { q1: 'a' },
      completionStatus: 'DRAFT',
    });
    expect(prisma.formDefinition.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: FORM_DEF_ID,
          isActive: true,
          OR: [{ tenantId: null }, { tenantId: TENANT_ID }],
        }),
      }),
    );
  });

  it('throws NotFoundException when formDef not found', async () => {
    // First call (submitByToken level) returns null → NotFoundException thrown
    prisma.formDefinition.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.submitByToken(TOKEN_PAYLOAD, { responses: {}, completionStatus: 'DRAFT' }),
    ).rejects.toThrow('Form tanımı bulunamadı');
  });

  // ── createDto construction ────────────────────────────────────────────────

  it('passes clientId and formDefinitionId from tokenPayload to create()', async () => {
    await service.submitByToken(TOKEN_PAYLOAD, {
      responses: { q1: 'answer' },
      completionStatus: 'DRAFT',
    });
    // create() will call formSubmission.create — verify clientId in the data
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: CLIENT_ID,
          formDefinitionId: FORM_DEF_ID,
        }),
      }),
    );
  });

  it('passes responses from dto to create()', async () => {
    const responses = { mood: '2', sleep: '3' };
    await service.submitByToken(TOKEN_PAYLOAD, { responses, completionStatus: 'DRAFT' });
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ responses }),
      }),
    );
  });

  it('passes psychologistId from tokenPayload to create()', async () => {
    await service.submitByToken(TOKEN_PAYLOAD, {
      responses: { q1: 'a' },
      completionStatus: 'DRAFT',
    });
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ psychologistId: PSYCHOLOGIST_ID }),
      }),
    );
  });

  // ── completionStatus delegation ───────────────────────────────────────────

  it('creates DRAFT submission when dto.completionStatus is DRAFT', async () => {
    await service.submitByToken(TOKEN_PAYLOAD, {
      responses: { q1: 'a' },
      completionStatus: 'DRAFT',
    });
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ completionStatus: 'DRAFT' }),
      }),
    );
  });

  it('creates COMPLETE submission when dto.completionStatus is COMPLETE', async () => {
    await service.submitByToken(TOKEN_PAYLOAD, {
      responses: { q1: 'a' },
      completionStatus: 'COMPLETE',
    });
    expect(prisma.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ completionStatus: 'COMPLETE' }),
      }),
    );
  });

  // ── Return value ──────────────────────────────────────────────────────────

  it('returns the submission from create()', async () => {
    const result = await service.submitByToken(TOKEN_PAYLOAD, {
      responses: { q1: 'a' },
      completionStatus: 'DRAFT',
    });
    expect(result).toBe(CREATED_SUBMISSION);
  });
});
