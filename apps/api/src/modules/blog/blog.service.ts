import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  async getForTenant(tenantId: string) {
    return this.prisma.blogPost.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, isActive: true },
    });
    if (!tenant) return null;
    return this.prisma.blogPost.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async upsert(
    tenantId: string,
    data: { title: string; content: string; publishedAt?: Date | null },
  ) {
    const existing = await this.prisma.blogPost.findFirst({
      where: { tenantId },
    });

    if (existing) {
      return this.prisma.blogPost.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          content: data.content,
          publishedAt: data.publishedAt,
        },
      });
    }

    return this.prisma.blogPost.create({
      data: {
        tenantId,
        title: data.title,
        content: data.content,
        publishedAt: data.publishedAt,
      },
    });
  }
}
