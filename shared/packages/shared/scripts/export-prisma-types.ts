/**
 * export-prisma-types.ts
 *
 * Prisma Client'ın generate ettiği tip tanımlarından model tiplerini okur
 * ve shared/packages/shared/types/prisma-models.ts dosyasına re-export eder.
 *
 * Kullanım: pnpm --filter @psikoport/shared generate:types
 */

import * as fs from 'fs';
import * as path from 'path';

const PRISMA_TYPES_SOURCE = path.resolve(
  __dirname,
  '../../../../apps/api/node_modules/.prisma/client/index.d.ts',
);

const OUTPUT_FILE = path.resolve(__dirname, '../types/prisma-models.ts');

// Prisma schema'daki model adları — schema değiştikçe bu liste güncellenmeli
const MODEL_NAMES = [
  'Tenant',
  'User',
  'Invitation',
  'PsychologistProfile',
  'BlogPost',
  'ConsentText',
  'Consent',
  'Client',
  'ConsultationNote',
  'ClientFile',
  'FormDefinition',
  'FormSubmission',
  'Appointment',
  'AvailabilitySlot',
  'CalendarIntegration',
  'ExternalCalendarEvent',
  'VideoIntegration',
  'SessionPayment',
  'PaymentSettings',
  'AuditLog',
  'ProcessedWebhookEvent',
];

// Enum adları
const ENUM_NAMES = [
  'CompletionStatus',
  'AppointmentStatus',
  'PaymentStatus',
];

function main(): void {
  if (!fs.existsSync(PRISMA_TYPES_SOURCE)) {
    console.error(
      `Prisma client tip dosyası bulunamadı: ${PRISMA_TYPES_SOURCE}`,
    );
    console.error(
      'Önce "cd apps/api && pnpm prisma generate" çalıştırın.',
    );
    process.exit(1);
  }

  const modelExports = MODEL_NAMES.map(
    (name) => `export type { ${name} } from 'prisma-client';`,
  );

  const enumExports = ENUM_NAMES.map(
    (name) => `export { ${name} } from 'prisma-client';`,
  );

  const content = [
    '// Bu dosya generate:types script\'i tarafından otomatik oluşturulur.',
    '// Elle düzenlemeyin — değişiklikler bir sonraki "generate:types" çalıştırmasında üzerine yazılır.',
    '// Kaynak: apps/api/node_modules/.prisma/client/index.d.ts',
    '',
    '// Model tipleri',
    ...modelExports,
    '',
    '// Enum tipleri',
    ...enumExports,
    '',
  ].join('\n');

  fs.writeFileSync(OUTPUT_FILE, content, 'utf-8');
  console.log(`✓ ${OUTPUT_FILE} güncellendi (${MODEL_NAMES.length} model, ${ENUM_NAMES.length} enum)`);
}

main();
