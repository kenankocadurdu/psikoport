import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { AdminService } from '../admin.service';
import { PrismaService } from '../../../database/prisma.service';

// ─── Mock factory ─────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    tenant: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-admin-1';
const USER_ID = 'user-admin-1';
const EXPIRES_AT = new Date('2026-12-31T00:00:00.000Z');

const ACTIVE_TENANT = { id: TENANT_ID, name: 'Klinik A', isActive: true, plan: 'FREE' };
const INACTIVE_TENANT = { ...ACTIVE_TENANT, isActive: false };
const ACTIVE_USER = { id: USER_ID, fullName: 'Dr. Ayşe', isActive: true, role: 'PSYCHOLOGIST' };
const INACTIVE_USER = { ...ACTIVE_USER, isActive: false };

// ─────────────────────────────────────────────────────────────────────────────
// 13. AdminService
// ─────────────────────────────────────────────────────────────────────────────

describe('AdminService – 13.', () => {
  let service: AdminService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  // ── 13.1 getStats() ───────────────────────────────────────────────────────

  describe('getStats()', () => {
    beforeEach(() => {
      // Return distinct values per call to verify each count maps to the right key
      prisma.tenant.count
        .mockResolvedValueOnce(10)  // totalTenants
        .mockResolvedValueOnce(7)   // activeTenants
        .mockResolvedValueOnce(3)   // freeTenants
        .mockResolvedValueOnce(4);  // proTenants
      prisma.user.count
        .mockResolvedValueOnce(20)  // totalPsychologists
        .mockResolvedValueOnce(2);  // pendingLicenses
    });

    it('returns totalTenants, activeTenants, totalPsychologists, pendingLicenses, freeTenants, proTenants', async () => {
      const stats = await service.getStats();
      expect(stats).toEqual({
        totalTenants: 10,
        activeTenants: 7,
        totalPsychologists: 20,
        pendingLicenses: 2,
        freeTenants: 3,
        proTenants: 4,
      });
    });

    it('counts active tenants with isActive: true filter', async () => {
      await service.getStats();
      expect(prisma.tenant.count).toHaveBeenCalledWith({ where: { isActive: true } });
    });

    it('counts psychologists with role PSYCHOLOGIST filter', async () => {
      await service.getStats();
      expect(prisma.user.count).toHaveBeenCalledWith({ where: { role: 'PSYCHOLOGIST' } });
    });

    it('counts pending licenses with PSYCHOLOGIST, PENDING status, and licenseDocUrl not null', async () => {
      await service.getStats();
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          role: 'PSYCHOLOGIST',
          licenseStatus: 'PENDING',
          licenseDocUrl: { not: null },
        },
      });
    });

    it('counts FREE plan tenants', async () => {
      await service.getStats();
      expect(prisma.tenant.count).toHaveBeenCalledWith({ where: { plan: 'FREE' } });
    });

    it('counts PRO plan tenants', async () => {
      await service.getStats();
      expect(prisma.tenant.count).toHaveBeenCalledWith({ where: { plan: 'PRO' } });
    });

    it('counts all tenants (no filter) for totalTenants', async () => {
      await service.getStats();
      expect(prisma.tenant.count).toHaveBeenCalledWith();
    });
  });

  // ── 13.2 getTenants() ─────────────────────────────────────────────────────

  describe('getTenants()', () => {
    beforeEach(() => {
      prisma.tenant.findMany.mockResolvedValue([ACTIVE_TENANT]);
      prisma.tenant.count.mockResolvedValue(1);
    });

    it('defaults to page 1, limit 20, skip 0', async () => {
      await service.getTenants();
      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('calculates skip from page and limit', async () => {
      await service.getTenants(3, 10);
      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('uses empty where when no search term', async () => {
      await service.getTenants(1, 20, undefined);
      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('filters by search term via OR name/slug contains case-insensitive', async () => {
      await service.getTenants(1, 20, 'klinik');
      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'klinik', mode: 'insensitive' } },
              { slug: { contains: 'klinik', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('orders by createdAt descending', async () => {
      await service.getTenants();
      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('returns { data, total, page, limit }', async () => {
      const result = await service.getTenants(2, 5);
      expect(result).toEqual({ data: [ACTIVE_TENANT], total: 1, page: 2, limit: 5 });
    });
  });

  // ── 13.3 toggleTenantActive() ────────────────────────────────────────────

  describe('toggleTenantActive()', () => {
    it('throws NotFoundException when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.toggleTenantActive(TENANT_ID)).rejects.toThrow(NotFoundException);
    });

    it('does not call update when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.toggleTenantActive(TENANT_ID)).rejects.toThrow();
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });

    it('sets isActive to false when tenant is currently active', async () => {
      prisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
      prisma.tenant.update.mockResolvedValue({ ...ACTIVE_TENANT, isActive: false });
      await service.toggleTenantActive(TENANT_ID);
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: TENANT_ID },
        data: { isActive: false },
      });
    });

    it('sets isActive to true when tenant is currently inactive', async () => {
      prisma.tenant.findUnique.mockResolvedValue(INACTIVE_TENANT);
      prisma.tenant.update.mockResolvedValue(ACTIVE_TENANT);
      await service.toggleTenantActive(TENANT_ID);
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: TENANT_ID },
        data: { isActive: true },
      });
    });

    it('returns the updated tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
      const updated = { ...ACTIVE_TENANT, isActive: false };
      prisma.tenant.update.mockResolvedValue(updated);
      const result = await service.toggleTenantActive(TENANT_ID);
      expect(result).toEqual(updated);
    });
  });

  // ── 13.4 getUsers() ───────────────────────────────────────────────────────

  describe('getUsers()', () => {
    beforeEach(() => {
      prisma.user.findMany.mockResolvedValue([ACTIVE_USER]);
      prisma.user.count.mockResolvedValue(1);
    });

    it('always filters by role PSYCHOLOGIST', async () => {
      await service.getUsers();
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ role: 'PSYCHOLOGIST' }) }),
      );
    });

    it('filters by search term via OR fullName/email contains case-insensitive', async () => {
      await service.getUsers(1, 20, 'ayşe');
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: 'PSYCHOLOGIST',
            OR: [
              { fullName: { contains: 'ayşe', mode: 'insensitive' } },
              { email: { contains: 'ayşe', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('no search → where is only { role: PSYCHOLOGIST }', async () => {
      await service.getUsers(1, 20, undefined);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'PSYCHOLOGIST' } }),
      );
    });

    it('calculates skip from page and limit', async () => {
      await service.getUsers(2, 10);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('returns { data, total, page, limit }', async () => {
      const result = await service.getUsers(1, 20);
      expect(result).toEqual({ data: [ACTIVE_USER], total: 1, page: 1, limit: 20 });
    });
  });

  // ── 13.5 toggleUserActive() ───────────────────────────────────────────────

  describe('toggleUserActive()', () => {
    it('throws NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.toggleUserActive(USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('does not call update when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.toggleUserActive(USER_ID)).rejects.toThrow();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('sets isActive to false when user is currently active', async () => {
      prisma.user.findUnique.mockResolvedValue(ACTIVE_USER);
      prisma.user.update.mockResolvedValue({ ...ACTIVE_USER, isActive: false });
      await service.toggleUserActive(USER_ID);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { isActive: false },
      });
    });

    it('sets isActive to true when user is currently inactive', async () => {
      prisma.user.findUnique.mockResolvedValue(INACTIVE_USER);
      prisma.user.update.mockResolvedValue(ACTIVE_USER);
      await service.toggleUserActive(USER_ID);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { isActive: true },
      });
    });

    it('returns the updated user', async () => {
      prisma.user.findUnique.mockResolvedValue(ACTIVE_USER);
      const updated = { ...ACTIVE_USER, isActive: false };
      prisma.user.update.mockResolvedValue(updated);
      expect(await service.toggleUserActive(USER_ID)).toEqual(updated);
    });
  });

  // ── 13.6 setRndPartner() ─────────────────────────────────────────────────

  describe('setRndPartner()', () => {
    it('throws NotFoundException when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.setRndPartner(TENANT_ID, EXPIRES_AT)).rejects.toThrow(NotFoundException);
    });

    it('does not call update when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.setRndPartner(TENANT_ID, EXPIRES_AT)).rejects.toThrow();
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });

    it('sets isRndPartner to true', async () => {
      prisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
      prisma.tenant.update.mockResolvedValue({});
      await service.setRndPartner(TENANT_ID, EXPIRES_AT);
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isRndPartner: true }),
        }),
      );
    });

    it('sets rndPartnerExpiresAt to provided date', async () => {
      prisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
      prisma.tenant.update.mockResolvedValue({});
      await service.setRndPartner(TENANT_ID, EXPIRES_AT);
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rndPartnerExpiresAt: EXPIRES_AT }),
        }),
      );
    });

    it('returns void (undefined)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(ACTIVE_TENANT);
      prisma.tenant.update.mockResolvedValue({});
      const result = await service.setRndPartner(TENANT_ID, EXPIRES_AT);
      expect(result).toBeUndefined();
    });
  });
});
