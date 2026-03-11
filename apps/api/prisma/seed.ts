/**
 * Production system seed — sadece sistem verisi.
 * Demo tenant/kullanıcı/danışan OLUŞTURMAZ.
 *
 * Docker başlangıcında otomatik çalışır (Dockerfile CMD).
 * Tüm işlemler idempotent: kayıt varsa atlar, yoksa oluşturur.
 *
 * Yerel geliştirme için:
 *   pnpm db:seed              (repo kökünden)
 *   cd apps/api && pnpm db:seed
 */
import { PrismaClient } from 'prisma-client';
import { createHash } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

const TESTS_DIR = path.resolve(__dirname, '../../../packages/form-schemas/tests');
const INTAKE_DIR = path.resolve(__dirname, '../../../packages/form-schemas/intake');

const PSYCHOMETRIC_TESTS = [
  'phq9', 'gad7', 'dass21', 'who5', 'pss10', 'pcl5',
] as const;

const INTAKE_FORMS = [
  { file: 'general.json',        formType: 'INTAKE' as const },
  { file: 'depression.json',     formType: 'INTAKE_ADDON' as const },
  { file: 'anxiety-panic.json',  formType: 'INTAKE_ADDON' as const },
  { file: 'trauma-ptsd.json',    formType: 'INTAKE_ADDON' as const },
];

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function seedConsentTexts() {
  const effectiveFrom = new Date('2025-01-01T00:00:00Z');

  const kvkkBody = `<h1>KVKK Açık Rıza Metni</h1>
<p>Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında kişisel verilerinizin işlenmesine ilişkin açık rızanızı almak amacıyla hazırlanmıştır.</p>
<p>Verdiğiniz rıza ile kişisel verilerinizin danışmanlık hizmeti kapsamında işlenmesini, saklanmasını ve ilgili mevzuata uygun şekilde kullanılmasını kabul etmektesiniz.</p>
<p>Rızanızı her zaman geri alabilirsiniz.</p>`;

  const tosBody = `<h1>Kullanım Koşulları</h1>
<p>Psikoport platformunu kullanarak aşağıdaki koşulları kabul etmiş olursunuz.</p>
<p>Platform, danışmanlık yönetimi amacıyla sunulmaktadır. Hizmet kalitesi ve güvenliği için gerekli teknik ve idari tedbirler alınmaktadır.</p>
<p>Kullanım koşulları zaman zaman güncellenebilir. Güncel metin her zaman platformda yayınlanacaktır.</p>`;

  await prisma.consentText.upsert({
    where: { consentType_version: { consentType: 'KVKK_DATA_PROCESSING', version: 1 } },
    update: {},
    create: {
      consentType: 'KVKK_DATA_PROCESSING',
      version: 1,
      title: 'KVKK Kişisel Veri İşleme Açık Rıza Metni',
      bodyHtml: kvkkBody,
      bodyHash: sha256(kvkkBody),
      effectiveFrom,
      diffFromPrevious: null,
    },
  });

  await prisma.consentText.upsert({
    where: { consentType_version: { consentType: 'PLATFORM_TOS', version: 1 } },
    update: {},
    create: {
      consentType: 'PLATFORM_TOS',
      version: 1,
      title: 'Platform Kullanım Koşulları',
      bodyHtml: tosBody,
      bodyHash: sha256(tosBody),
      effectiveFrom,
      diffFromPrevious: null,
    },
  });

  console.log('✓ Consent texts seeded');
}

async function seedFormDefinitions() {
  let count = 0;

  for (const { file, formType } of INTAKE_FORMS) {
    const filePath = path.join(INTAKE_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ Intake form not found: ${filePath}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
      code: string;
      title: string;
      description?: string;
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
    count++;
  }

  for (const testCode of PSYCHOMETRIC_TESTS) {
    const filePath = path.join(TESTS_DIR, `${testCode}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ Psychometric test not found: ${filePath}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
      code: string;
      title: string;
      description?: string;
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
    count++;
  }

  console.log(`✓ Form definitions seeded (${count} forms)`);
}

async function seedPlanConfigs() {
  const existing = await prisma.planConfig.findFirst();
  if (existing) {
    console.log('✓ PlanConfig already seeded, skipping');
    return;
  }

  const defaults = [
    { planCode: 'FREE' as const,       monthlySessionQuota: 25,  testsPerSession: 10, monthlyPrice: 0,    trialDays: 7 },
    { planCode: 'PRO' as const,        monthlySessionQuota: 250, testsPerSession: 10, monthlyPrice: 999,  trialDays: 0 },
    { planCode: 'PROPLUS' as const, monthlySessionQuota: 500, testsPerSession: 10, monthlyPrice: 1200, trialDays: 0 },
  ];

  for (const d of defaults) {
    await prisma.planConfig.create({ data: d });
  }

  console.log('✓ PlanConfigs seeded (FREE:25, PRO:250, PROPLUS:500)');
}

async function main() {
  console.log('🚀 Psikoport system seed başlıyor...');
  await seedConsentTexts();
  await seedFormDefinitions();
  await seedPlanConfigs();
  console.log('✅ System seed tamamlandı.');
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
