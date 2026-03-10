/**
 * Development seed script — populates the database with demo data.
 *
 * Run with:  pnpm db:seed   (from repo root)
 *            cd apps/api && pnpm db:seed
 *
 * ⚠️  Do NOT run against a production database.
 *     The script creates demo tenants, users, and clients with placeholder data.
 */
import { PrismaClient } from 'prisma-client';
import { createHash } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

// When adding v2+ consent texts: diffFromPrevious = computeDiffFromPrevious(prev.bodyHtml, newBody)

const TESTS_DIR = path.resolve(__dirname, '../../../packages/form-schemas/tests');
const INTAKE_DIR = path.resolve(__dirname, '../../../packages/form-schemas/intake');
const PSYCHOMETRIC_TESTS = ['phq9', 'gad7', 'dass21', 'who5', 'pss10', 'pcl5'] as const;
const INTAKE_FORMS = [
  { file: 'general.json', formType: 'INTAKE' as const },
  { file: 'depression.json', formType: 'INTAKE_ADDON' as const },
  { file: 'anxiety-panic.json', formType: 'INTAKE_ADDON' as const },
  { file: 'trauma-ptsd.json', formType: 'INTAKE_ADDON' as const },
];

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function main() {
  const kvkkBody = `<h1>KVKK Açık Rıza Metni</h1>
<p>Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında kişisel verilerinizin işlenmesine ilişkin açık rızanızı almak amacıyla hazırlanmıştır.</p>
<p>Verdiğiniz rıza ile kişisel verilerinizin danışmanlık hizmeti kapsamında işlenmesini, saklanmasını ve ilgili mevzuata uygun şekilde kullanılmasını kabul etmektesiniz.</p>
<p>Rızanızı her zaman geri alabilirsiniz.</p>`;

  const tosBody = `<h1>Kullanım Koşulları</h1>
<p>Psikoport platformunu kullanarak aşağıdaki koşulları kabul etmiş olursunuz.</p>
<p>Platform, danışmanlık yönetimi amacıyla sunulmaktadır. Hizmet kalitesi ve güvenliği için gerekli teknik ve idari tedbirler alınmaktadır.</p>
<p>Kullanım koşulları zaman zaman güncellenebilir. Güncel metin her zaman platformda yayınlanacaktır.</p>`;

  const kvkkHash = sha256(kvkkBody);
  const tosHash = sha256(tosBody);
  const effectiveFrom = new Date('2025-01-01T00:00:00Z');

  await prisma.consentText.upsert({
    where: {
      consentType_version: { consentType: 'KVKK_DATA_PROCESSING', version: 1 },
    },
    update: {},
    create: {
      consentType: 'KVKK_DATA_PROCESSING',
      version: 1,
      title: 'KVKK Kişisel Veri İşleme Açık Rıza Metni',
      bodyHtml: kvkkBody,
      bodyHash: kvkkHash,
      effectiveFrom,
      diffFromPrevious: null, // v1 has no previous
    },
  });

  await prisma.consentText.upsert({
    where: {
      consentType_version: { consentType: 'PLATFORM_TOS', version: 1 },
    },
    update: {},
    create: {
      consentType: 'PLATFORM_TOS',
      version: 1,
      title: 'Platform Kullanım Koşulları',
      bodyHtml: tosBody,
      bodyHash: tosHash,
      effectiveFrom,
      diffFromPrevious: null, // v1 has no previous
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-psikolog' },
    update: {},
    create: {
      name: 'Demo Psikolog',
      slug: 'demo-psikolog',
      plan: 'PRO',
      maxClients: 50,
      defaultSessionFee: 350,
      defaultCurrency: 'TRY',
      videoProvider: 'ZOOM',
      isActive: true,
    },
  });

  const user = await prisma.user.upsert({
    where: { auth0Sub: 'auth0|demo-psychologist-123' },
    update: { is2faEnabled: true },
    create: {
      tenantId: tenant.id,
      auth0Sub: 'auth0|demo-psychologist-123',
      email: 'demo@psikoport.com',
      fullName: 'Demo Psikolog',
      role: 'PSYCHOLOGIST',
      licenseStatus: 'VERIFIED',
      isActive: true,
    },
  });

  for (const { file, formType } of INTAKE_FORMS) {
    const filePath = path.join(INTAKE_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Intake form not found: ${filePath}`);
      continue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as {
      code: string;
      title: string;
      description?: string;
      formType: string;
      category?: string;
      estimatedMinutes?: number;
      schema: unknown;
    };
    await prisma.formDefinition.upsert({
      where: { code: data.code },
      update: {
        title: data.title,
        description: data.description ?? null,
        category: data.category ?? 'intake',
        estimatedMinutes: data.estimatedMinutes ?? null,
        schema: data.schema as object,
      },
      create: {
        tenantId: null,
        formType,
        code: data.code,
        title: data.title,
        description: data.description ?? null,
        category: data.category ?? 'intake',
        estimatedMinutes: data.estimatedMinutes ?? null,
        schema: data.schema as object,
        isSystem: true,
      },
    });
  }

  for (const testCode of PSYCHOMETRIC_TESTS) {
    const filePath = path.join(TESTS_DIR, `${testCode}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`Psychometric test JSON not found: ${filePath}`);
      continue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as {
      code: string;
      title: string;
      description?: string;
      formType: string;
      category?: string;
      estimatedMinutes?: number;
      schema: unknown;
      scoringConfig?: unknown;
    };
    await prisma.formDefinition.upsert({
      where: { code: data.code },
      update: {
        title: data.title,
        description: data.description ?? null,
        category: data.category ?? null,
        estimatedMinutes: data.estimatedMinutes ?? null,
        schema: data.schema as object,
        scoringConfig: data.scoringConfig ? (data.scoringConfig as object) : undefined,
      },
      create: {
        tenantId: null,
        formType: 'PSYCHOMETRIC',
        code: data.code,
        title: data.title,
        description: data.description ?? null,
        category: data.category ?? 'psychometric',
        estimatedMinutes: data.estimatedMinutes ?? null,
        schema: data.schema as object,
        scoringConfig: data.scoringConfig ? (data.scoringConfig as object) : undefined,
        isSystem: true,
      },
    });
  }

  await prisma.$executeRaw`SELECT set_current_tenant(${tenant.id})`;

  const demoClients = [
    { firstName: 'Ayşe', lastName: 'Yılmaz', complaintAreas: ['depresyon'], tags: ['öneri'] },
    { firstName: 'Mehmet', lastName: 'Kaya', complaintAreas: ['anksiyete', 'panik'], tags: [] },
    { firstName: 'Zeynep', lastName: 'Demir', complaintAreas: ['uyku', 'stres'], tags: ['devam'] },
    { firstName: 'Can', lastName: 'Öztürk', complaintAreas: ['ilişki', 'özgüven'], tags: [] },
    { firstName: 'Elif', lastName: 'Şahin', complaintAreas: ['travma', 'yas'], tags: ['kriz'] },
  ];

  const createdClients = [];
  for (const c of demoClients) {
    const client = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: c.firstName,
        lastName: c.lastName,
        complaintAreas: c.complaintAreas,
        tags: c.tags,
        email: `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase()}@example.com`,
        phone: '0532 000 00 00',
      },
    });
    createdClients.push(client);
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const appts: { clientIdx: number; daysOffset: number; duration: number }[] = [
    { clientIdx: 0, daysOffset: -14, duration: 50 },
    { clientIdx: 1, daysOffset: -7, duration: 50 },
    { clientIdx: 2, daysOffset: -3, duration: 50 },
    { clientIdx: 0, daysOffset: -1, duration: 50 },
    { clientIdx: 3, daysOffset: 0, duration: 50 },
    { clientIdx: 1, daysOffset: 1, duration: 50 },
    { clientIdx: 2, daysOffset: 3, duration: 50 },
    { clientIdx: 4, daysOffset: 5, duration: 50 },
    { clientIdx: 0, daysOffset: 7, duration: 50 },
    { clientIdx: 3, daysOffset: 14, duration: 50 },
  ];
  const createdAppts = [];
  for (const a of appts) {
    const d = new Date(today);
    d.setDate(d.getDate() + a.daysOffset);
    const start = new Date(d);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + a.duration);
    const status = a.daysOffset < 0 ? 'COMPLETED' : 'SCHEDULED';
    const apt = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        clientId: createdClients[a.clientIdx].id,
        psychologistId: user.id,
        startTime: start,
        endTime: end,
        durationMinutes: a.duration,
        status,
        locationType: a.daysOffset >= 0 ? 'ONLINE' : 'IN_PERSON',
      },
    });
    createdAppts.push(apt);
  }

  const { encryptNoteForSeed } = await import('./seed-helpers/encrypt-note');
  const noteContents = [
    'İlk görüşme. Danışan kendini tanıttı. Ana şikayet: motivasyon düşüklüğü.',
    'Duygu durumu üzerine çalışıldı. Ev ödevi verildi.',
    'Uyku hijyeni konuşuldu. Rutin önerileri paylaşıldı.',
    'İlişki dinamikleri ele alındı. Sonraki seans planlandı.',
    'Yas süreci üzerine çalışıldı. Kabul aşaması desteklendi.',
  ];
  for (let i = 0; i < Math.min(5, createdClients.length, noteContents.length); i++) {
    const enc = await encryptNoteForSeed(noteContents[i]);
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - (7 + i));
    await prisma.consultationNote.create({
      data: {
        tenantId: tenant.id,
        clientId: createdClients[i].id,
        sessionDate: pastDate,
        sessionNumber: i + 1,
        sessionType: 'Bireysel',
        tags: ['seans'],
        symptomCategories: demoClients[i].complaintAreas,
        moodRating: 6,
        durationMinutes: 50,
        encryptedContent: enc.encryptedContent,
        encryptedDek: enc.encryptedDek,
        contentNonce: enc.contentNonce,
        contentAuthTag: enc.contentAuthTag,
        dekNonce: enc.dekNonce,
        dekAuthTag: enc.dekAuthTag,
      },
    });
  }

  const formDefs = await prisma.formDefinition.findMany({
    where: { code: { in: ['phq9', 'gad7', 'dass21'] } },
    select: { id: true, code: true, scoringConfig: true },
  });
  const { calculateScore } = await import('@psikoport/scoring-engine');
  const testResponses: Record<string, Record<string, string>> = {
    phq9: { q1: '1', q2: '1', q3: '0', q4: '1', q5: '0', q6: '0', q7: '1', q8: '0', q9: '0' },
    gad7: { q1: '1', q2: '0', q3: '1', q4: '0', q5: '1', q6: '0', q7: '0' },
    dass21: { q1: '1', q2: '2', q3: '0', q4: '3', q5: '1', q6: '2', q7: '0', q8: '1', q9: '2', q10: '0', q11: '1', q12: '2', q13: '0', q14: '1', q15: '2', q16: '1', q17: '0', q18: '1', q19: '2', q20: '0', q21: '1' },
  };
  for (let i = 0; i < Math.min(3, formDefs.length, createdClients.length); i++) {
    const fd = formDefs[i];
    const responses = testResponses[fd.code as keyof typeof testResponses] ?? {};
    const cfg = fd.scoringConfig as Parameters<typeof calculateScore>[1] | null;
    const result = cfg && typeof cfg === 'object' ? calculateScore(responses as Record<string, unknown>, cfg) : { totalScore: 0, severityLevel: null, riskFlags: [] };
    await prisma.formSubmission.create({
      data: {
        tenantId: tenant.id,
        clientId: createdClients[i].id,
        formDefinitionId: fd.id,
        psychologistId: user.id,
        responses: responses as object,
        completionStatus: 'COMPLETE',
        submittedAt: new Date(Date.now() - (3 - i) * 86400000),
        formVersion: 1,
        scores: (result as { totalScore?: number; severityLevel?: string; riskFlags?: string[] }) as object,
        severityLevel: (result as { severityLevel?: string }).severityLevel ?? null,
        riskFlags: (result as { riskFlags?: string[] }).riskFlags ?? [],
      },
    });
  }

  const completedAppts = createdAppts.filter((a) => a.status === 'COMPLETED');
  for (const apt of completedAppts) {
    await prisma.sessionPayment.create({
      data: {
        tenantId: tenant.id,
        clientId: apt.clientId,
        appointmentId: apt.id,
        psychologistId: user.id,
        sessionDate: apt.startTime,
        amount: 350,
        currency: 'TRY',
        status: apt === completedAppts[0] ? 'PAID' : 'PENDING',
        paidAt: apt === completedAppts[0] ? new Date() : null,
      },
    });
  }

  console.log(
    'Seed completed: 1 tenant, 1 psychologist user, 2 consent texts, 10 form definitions (4 intake + 6 psychometric)',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
