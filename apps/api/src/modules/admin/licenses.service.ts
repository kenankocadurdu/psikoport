import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LicenseStatus } from 'prisma-client';

@Injectable()
export class LicensesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPending() {
    return this.prisma.user.findMany({
      where: {
        role: 'PSYCHOLOGIST',
        licenseStatus: LicenseStatus.PENDING,
        licenseDocUrl: { not: null },
      },
      include: {
        tenant: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: 'PSYCHOLOGIST' },
    });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { licenseStatus: LicenseStatus.VERIFIED },
    });
  }

  async reject(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: 'PSYCHOLOGIST' },
    });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { licenseStatus: LicenseStatus.REJECTED },
    });
  }
}
