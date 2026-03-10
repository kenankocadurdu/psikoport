import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

/**
 * KVKK veri taşınabilirliği — düz metin meta veri only.
 * Şifreli içerikler (consultation note body) export'a DAHİL DEĞİL.
 */
@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportClientData(
    clientId: string,
    tenantId: string,
    format: 'json' | 'csv',
  ): Promise<{ data: string; contentType: string; filename: string }> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) {
      throw new NotFoundException('Danışan bulunamadı');
    }

    const [notesMeta, clientFiles] = await Promise.all([
      this.prisma.consultationNote.findMany({
        where: { clientId, tenantId },
        orderBy: { sessionDate: 'desc' },
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
      this.prisma.clientFile.findMany({
        where: { clientId, tenantId },
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          createdAt: true,
        },
      }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        birthDate: client.birthDate?.toISOString() ?? null,
        gender: client.gender,
        maritalStatus: client.maritalStatus,
        educationLevel: client.educationLevel,
        occupation: client.occupation,
        address: client.address,
        tags: client.tags,
        complaintAreas: client.complaintAreas,
        status: client.status,
        createdAt: client.createdAt.toISOString(),
      },
      consultationNotesMeta: notesMeta.map((n) => ({
        id: n.id,
        sessionDate: n.sessionDate.toISOString(),
        sessionNumber: n.sessionNumber,
        sessionType: n.sessionType,
        tags: n.tags,
        symptomCategories: n.symptomCategories,
        moodRating: n.moodRating,
        durationMinutes: n.durationMinutes,
        createdAt: n.createdAt.toISOString(),
      })),
      files: clientFiles.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        createdAt: f.createdAt.toISOString(),
      })),
    };

    const baseName = `danisan-${client.firstName}-${client.lastName}-${clientId.slice(0, 8)}`;

    if (format === 'json') {
      return {
        data: JSON.stringify(payload, null, 2),
        contentType: 'application/json',
        filename: `${baseName}.json`,
      };
    }

    const csv = this.toCsv(payload);
    return {
      data: csv,
      contentType: 'text/csv; charset=utf-8',
      filename: `${baseName}.csv`,
    };
  }

  private toCsv(payload: Record<string, unknown>): string {
    const lines: string[] = [];
    lines.push('Bölüm,Alan,Değer');
    const esc = (v: unknown) =>
      `"${String(v ?? '').replace(/"/g, '""')}"`;

    const client = payload.client as Record<string, unknown> | undefined;
    if (client) {
      for (const [k, v] of Object.entries(client)) {
        lines.push(`Client,${k},${esc(v)}`);
      }
    }

    const notes = payload.consultationNotesMeta as Array<Record<string, unknown>> | undefined;
    if (notes?.length) {
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        for (const [k, v] of Object.entries(n)) {
          lines.push(`SeansNotu_${i + 1},${k},${esc(v)}`);
        }
      }
    }

    const files = payload.files as Array<Record<string, unknown>> | undefined;
    if (files?.length) {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        for (const [k, v] of Object.entries(f)) {
          lines.push(`Dosya_${i + 1},${k},${esc(v)}`);
        }
      }
    }

    return lines.join('\n');
  }
}
