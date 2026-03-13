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
});
