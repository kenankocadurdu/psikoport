import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [
      totalTenants,
      activeTenants,
      totalPsychologists,
      pendingLicenses,
      freeTenants,
      proTenants,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { role: 'PSYCHOLOGIST' } }),
      this.prisma.user.count({
        where: {
          role: 'PSYCHOLOGIST',
          licenseStatus: 'PENDING',
          licenseDocUrl: { not: null },
        },
      }),
      this.prisma.tenant.count({ where: { plan: 'FREE' } }),
      this.prisma.tenant.count({ where: { plan: 'PRO' } }),
    ]);

    return {
      totalTenants,
      activeTenants,
      totalPsychologists,
      pendingLicenses,
      freeTenants,
      proTenants,
    };
  }

  async getTenants(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          users: {
            where: { role: 'PSYCHOLOGIST' },
            select: {
              id: true,
              fullName: true,
              email: true,
              licenseStatus: true,
              isActive: true,
            },
          },
          _count: { select: { clients: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async toggleTenantActive(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant bulunamadı');
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive: !tenant.isActive },
    });
  }

  async getUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          role: 'PSYCHOLOGIST' as const,
          OR: [
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : { role: 'PSYCHOLOGIST' as const };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async toggleUserActive(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });
  }
}
