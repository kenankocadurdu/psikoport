import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClientsService } from '../clients.service';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogService } from '../../legal/audit-log.service';
import { DekCacheService } from '../../common/services/dek-cache.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------
function makePrisma() {
  return {
    tenant: {
      findUnique: jest.fn(),
    },
    client: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
}

function makeAuditLog() {
  return { logAction: jest.fn().mockResolvedValue(undefined) };
}

function makeDekCache() {
  return { invalidate: jest.fn() };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TENANT_ID = 'tenant-1';
const CLIENT_ID = 'client-1';
const USER_ID = 'user-1';

function makeTenant(overrides: { maxClients?: number } = {}) {
  return {
    id: TENANT_ID,
    maxClients: overrides.maxClients ?? 25,
  };
}

const baseCreateDto = {
  firstName: 'Ayşe',
  lastName: 'Yılmaz',
  phone: null,
  email: null,
};

// ---------------------------------------------------------------------------
// 5.1 create() — Quota Enforcement
// ---------------------------------------------------------------------------
describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: ReturnType<typeof makePrisma>;
  let auditLog: ReturnType<typeof makeAuditLog>;
  let dekCache: ReturnType<typeof makeDekCache>;

  beforeEach(async () => {
    prisma = makePrisma();
    auditLog = makeAuditLog();
    dekCache = makeDekCache();

    const module = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: DekCacheService, useValue: dekCache },
      ],
    }).compile();

    service = module.get(ClientsService);
  });

  describe('5.1 create() — Quota Enforcement', () => {
    describe('happy path', () => {
      it('creates client when active count is below quota', async () => {
        prisma.tenant.findUnique.mockResolvedValue(makeTenant({ maxClients: 25 }));
        prisma.client.count.mockResolvedValue(10);
        prisma.client.create.mockResolvedValue({
          id: CLIENT_ID,
          firstName: 'Ayşe',
          lastName: 'Yılmaz',
        });

        const result = await service.create(baseCreateDto as never, TENANT_ID);

        expect(result).toEqual({ id: CLIENT_ID, firstName: 'Ayşe', lastName: 'Yılmaz' });
        expect(prisma.client.create).toHaveBeenCalledTimes(1);
      });

      it('creates client when active count is one below quota', async () => {
        prisma.tenant.findUnique.mockResolvedValue(makeTenant({ maxClients: 25 }));
        prisma.client.count.mockResolvedValue(24);
        prisma.client.create.mockResolvedValue({
          id: CLIENT_ID,
          firstName: 'Ayşe',
          lastName: 'Yılmaz',
        });

        await expect(service.create(baseCreateDto as never, TENANT_ID)).resolves.toBeDefined();
      });
    });

    describe('quota exceeded', () => {
      it('throws ForbiddenException when active count equals maxClients', async () => {
        prisma.tenant.findUnique.mockResolvedValue(makeTenant({ maxClients: 25 }));
        prisma.client.count.mockResolvedValue(25);

        await expect(service.create(baseCreateDto as never, TENANT_ID)).rejects.toThrow(
          ForbiddenException,
        );
        expect(prisma.client.create).not.toHaveBeenCalled();
      });

      it('throws ForbiddenException when active count exceeds maxClients', async () => {
        prisma.tenant.findUnique.mockResolvedValue(makeTenant({ maxClients: 25 }));
        prisma.client.count.mockResolvedValue(26);

        await expect(service.create(baseCreateDto as never, TENANT_ID)).rejects.toThrow(
          ForbiddenException,
        );
        expect(prisma.client.create).not.toHaveBeenCalled();
      });

      it('ForbiddenException carries PLAN_LIMIT_EXCEEDED code', async () => {
        prisma.tenant.findUnique.mockResolvedValue(makeTenant({ maxClients: 25 }));
        prisma.client.count.mockResolvedValue(25);

        let caught: unknown;
        try {
          await service.create(baseCreateDto as never, TENANT_ID);
        } catch (err) {
          caught = err;
        }

        expect((caught as ForbiddenException).getResponse()).toMatchObject({
          code: 'PLAN_LIMIT_EXCEEDED',
        });
      });
    });

    describe('tenant validation', () => {
      it('throws NotFoundException when tenant does not exist', async () => {
        prisma.tenant.findUnique.mockResolvedValue(null);

        await expect(service.create(baseCreateDto as never, TENANT_ID)).rejects.toThrow(
          NotFoundException,
        );
        expect(prisma.client.count).not.toHaveBeenCalled();
        expect(prisma.client.create).not.toHaveBeenCalled();
      });

      it('counts only ACTIVE non-deleted clients for the given tenant', async () => {
        prisma.tenant.findUnique.mockResolvedValue(makeTenant());
        prisma.client.count.mockResolvedValue(0);
        prisma.client.create.mockResolvedValue({
          id: CLIENT_ID,
          firstName: 'Ayşe',
          lastName: 'Yılmaz',
        });

        await service.create(baseCreateDto as never, TENANT_ID);

        expect(prisma.client.count).toHaveBeenCalledWith({
          where: { tenantId: TENANT_ID, status: 'ACTIVE', deletedAt: null },
        });
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5.2 importBulk()
  // -------------------------------------------------------------------------
  describe('5.2 importBulk()', () => {
    // Valid/invalid row helpers — class-validator runs for real
    const validRow = (overrides: Record<string, unknown> = {}) => ({
      firstName: 'Ahmet',
      lastName: 'Demir',
      ...overrides,
    });

    beforeEach(() => {
      // Default: tenant with plenty of quota, 0 existing active clients
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ maxClients: 100 }));
      prisma.client.count.mockResolvedValue(0);
      prisma.client.create.mockResolvedValue({ id: CLIENT_ID } as never);
    });

    describe('all valid rows', () => {
      it('imports all valid rows and returns correct counts', async () => {
        const rows = [validRow(), validRow(), validRow(), validRow(), validRow()];

        const result = await service.importBulk(rows, TENANT_ID);

        expect(result).toEqual({ imported: 5, failed: 0, errors: [] });
        expect(prisma.client.create).toHaveBeenCalledTimes(5);
      });

      it('returns imported=1, failed=0 for a single valid row', async () => {
        const result = await service.importBulk([validRow()], TENANT_ID);

        expect(result.imported).toBe(1);
        expect(result.failed).toBe(0);
      });

      it('returns imported=0, failed=0 for an empty rows array', async () => {
        const result = await service.importBulk([], TENANT_ID);

        expect(result).toEqual({ imported: 0, failed: 0, errors: [] });
        expect(prisma.client.create).not.toHaveBeenCalled();
      });
    });

    describe('invalid rows', () => {
      it('skips invalid rows and reports them in errors', async () => {
        const rows = [
          validRow(),                            // valid
          { lastName: 'Yılmaz' },               // invalid: firstName missing
          validRow(),                            // valid
          { firstName: 'Test', lastName: 'User', email: 'not-an-email' }, // invalid email
          validRow(),                            // valid
        ];

        const result = await service.importBulk(rows, TENANT_ID);

        expect(result.imported).toBe(3);
        expect(result.failed).toBe(2);
        expect(result.errors).toHaveLength(2);
      });

      it('sets correct row numbers in error entries', async () => {
        const rows = [
          validRow(),                // row 1 — ok
          { lastName: 'Yılmaz' },   // row 2 — invalid
        ];

        const result = await service.importBulk(rows, TENANT_ID);

        expect(result.errors[0].row).toBe(2);
      });

      it('includes a descriptive message for invalid rows', async () => {
        const rows = [{ firstName: 'Test', lastName: 'User', email: 'bad-email' }];

        const result = await service.importBulk(rows, TENANT_ID);

        expect(result.errors[0].message).toBeTruthy();
        expect(typeof result.errors[0].message).toBe('string');
      });

      it('skips but still processes subsequent valid rows after an invalid one', async () => {
        const rows = [
          { lastName: 'Yılmaz' }, // invalid
          validRow(),              // valid — should still be imported
        ];

        const result = await service.importBulk(rows, TENANT_ID);

        expect(result.imported).toBe(1);
        expect(result.failed).toBe(1);
      });
    });

    describe('quota enforcement mid-batch', () => {
      it('stops importing when quota is reached and adds remaining rows to errors', async () => {
        // activeCount=2, maxClients=3 → only 1 slot left
        prisma.tenant.findUnique.mockResolvedValue(makeTenant({ maxClients: 3 }));
        prisma.client.count.mockResolvedValue(2);

        const rows = [validRow(), validRow(), validRow()];

        const result = await service.importBulk(rows, TENANT_ID);

        // Row 1 imported (2+0=2 < 3), rows 2-3 hit quota (2+1=3 >= 3)
        expect(result.imported).toBe(1);
        expect(result.failed).toBe(2);
        expect(result.errors.map((e) => e.row)).toEqual([2, 3]);
      });

      it('adds "Plan limiti aşıldı" message for quota-exceeded rows', async () => {
        prisma.tenant.findUnique.mockResolvedValue(makeTenant({ maxClients: 1 }));
        prisma.client.count.mockResolvedValue(1); // already at limit

        const rows = [validRow()];

        const result = await service.importBulk(rows, TENANT_ID);

        expect(result.errors[0].message).toMatch(/limit/i);
      });

      it('counts previously imported rows in quota check (not just activeCount)', async () => {
        // activeCount=0, maxClients=2 → 2 slots, 4 rows
        prisma.tenant.findUnique.mockResolvedValue(makeTenant({ maxClients: 2 }));
        prisma.client.count.mockResolvedValue(0);

        const rows = [validRow(), validRow(), validRow(), validRow()];

        const result = await service.importBulk(rows, TENANT_ID);

        expect(result.imported).toBe(2);
        expect(result.failed).toBe(2);
      });
    });

    describe('DB errors during create', () => {
      it('adds DB error message to errors and continues processing remaining rows', async () => {
        prisma.client.create
          .mockRejectedValueOnce(new Error('Unique constraint failed'))
          .mockResolvedValue({ id: CLIENT_ID } as never);

        const rows = [validRow(), validRow()];

        const result = await service.importBulk(rows, TENANT_ID);

        expect(result.imported).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.errors[0].message).toContain('Unique constraint failed');
      });
    });

    describe('tenant validation', () => {
      it('throws NotFoundException when tenant does not exist', async () => {
        prisma.tenant.findUnique.mockResolvedValue(null);

        await expect(service.importBulk([validRow()], TENANT_ID)).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5.3 softDelete()
  // -------------------------------------------------------------------------
  describe('5.3 softDelete()', () => {
    function makeExistingClient(overrides: Record<string, unknown> = {}) {
      return {
        id: CLIENT_ID,
        tenantId: TENANT_ID,
        status: 'ACTIVE',
        deletedAt: null,
        ...overrides,
      };
    }

    describe('happy path', () => {
      it('updates deletedAt and status=INACTIVE for an existing client', async () => {
        prisma.client.findFirst.mockResolvedValue(makeExistingClient());
        prisma.client.update.mockResolvedValue({} as never);

        await service.softDelete(CLIENT_ID, TENANT_ID);

        expect(prisma.client.update).toHaveBeenCalledWith({
          where: { id: CLIENT_ID },
          data: expect.objectContaining({
            status: 'INACTIVE',
          }),
        });
        const updateData = prisma.client.update.mock.calls[0][0].data as Record<string, unknown>;
        expect(updateData.deletedAt).toBeInstanceOf(Date);
      });

      it('returns { success: true } on success', async () => {
        prisma.client.findFirst.mockResolvedValue(makeExistingClient());
        prisma.client.update.mockResolvedValue({} as never);

        const result = await service.softDelete(CLIENT_ID, TENANT_ID);

        expect(result).toEqual({ success: true });
      });

      it('sets deletedAt to approximately now', async () => {
        jest.useFakeTimers();
        const NOW = new Date('2025-08-01T10:00:00Z');
        jest.setSystemTime(NOW);

        prisma.client.findFirst.mockResolvedValue(makeExistingClient());
        prisma.client.update.mockResolvedValue({} as never);

        await service.softDelete(CLIENT_ID, TENANT_ID);

        const updateData = prisma.client.update.mock.calls[0][0].data as Record<string, unknown>;
        expect(updateData.deletedAt).toEqual(NOW);

        jest.useRealTimers();
      });
    });

    describe('not found', () => {
      it('throws NotFoundException when client does not exist', async () => {
        prisma.client.findFirst.mockResolvedValue(null);

        await expect(service.softDelete(CLIENT_ID, TENANT_ID)).rejects.toThrow(
          NotFoundException,
        );
        expect(prisma.client.update).not.toHaveBeenCalled();
      });

      it('throws NotFoundException when client belongs to a different tenant', async () => {
        // findFirst with { id, tenantId } returns null for wrong tenant
        prisma.client.findFirst.mockResolvedValue(null);

        await expect(service.softDelete(CLIENT_ID, 'other-tenant')).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('query correctness', () => {
      it('looks up client by id and tenantId (no deletedAt filter)', async () => {
        // softDelete intentionally does NOT filter deletedAt — re-deleting is idempotent
        prisma.client.findFirst.mockResolvedValue(makeExistingClient());
        prisma.client.update.mockResolvedValue({} as never);

        await service.softDelete(CLIENT_ID, TENANT_ID);

        expect(prisma.client.findFirst).toHaveBeenCalledWith({
          where: { id: CLIENT_ID, tenantId: TENANT_ID },
        });
      });

      it('updates by id only (no tenantId in update where clause)', async () => {
        prisma.client.findFirst.mockResolvedValue(makeExistingClient());
        prisma.client.update.mockResolvedValue({} as never);

        await service.softDelete(CLIENT_ID, TENANT_ID);

        expect(prisma.client.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: CLIENT_ID } }),
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5.4 cryptoShred()
  // -------------------------------------------------------------------------
  describe('5.4 cryptoShred()', () => {
    const existingClient = {
      id: CLIENT_ID,
      tenantId: TENANT_ID,
    };

    describe('DEK nullification', () => {
      it('sets encryptedClientDek and clientDekNonce to null', async () => {
        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);

        await service.cryptoShred(CLIENT_ID, TENANT_ID, USER_ID);

        expect(prisma.client.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              encryptedClientDek: null,
              clientDekNonce: null,
            }),
          }),
        );
      });

      it('sets anonymizedAt to now', async () => {
        jest.useFakeTimers();
        const NOW = new Date('2025-09-01T08:00:00Z');
        jest.setSystemTime(NOW);

        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);

        await service.cryptoShred(CLIENT_ID, TENANT_ID, USER_ID);

        const data = prisma.client.update.mock.calls[0][0].data as Record<string, unknown>;
        expect(data.anonymizedAt).toEqual(NOW);

        jest.useRealTimers();
      });

      it('updates by clientId in where clause', async () => {
        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);

        await service.cryptoShred(CLIENT_ID, TENANT_ID, USER_ID);

        expect(prisma.client.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: CLIENT_ID } }),
        );
      });
    });

    describe('DEK cache invalidation', () => {
      it('calls dekCache.invalidate with key "client:<clientId>"', async () => {
        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);

        await service.cryptoShred(CLIENT_ID, TENANT_ID, USER_ID);

        expect(dekCache.invalidate).toHaveBeenCalledWith(`client:${CLIENT_ID}`);
        expect(dekCache.invalidate).toHaveBeenCalledTimes(1);
      });

      it('invalidates cache after the DB update', async () => {
        const callOrder: string[] = [];
        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockImplementation(async () => {
          callOrder.push('update');
          return {} as never;
        });
        dekCache.invalidate.mockImplementation(() => {
          callOrder.push('invalidate');
        });

        await service.cryptoShred(CLIENT_ID, TENANT_ID, USER_ID);

        expect(callOrder).toEqual(['update', 'invalidate']);
      });
    });

    describe('audit log', () => {
      it('creates an audit log entry with correct fields', async () => {
        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);

        await service.cryptoShred(CLIENT_ID, TENANT_ID, USER_ID);

        expect(auditLog.logAction).toHaveBeenCalledWith({
          tenantId: TENANT_ID,
          userId: USER_ID,
          action: 'crypto_shred',
          resourceType: 'client',
          resourceId: CLIENT_ID,
        });
      });

      it('logs audit entry after cache invalidation', async () => {
        const callOrder: string[] = [];
        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);
        dekCache.invalidate.mockImplementation(() => {
          callOrder.push('invalidate');
        });
        auditLog.logAction.mockImplementation(async () => {
          callOrder.push('audit');
        });

        await service.cryptoShred(CLIENT_ID, TENANT_ID, USER_ID);

        expect(callOrder).toEqual(['invalidate', 'audit']);
      });
    });

    describe('not found', () => {
      it('throws NotFoundException when client does not exist', async () => {
        prisma.client.findFirst.mockResolvedValue(null);

        await expect(service.cryptoShred(CLIENT_ID, TENANT_ID, USER_ID)).rejects.toThrow(
          NotFoundException,
        );
        expect(prisma.client.update).not.toHaveBeenCalled();
        expect(dekCache.invalidate).not.toHaveBeenCalled();
        expect(auditLog.logAction).not.toHaveBeenCalled();
      });

      it('looks up client by id and tenantId', async () => {
        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);

        await service.cryptoShred(CLIENT_ID, TENANT_ID, USER_ID);

        expect(prisma.client.findFirst).toHaveBeenCalledWith({
          where: { id: CLIENT_ID, tenantId: TENANT_ID },
        });
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5.5 anonymize()
  // -------------------------------------------------------------------------
  describe('5.5 anonymize()', () => {
    const existingClient = { id: CLIENT_ID, tenantId: TENANT_ID };

    describe('field masking', () => {
      it('replaces firstName and lastName with ANONIM', async () => {
        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);

        await service.anonymize(CLIENT_ID, TENANT_ID);

        expect(prisma.client.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              firstName: 'ANONIM',
              lastName: 'ANONIM',
            }),
          }),
        );
      });

      it('replaces phone with "0000"', async () => {
        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);

        await service.anonymize(CLIENT_ID, TENANT_ID);

        const data = prisma.client.update.mock.calls[0][0].data as Record<string, unknown>;
        expect(data.phone).toBe('0000');
      });

      it('nullifies email and tcKimlik', async () => {
        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);

        await service.anonymize(CLIENT_ID, TENANT_ID);

        expect(prisma.client.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              email: null,
              tcKimlik: null,
            }),
          }),
        );
      });

      it('sets anonymizedAt to now', async () => {
        jest.useFakeTimers();
        const NOW = new Date('2025-10-01T09:00:00Z');
        jest.setSystemTime(NOW);

        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);

        await service.anonymize(CLIENT_ID, TENANT_ID);

        const data = prisma.client.update.mock.calls[0][0].data as Record<string, unknown>;
        expect(data.anonymizedAt).toEqual(NOW);

        jest.useRealTimers();
      });
    });

    describe('return value and query correctness', () => {
      it('returns { success: true }', async () => {
        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);

        const result = await service.anonymize(CLIENT_ID, TENANT_ID);

        expect(result).toEqual({ success: true });
      });

      it('looks up client by id and tenantId', async () => {
        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);

        await service.anonymize(CLIENT_ID, TENANT_ID);

        expect(prisma.client.findFirst).toHaveBeenCalledWith({
          where: { id: CLIENT_ID, tenantId: TENANT_ID },
        });
      });

      it('updates by id only in where clause', async () => {
        prisma.client.findFirst.mockResolvedValue(existingClient as never);
        prisma.client.update.mockResolvedValue({} as never);

        await service.anonymize(CLIENT_ID, TENANT_ID);

        expect(prisma.client.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: CLIENT_ID } }),
        );
      });
    });

    describe('not found', () => {
      it('throws NotFoundException when client does not exist', async () => {
        prisma.client.findFirst.mockResolvedValue(null);

        await expect(service.anonymize(CLIENT_ID, TENANT_ID)).rejects.toThrow(
          NotFoundException,
        );
        expect(prisma.client.update).not.toHaveBeenCalled();
      });

      it('throws NotFoundException when client belongs to a different tenant', async () => {
        prisma.client.findFirst.mockResolvedValue(null);

        await expect(service.anonymize(CLIENT_ID, 'other-tenant')).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });
});
