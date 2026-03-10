import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../common/services/storage.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { Prisma } from 'prisma-client';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, isActive: true },
    });
    if (!tenant) {
      throw new NotFoundException('Profil bulunamadı');
    }

    await this.prisma.$executeRaw`SELECT set_current_tenant(${tenant.id})`;

    const profile = await this.prisma.psychologistProfile.findFirst({
      where: { tenantId: tenant.id },
      include: {
        user: { select: { fullName: true } },
      },
    });

    if (!profile) {
      const user = await this.prisma.user.findFirst({
        where: { tenantId: tenant.id, role: 'PSYCHOLOGIST' },
        select: { fullName: true },
      });
      return {
        slug,
        fullName: user?.fullName ?? tenant.name,
        bio: null,
        specializations: [],
        education: [],
        experience: [],
        photoUrl: null,
        sessionTypes: [],
        sessionFee: null,
        officeAddress: null,
        languages: [],
        seoTitle: null,
        seoDescription: null,
        seoKeywords: null,
      };
    }

    let photoUrl: string | null = null;
    if (profile.photoUrl) {
      try {
        photoUrl = await this.storage.generateDownloadUrl(profile.photoUrl);
      } catch {
        photoUrl = null;
      }
    }

    return {
      slug,
      fullName: profile.user.fullName,
      bio: profile.bio,
      specializations: profile.specializations,
      education: (profile.education as Array<unknown>) ?? [],
      experience: (profile.experience as Array<unknown>) ?? [],
      photoUrl,
      sessionTypes: profile.sessionTypes,
      sessionFee: profile.sessionFee ? Number(profile.sessionFee) : null,
      officeAddress: profile.officeAddress,
      languages: profile.languages,
      seoTitle: profile.seoTitle,
      seoDescription: profile.seoDescription,
      seoKeywords: profile.seoKeywords,
    };
  }

  async getByUserId(userId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { slug: true },
    });

    const profile = await this.prisma.psychologistProfile.findFirst({
      where: { userId, tenantId },
      include: { user: { select: { fullName: true } } },
    });

    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { fullName: true },
    });

    if (!profile) {
      return {
        tenantSlug: tenant?.slug ?? null,
        fullName: user?.fullName ?? '',
        bio: null,
        specializations: [],
        education: [],
        experience: [],
        photoUrl: null,
        sessionTypes: [],
        sessionFee: null,
        officeAddress: null,
        languages: [],
        seoTitle: null,
        seoDescription: null,
        seoKeywords: null,
      };
    }

    let photoDisplayUrl: string | null = null;
    if (profile.photoUrl) {
      try {
        photoDisplayUrl = await this.storage.generateDownloadUrl(profile.photoUrl);
      } catch {
        photoDisplayUrl = null;
      }
    }

    return {
      ...profile,
      tenantSlug: tenant?.slug ?? null,
      photoDisplayUrl,
      sessionFee: profile.sessionFee ? Number(profile.sessionFee) : null,
    };
  }

  async update(userId: string, tenantId: string, dto: UpdateProfileDto) {
    const data: Prisma.PsychologistProfileUpdateInput = {};
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.specializations !== undefined) data.specializations = dto.specializations;
    if (dto.education !== undefined) data.education = dto.education as Prisma.InputJsonValue;
    if (dto.experience !== undefined) data.experience = dto.experience as Prisma.InputJsonValue;
    if (dto.photoUrl !== undefined) data.photoUrl = dto.photoUrl;
    if (dto.sessionTypes !== undefined) data.sessionTypes = dto.sessionTypes;
    if (dto.sessionFee !== undefined) data.sessionFee = dto.sessionFee;
    if (dto.officeAddress !== undefined) data.officeAddress = dto.officeAddress;
    if (dto.languages !== undefined) data.languages = dto.languages;
    if (dto.seoTitle !== undefined) data.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) data.seoDescription = dto.seoDescription;
    if (dto.seoKeywords !== undefined) data.seoKeywords = dto.seoKeywords;

    return this.prisma.psychologistProfile.upsert({
      where: { userId },
      create: { userId, tenantId, ...data } as Prisma.PsychologistProfileUncheckedCreateInput,
      update: data,
    });
  }

  async generatePhotoUploadUrl(
    userId: string,
    tenantId: string,
    filename: string,
    contentType: string,
  ) {
    const key = this.storage.buildProfilePhotoKey(tenantId, userId, filename);
    const { url } = await this.storage.generateUploadUrl(key, contentType);
    return { uploadUrl: url, key };
  }

  async setPhotoKey(userId: string, tenantId: string, key: string) {
    return this.prisma.psychologistProfile.upsert({
      where: { userId },
      create: { userId, tenantId, photoUrl: key },
      update: { photoUrl: key },
    });
  }
}
