import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';

import { FormSubmissionsService } from '../form-submissions.service';
import { PrismaService } from '../../../../database/prisma.service';

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
