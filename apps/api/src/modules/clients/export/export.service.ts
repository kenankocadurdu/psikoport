import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';

/**
 * KVKK veri taşınabilirliği — düz metin meta veri only.
 * Şifreli içerikler (consultation note body) export'a DAHİL DEĞİL.
 * GDPR export'u şifreli notları çözerek tam içerik sağlar.
 */
@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

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

  /**
   * GDPR/KVKK veri taşınabilirliği — şifreli notlar dahil tam veri seti.
   */
  async exportGdprJson(clientId: string, tenantId: string): Promise<object> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) throw new NotFoundException('Danışan bulunamadı');

    const [notes, formSubmissions, appointments, payments, files] =
      await Promise.all([
        this.prisma.consultationNote.findMany({
          where: { clientId, tenantId },
          orderBy: { sessionDate: 'desc' },
        }),
        this.prisma.formSubmission.findMany({
          where: { clientId, tenantId },
          include: { formDefinition: { select: { title: true, code: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.appointment.findMany({
          where: { clientId, tenantId },
          orderBy: { startTime: 'desc' },
          select: {
            id: true, startTime: true, endTime: true, status: true,
            sessionType: true, locationType: true, cancellationReason: true,
            createdAt: true,
          },
        }),
        this.prisma.sessionPayment.findMany({
          where: { clientId, tenantId },
          orderBy: { sessionDate: 'desc' },
          select: {
            id: true, sessionDate: true, amount: true, currency: true,
            status: true, paidAmount: true, paidAt: true, paymentMethod: true,
            createdAt: true,
          },
        }),
        this.prisma.clientFile.findMany({
          where: { clientId, tenantId },
          select: {
            id: true, fileName: true, fileSize: true, mimeType: true, createdAt: true,
          },
        }),
      ]);

    const decryptedNotes = await Promise.all(
      notes.map(async (n) => {
        let content: string | null = null;
        try {
          content = await this.encryption.decrypt(
            tenantId,
            Buffer.from(n.encryptedContent),
            Buffer.from(n.contentNonce),
            Buffer.from(n.contentAuthTag),
          );
        } catch {
          content = '[ŞİFRE ÇÖZÜLEMEZ — DEK imha edilmiş olabilir]';
        }
        return {
          id: n.id,
          sessionDate: n.sessionDate.toISOString(),
          sessionNumber: n.sessionNumber,
          sessionType: n.sessionType,
          tags: n.tags,
          symptomCategories: n.symptomCategories,
          moodRating: n.moodRating,
          durationMinutes: n.durationMinutes,
          content,
          createdAt: n.createdAt.toISOString(),
        };
      }),
    );

    return {
      exportedAt: new Date().toISOString(),
      exportVersion: '2.0',
      dataSubject: 'client',
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
        referralSource: client.referralSource,
        status: client.status,
        createdAt: client.createdAt.toISOString(),
        anonymizedAt: client.anonymizedAt?.toISOString() ?? null,
      },
      consultationNotes: decryptedNotes,
      formSubmissions: formSubmissions.map((f) => ({
        id: f.id,
        form: { title: f.formDefinition.title, code: f.formDefinition.code },
        responses: f.responses,
        scores: f.scores,
        severityLevel: f.severityLevel,
        completionStatus: f.completionStatus,
        submittedAt: f.submittedAt?.toISOString() ?? null,
        createdAt: f.createdAt.toISOString(),
      })),
      appointments: appointments.map((a) => ({
        ...a,
        startTime: a.startTime.toISOString(),
        endTime: a.endTime.toISOString(),
        createdAt: a.createdAt.toISOString(),
      })),
      payments: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        paidAmount: p.paidAmount ? Number(p.paidAmount) : null,
        sessionDate: p.sessionDate.toISOString(),
        paidAt: p.paidAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      files: files.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })),
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
