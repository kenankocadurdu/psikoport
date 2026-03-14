import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import type { CreateNoteDto } from './dto/create-note.dto';
import type { UpdateNoteMetaDto } from './dto/update-note-meta.dto';
import type { NoteQueryDto } from './dto/note-query.dto';
import type { PaginatedResponse } from '../../legal/audit-log.service';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(
    clientId: string,
    tenantId: string,
    dto: CreateNoteDto,
  ): Promise<{ id: string }> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) {
      throw new NotFoundException('Danışan bulunamadı');
    }

    const { ciphertext, nonce, authTag } = await this.encryptionService.encrypt(
      tenantId,
      dto.content,
    );

    const note = await this.prisma.consultationNote.create({
      data: {
        tenantId,
        clientId,
        sessionDate: new Date(dto.sessionDate),
        sessionNumber: dto.sessionNumber ?? null,
        sessionType: dto.sessionType ?? null,
        tags: dto.tags ?? [],
        symptomCategories: dto.symptomCategories ?? [],
        moodRating: dto.moodRating ?? null,
        durationMinutes: dto.durationMinutes ?? null,
        encryptedContent: ciphertext,
        contentNonce: nonce,
        contentAuthTag: authTag,
        // DEK envelope unused — empty sentinel
        encryptedDek: Buffer.alloc(0),
        dekNonce: Buffer.alloc(0),
        dekAuthTag: Buffer.alloc(0),
      },
    });
    return { id: note.id };
  }

  async findAll(
    clientId: string,
    tenantId: string,
    query: NoteQueryDto,
  ): Promise<
    PaginatedResponse<{
      id: string;
      sessionDate: Date;
      sessionNumber: number | null;
      sessionType: string | null;
      tags: string[];
      symptomCategories: string[];
      moodRating: number | null;
      durationMinutes: number | null;
      createdAt: Date;
    }>
  > {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: {
      tenantId: string;
      clientId: string;
      sessionDate?: { gte?: Date; lte?: Date };
      tags?: { hasEvery?: string[] };
    } = {
      tenantId,
      clientId,
    };

    if (query.fromDate || query.toDate) {
      where.sessionDate = {};
      if (query.fromDate) where.sessionDate.gte = new Date(query.fromDate);
      if (query.toDate) where.sessionDate.lte = new Date(query.toDate);
    }

    if (query.tags?.length) {
      where.tags = { hasEvery: query.tags };
    }

    const [data, total] = await Promise.all([
      this.prisma.consultationNote.findMany({
        where,
        orderBy: { sessionDate: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          sessionDate: true,
          sessionNumber: true,
          sessionType: true,
          tags: true,
          symptomCategories: true,
          moodRating: true,
          durationMinutes: true,
          createdAt: true,
        },
      }),
      this.prisma.consultationNote.count({ where }),
    ]);

    return {
      data: data.map((row) => ({
        id: row.id,
        sessionDate: row.sessionDate,
        sessionNumber: row.sessionNumber,
        sessionType: row.sessionType,
        tags: row.tags,
        symptomCategories: row.symptomCategories,
        moodRating: row.moodRating,
        durationMinutes: row.durationMinutes,
        createdAt: row.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    clientId: string,
    noteId: string,
    tenantId: string,
  ): Promise<{
    id: string;
    sessionDate: Date;
    sessionNumber: number | null;
    sessionType: string | null;
    tags: string[];
    symptomCategories: string[];
    moodRating: number | null;
    durationMinutes: number | null;
    content: string;
    createdAt: Date;
  }> {
    const note = await this.prisma.consultationNote.findFirst({
      where: { id: noteId, clientId, tenantId },
    });

    if (!note) {
      throw new NotFoundException('Not bulunamadı');
    }

    const content = await this.encryptionService.decrypt(
      tenantId,
      note.encryptedContent,
      note.contentNonce,
      note.contentAuthTag,
    );

    return {
      id: note.id,
      sessionDate: note.sessionDate,
      sessionNumber: note.sessionNumber,
      sessionType: note.sessionType,
      tags: note.tags,
      symptomCategories: note.symptomCategories,
      moodRating: note.moodRating,
      durationMinutes: note.durationMinutes,
      content,
      createdAt: note.createdAt,
    };
  }

  async updateMeta(
    clientId: string,
    noteId: string,
    tenantId: string,
    dto: UpdateNoteMetaDto,
  ) {
    const existing = await this.prisma.consultationNote.findFirst({
      where: { id: noteId, clientId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Not bulunamadı');
    }

    return this.prisma.consultationNote.update({
      where: { id: noteId },
      data: {
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.symptomCategories !== undefined && {
          symptomCategories: dto.symptomCategories,
        }),
        ...(dto.moodRating !== undefined && { moodRating: dto.moodRating }),
      },
    });
  }

  async delete(clientId: string, noteId: string, tenantId: string): Promise<void> {
    const existing = await this.prisma.consultationNote.findFirst({
      where: { id: noteId, clientId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Not bulunamadı');
    }

    await this.prisma.consultationNote.delete({
      where: { id: noteId },
    });
  }
}
