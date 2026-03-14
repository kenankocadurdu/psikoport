import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { LicensesService } from '../licenses.service';
import { PrismaService } from '../../../database/prisma.service';

// ─── Mock factory ─────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_ID = 'user-lic-1';

const PENDING_USER = {
  id: USER_ID,
  role: 'PSYCHOLOGIST',
  licenseStatus: 'PENDING',
  licenseDocUrl: 'https://example.com/doc.pdf',
  createdAt: new Date('2025-09-01'),
  tenant: { name: 'Klinik A', slug: 'klinik-a' },
};

const UPDATED_USER_VERIFIED = { ...PENDING_USER, licenseStatus: 'VERIFIED' };
const UPDATED_USER_REJECTED = { ...PENDING_USER, licenseStatus: 'REJECTED' };

// ─────────────────────────────────────────────────────────────────────────────
// 12. LicensesService (Admin)
// ─────────────────────────────────────────────────────────────────────────────

describe('LicensesService – 12. Admin License Management', () => {
  let service: LicensesService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicensesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LicensesService>(LicensesService);

    prisma.user.findMany.mockResolvedValue([PENDING_USER]);
    prisma.user.findFirst.mockResolvedValue(PENDING_USER);
    prisma.user.update.mockResolvedValue(UPDATED_USER_VERIFIED);
  });

  // ── getPending() ──────────────────────────────────────────────────────────

  describe('getPending()', () => {
    it('queries users with role PSYCHOLOGIST, licenseStatus PENDING, and licenseDocUrl not null', async () => {
      await service.getPending();
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: 'PSYCHOLOGIST',
            licenseStatus: 'PENDING',
            licenseDocUrl: { not: null },
          },
        }),
      );
    });

    it('includes tenant name and slug', async () => {
      await service.getPending();
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { tenant: { select: { name: true, slug: true } } },
        }),
      );
    });

    it('orders results by createdAt descending', async () => {
      await service.getPending();
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('returns the list from prisma', async () => {
      const result = await service.getPending();
      expect(result).toEqual([PENDING_USER]);
    });

    it('returns empty array when no pending users', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      const result = await service.getPending();
      expect(result).toEqual([]);
    });
  });

  // ── approve() ─────────────────────────────────────────────────────────────

  describe('approve()', () => {
    it('queries user with userId and role PSYCHOLOGIST', async () => {
      await service.approve(USER_ID);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: USER_ID, role: 'PSYCHOLOGIST' },
      });
    });

    it('throws NotFoundException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.approve(USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('does not call update when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.approve(USER_ID)).rejects.toThrow();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates licenseStatus to VERIFIED', async () => {
      await service.approve(USER_ID);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { licenseStatus: 'VERIFIED' },
      });
    });

    it('returns the updated user', async () => {
      prisma.user.update.mockResolvedValue(UPDATED_USER_VERIFIED);
      const result = await service.approve(USER_ID);
      expect(result).toEqual(UPDATED_USER_VERIFIED);
    });
  });

  // ── reject() ──────────────────────────────────────────────────────────────

  describe('reject()', () => {
    it('queries user with userId and role PSYCHOLOGIST', async () => {
      await service.reject(USER_ID);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: USER_ID, role: 'PSYCHOLOGIST' },
      });
    });

    it('throws NotFoundException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.reject(USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('does not call update when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.reject(USER_ID)).rejects.toThrow();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates licenseStatus to REJECTED', async () => {
      await service.reject(USER_ID);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { licenseStatus: 'REJECTED' },
      });
    });

    it('returns the updated user', async () => {
      prisma.user.update.mockResolvedValue(UPDATED_USER_REJECTED);
      const result = await service.reject(USER_ID);
      expect(result).toEqual(UPDATED_USER_REJECTED);
    });
  });
});
