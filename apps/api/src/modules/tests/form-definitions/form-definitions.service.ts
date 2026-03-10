import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { FormType, Prisma } from 'prisma-client';
import { PrismaService } from '../../../database/prisma.service';
import type { FormDefinitionQueryDto } from './dto/form-definition-query.dto';
import type { CreateFormDefinitionDto } from './dto/create-form-definition.dto';
import type { UpdateFormDefinitionDto } from './dto/update-form-definition.dto';
import type { PaginatedResponse } from '../../legal/audit-log.service';

@Injectable()
export class FormDefinitionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: FormDefinitionQueryDto,
    tenantId?: string,
  ): Promise<
    PaginatedResponse<{
      id: string;
      formType: string;
      code: string;
      title: string;
      description: string | null;
      category: string | null;
      version: number;
      isSystem: boolean;
      isActive: boolean;
      createdAt: Date;
    }>
  > {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.FormDefinitionWhereInput = {};

    if (query.formType) {
      where.formType = query.formType as FormType;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.isSystem !== undefined) {
      where.isSystem = query.isSystem;
    }

    if (tenantId) {
      where.OR = [{ tenantId: null }, { tenantId }];
    } else {
      where.tenantId = null;
    }

    const [data, total] = await Promise.all([
      this.prisma.formDefinition.findMany({
        where,
        orderBy: [{ formType: 'asc' }, { code: 'asc' }],
        skip,
        take: limit,
        select: {
          id: true,
          formType: true,
          code: true,
          title: true,
          description: true,
          category: true,
          version: true,
          isSystem: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.formDefinition.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByCode(code: string, tenantId?: string) {
    const forms = await this.prisma.formDefinition.findMany({
      where: {
        code,
        isActive: true,
        OR: tenantId
          ? [{ tenantId: null }, { tenantId }]
          : [{ tenantId: null }],
      },
      orderBy: [{ tenantId: 'desc' }, { version: 'desc' }],
      take: 1,
    });

    const form = forms[0];
    if (!form) {
      throw new NotFoundException('Form tanımı bulunamadı');
    }
    return form;
  }

  async findById(id: string, tenantId: string) {
    const form = await this.prisma.formDefinition.findFirst({
      where: {
        id,
        OR: [{ tenantId: null }, { tenantId }],
      },
    });

    if (!form) {
      throw new NotFoundException('Form tanımı bulunamadı');
    }

    return form;
  }

  async create(dto: CreateFormDefinitionDto, tenantId: string) {
    const existing = await this.prisma.formDefinition.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException('Bu kod zaten kullanılıyor');
    }

    return this.prisma.formDefinition.create({
      data: {
        tenantId,
        formType: dto.formType,
        code: dto.code,
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category ?? null,
        targetAgeGroup: dto.targetAgeGroup ?? null,
        estimatedMinutes: dto.estimatedMinutes ?? null,
        licenseStatus: dto.licenseStatus ?? null,
        schema: dto.schema as object,
        scoringConfig: dto.scoringConfig != null ? (dto.scoringConfig as Prisma.InputJsonValue) : Prisma.DbNull,
        isSystem: false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateFormDefinitionDto, tenantId: string) {
    const existing = await this.findById(id, tenantId);
    if (existing.isSystem) {
      throw new ConflictException('Sistem formları güncellenemez');
    }

    return this.prisma.formDefinition.update({
      where: { id },
      data: {
        version: existing.version + 1,
        ...(dto.formType && { formType: dto.formType }),
        ...(dto.code && { code: dto.code }),
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.targetAgeGroup !== undefined && {
          targetAgeGroup: dto.targetAgeGroup,
        }),
        ...(dto.estimatedMinutes !== undefined && {
          estimatedMinutes: dto.estimatedMinutes,
        }),
        ...(dto.licenseStatus !== undefined && {
          licenseStatus: dto.licenseStatus,
        }),
        ...(dto.schema && { schema: dto.schema as object }),
        ...(dto.scoringConfig !== undefined && {
          scoringConfig:
            dto.scoringConfig === null
              ? Prisma.JsonNull
              : (dto.scoringConfig as object),
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async seed(): Promise<{ created: number }> {
    const emptySchema = { version: 1, sections: [] };

    const systemForms = [
      {
        code: 'INTAKE',
        formType: 'INTAKE',
        title: 'Genel Başvuru Formu',
        description: 'Danışan karşılama formu (iskelet)',
        category: 'intake',
        isSystem: true,
      },
    ];

    let created = 0;
    for (const f of systemForms) {
      const exists = await this.prisma.formDefinition.findUnique({
        where: { code: f.code },
      });
      if (!exists) {
        await this.prisma.formDefinition.create({
          data: {
            tenantId: null,
            formType: f.formType as FormType,
            code: f.code,
            title: f.title,
            description: f.description,
            category: f.category,
            schema: emptySchema,
            isSystem: f.isSystem,
          },
        });
        created++;
      }
    }

    return { created };
  }
}
