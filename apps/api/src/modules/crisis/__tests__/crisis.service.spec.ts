import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { CrisisService } from '../crisis.service';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogService } from '../../legal/audit-log.service';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makePrisma() {
  return {
    formSubmission: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
}

function makeAuditLog() {
  return { logAction: jest.fn().mockResolvedValue(undefined) };
}

// ─── Constants & fixtures ─────────────────────────────────────────────────────

const TENANT_ID = 'tenant-crisis-1';
const SUBMISSION_ID = 'submission-crisis-1';
const USER_ID = 'user-crisis-1';
const NOW = new Date('2025-10-15T10:00:00.000Z');
const SUBMITTED_AT = new Date('2025-10-14T09:00:00.000Z');

function makeActiveSubmission(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SUBMISSION_ID,
    tenantId: TENANT_ID,
    clientId: 'client-1',
    formDefinitionId: 'formdef-1',
    riskFlags: ['suicide_risk'],
    crisisAcknowledgedAt: null,
    completionStatus: 'COMPLETE',
    submittedAt: SUBMITTED_AT,
    client: { id: 'client-1', firstName: 'Ayşe', lastName: 'Yılmaz' },
    formDefinition: { id: 'formdef-1', title: 'PHQ-9' },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. CrisisService
// ─────────────────────────────────────────────────────────────────────────────

describe('CrisisService – 14.', () => {
  let service: CrisisService;
  let prisma: ReturnType<typeof makePrisma>;
  let auditLog: ReturnType<typeof makeAuditLog>;

  beforeEach(async () => {
    prisma = makePrisma();
    auditLog = makeAuditLog();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrisisService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<CrisisService>(CrisisService);

    jest.useFakeTimers();
    jest.setSystemTime(NOW);

    prisma.formSubmission.findMany.mockResolvedValue([makeActiveSubmission()]);
    prisma.formSubmission.findFirst.mockResolvedValue(makeActiveSubmission());
    prisma.formSubmission.update.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── 14.1 getActiveAlerts() ────────────────────────────────────────────────

  describe('getActiveAlerts()', () => {
    it('queries with suicide_risk flag, crisisAcknowledgedAt:null, completionStatus:COMPLETE', async () => {
      await service.getActiveAlerts(TENANT_ID);
      expect(prisma.formSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: TENANT_ID,
            riskFlags: { has: 'suicide_risk' },
            crisisAcknowledgedAt: null,
            completionStatus: 'COMPLETE',
          },
        }),
      );
    });

    it('orders by submittedAt descending', async () => {
      await service.getActiveAlerts(TENANT_ID);
      expect(prisma.formSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { submittedAt: 'desc' } }),
      );
    });

    it('includes client firstName/lastName and formDefinition title', async () => {
      await service.getActiveAlerts(TENANT_ID);
      expect(prisma.formSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            client: { select: { id: true, firstName: true, lastName: true } },
            formDefinition: { select: { id: true, title: true } },
          },
        }),
      );
    });

    it('maps to { id, clientId, clientName, formDefinitionId, formTitle, submittedAt }', async () => {
      const result = await service.getActiveAlerts(TENANT_ID);
      expect(result[0]).toEqual({
        id: SUBMISSION_ID,
        clientId: 'client-1',
        clientName: 'Ayşe Yılmaz',
        formDefinitionId: 'formdef-1',
        formTitle: 'PHQ-9',
        submittedAt: SUBMITTED_AT,
      });
    });

    it('clientName falls back to "Danışan" when firstName and lastName are empty', async () => {
      prisma.formSubmission.findMany.mockResolvedValue([
        makeActiveSubmission({ client: { id: 'c1', firstName: '', lastName: '' } }),
      ]);
      const result = await service.getActiveAlerts(TENANT_ID);
      expect(result[0].clientName).toBe('Danışan');
    });

    it('returns empty array when no active alerts', async () => {
      prisma.formSubmission.findMany.mockResolvedValue([]);
      expect(await service.getActiveAlerts(TENANT_ID)).toEqual([]);
    });
  });

  // ── 14.2 acknowledge() ────────────────────────────────────────────────────

  describe('acknowledge()', () => {
    // ── Guards ────────────────────────────────────────────────────────────

    it('throws NotFoundException when submission not found', async () => {
      prisma.formSubmission.findFirst.mockResolvedValue(null);
      await expect(
        service.acknowledge(SUBMISSION_ID, TENANT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('queries submission with submissionId and tenantId', async () => {
      await service.acknowledge(SUBMISSION_ID, TENANT_ID, USER_ID);
      expect(prisma.formSubmission.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SUBMISSION_ID, tenantId: TENANT_ID },
        }),
      );
    });

    it('throws NotFoundException when submission has no suicide_risk flag', async () => {
      prisma.formSubmission.findFirst.mockResolvedValue(
        makeActiveSubmission({ riskFlags: ['other_risk'] }),
      );
      await expect(
        service.acknowledge(SUBMISSION_ID, TENANT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when riskFlags is empty', async () => {
      prisma.formSubmission.findFirst.mockResolvedValue(
        makeActiveSubmission({ riskFlags: [] }),
      );
      await expect(
        service.acknowledge(SUBMISSION_ID, TENANT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    // ── Already acknowledged (idempotent) ─────────────────────────────────

    it('returns { id, acknowledged: true } immediately when already acknowledged', async () => {
      prisma.formSubmission.findFirst.mockResolvedValue(
        makeActiveSubmission({ crisisAcknowledgedAt: new Date('2025-10-01') }),
      );
      const result = await service.acknowledge(SUBMISSION_ID, TENANT_ID, USER_ID);
      expect(result).toEqual({ id: SUBMISSION_ID, acknowledged: true });
    });

    it('does not call update or auditLog when already acknowledged', async () => {
      prisma.formSubmission.findFirst.mockResolvedValue(
        makeActiveSubmission({ crisisAcknowledgedAt: new Date('2025-10-01') }),
      );
      await service.acknowledge(SUBMISSION_ID, TENANT_ID, USER_ID);
      expect(prisma.formSubmission.update).not.toHaveBeenCalled();
      expect(auditLog.logAction).not.toHaveBeenCalled();
    });

    // ── Happy path ────────────────────────────────────────────────────────

    it('updates crisisAcknowledgedAt to current time', async () => {
      await service.acknowledge(SUBMISSION_ID, TENANT_ID, USER_ID);
      expect(prisma.formSubmission.update).toHaveBeenCalledWith({
        where: { id: SUBMISSION_ID },
        data: { crisisAcknowledgedAt: NOW },
      });
    });

    it('calls auditLog.logAction with action "crisis_acknowledged"', async () => {
      await service.acknowledge(SUBMISSION_ID, TENANT_ID, USER_ID);
      expect(auditLog.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'crisis_acknowledged' }),
      );
    });

    it('passes correct fields to auditLog.logAction', async () => {
      await service.acknowledge(SUBMISSION_ID, TENANT_ID, USER_ID, 'Danışan arandı');
      expect(auditLog.logAction).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: USER_ID,
        action: 'crisis_acknowledged',
        resourceType: 'form_submission',
        resourceId: SUBMISSION_ID,
        details: {
          clientId: 'client-1',
          clientName: 'Ayşe Yılmaz',
          formDefinitionId: 'formdef-1',
          notes: 'Danışan arandı',
          acknowledgedBy: USER_ID,
        },
      });
    });

    it('clientName in auditLog falls back to "Danışan" when names are empty', async () => {
      prisma.formSubmission.findFirst.mockResolvedValue(
        makeActiveSubmission({ client: { firstName: '', lastName: '' } }),
      );
      await service.acknowledge(SUBMISSION_ID, TENANT_ID, USER_ID);
      const call = auditLog.logAction.mock.calls[0][0] as { details: { clientName: string } };
      expect(call.details.clientName).toBe('Danışan');
    });

    it('notes is undefined when not provided (passed through to auditLog)', async () => {
      await service.acknowledge(SUBMISSION_ID, TENANT_ID, USER_ID);
      const call = auditLog.logAction.mock.calls[0][0] as { details: { notes: unknown } };
      expect(call.details.notes).toBeUndefined();
    });

    it('returns { id: submissionId, acknowledged: true }', async () => {
      const result = await service.acknowledge(SUBMISSION_ID, TENANT_ID, USER_ID);
      expect(result).toEqual({ id: SUBMISSION_ID, acknowledged: true });
    });

    it('calls update before auditLog (update then audit order)', async () => {
      const callOrder: string[] = [];
      prisma.formSubmission.update.mockImplementation(() => {
        callOrder.push('update');
        return Promise.resolve({});
      });
      auditLog.logAction.mockImplementation(() => {
        callOrder.push('audit');
        return Promise.resolve(undefined);
      });

      await service.acknowledge(SUBMISSION_ID, TENANT_ID, USER_ID);
      expect(callOrder).toEqual(['update', 'audit']);
    });
  });
});
