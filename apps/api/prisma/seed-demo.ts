/**
 * Demo verisi seed scripti — gerçekçi demo ortamı oluşturur.
 *
 * Kullanım:
 *   cd apps/api
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-demo.ts
 *
 * Var olan demo verisini sil ve yeniden oluştur:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-demo.ts --clean
 *
 * Docker'da otomatik: SEED_DEMO=true ortam değişkeni ile başlatıldığında çalışır.
 *
 * Demo giriş bilgileri:
 *   psk1@example.com / Sifrem.123  (Psikolog)
 *   psk2@example.com / Sifrem.123  (Psikolog)
 *   psk3@example.com / Sifrem.123  (Psikolog)
 *   pdr1@example.com / Sifrem.123  (PDR Uzmanı)
 *   pdr2@example.com / Sifrem.123  (PDR Uzmanı)
 *
 * Gereksinimler:
 *   - DATABASE_URL: .env veya ortam değişkeni
 *   - ENCRYPTION_KEY: PII şifrelemesi için (yoksa sabit demo key kullanılır)
 */
import * as crypto from 'crypto';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as argon2 from 'argon2';
import { PrismaClient } from 'prisma-client';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();
const DEMO_SLUG = 'demo-klinik';
const CLEAN = process.argv.includes('--clean');

// ─── Encryption (mirrors EncryptionService) ───────────────────────────────────
// Fallback: 32-byte zero key — only used if ENCRYPTION_KEY is not set
const rawKey =
  process.env.ENCRYPTION_KEY ??
  '0000000000000000000000000000000000000000000000000000000000000001';
const KEK: Buffer =
  rawKey.length === 64
    ? Buffer.from(rawKey, 'hex')
    : Buffer.from(rawKey, 'base64');

function deriveDek(tenantId: string): Buffer {
  return Buffer.from(
    crypto.hkdfSync('sha256', KEK, Buffer.alloc(0), Buffer.from(tenantId), 32),
  );
}

function encryptNote(
  dek: Buffer,
  plaintext: string,
): { encryptedContent: Buffer; contentNonce: Buffer; contentAuthTag: Buffer } {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, nonce, {
    authTagLength: 16,
  });
  const encryptedContent = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ]);
  return { encryptedContent, contentNonce: nonce, contentAuthTag: cipher.getAuthTag() };
}

/** base64(nonce || authTag || ciphertext) — same format as ClientsService.enc() */
function encryptPii(dek: Buffer, plaintext: string): string {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, nonce, {
    authTagLength: 16,
  });
  const ct = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ct]).toString('base64');
}

// ─── Deterministic pseudo-random ────────────────────────────────────────────
function pseudo(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function randInt(seed: number, min: number, max: number): number {
  return min + Math.floor(pseudo(seed) * (max - min + 1));
}
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.floor(pseudo(seed) * arr.length)]!;
}

// ─── Demo data definitions ──────────────────────────────────────────────────
const DEMO_PASSWORD = 'Sifrem.123';

const EXPERTS = [
  {
    auth0Sub: 'local|psk1@example.com',
    fullName: 'Uzman Bir',
    email: 'psk1@example.com',
    type: 'Psikolog',
    specializations: ['Klinik Psikoloji', 'Bilişsel Davranışçı Terapi'],
    bio: 'Bireysel ve grup danışmanlığı alanında 8 yıllık deneyime sahip klinik psikolog. BDT ve şema terapi yaklaşımlarını kullanmaktadır.',
    clientCount: 8,
    sessionFee: 800,
  },
  {
    auth0Sub: 'local|psk2@example.com',
    fullName: 'Uzman İki',
    email: 'psk2@example.com',
    type: 'Psikolog',
    specializations: ['Çift Danışmanlığı', 'Aile Terapisi', 'İlişki Sorunları'],
    bio: 'Çift ve aile danışmanlığı uzmanı. İlişki sorunları, iletişim güçlükleri ve bağlanma örüntüleri üzerine çalışmaktadır.',
    clientCount: 14,
    sessionFee: 900,
  },
  {
    auth0Sub: 'local|psk3@example.com',
    fullName: 'Uzman Üç',
    email: 'psk3@example.com',
    type: 'Psikolog',
    specializations: ['Travma ve TSSB', 'EMDR', 'Kaygı Bozuklukları'],
    bio: 'Travma ve TSSB alanında uzmanlaşmış, EMDR sertifikası sahibi psikolog. Kaygı bozuklukları ve fobiler üzerine çalışmaktadır.',
    clientCount: 6,
    sessionFee: 1000,
  },
  {
    auth0Sub: 'local|pdr1@example.com',
    fullName: 'Uzman Dört',
    email: 'pdr1@example.com',
    type: 'PDR Uzmanı',
    specializations: [
      'PDR',
      'Okul Psikolojik Danışmanlığı',
      'Kariyer Danışmanlığı',
    ],
    bio: 'Okul ortamında kariyer ve kişisel gelişim odaklı psikolojik danışman. Lise ve üniversite öğrencileriyle çalışmaktadır.',
    clientCount: 18,
    sessionFee: 600,
  },
  {
    auth0Sub: 'local|pdr2@example.com',
    fullName: 'Uzman Beş',
    email: 'pdr2@example.com',
    type: 'PDR Uzmanı',
    specializations: ['PDR', 'Ergen Danışmanlığı', 'Sınav Kaygısı'],
    bio: 'Ergen danışmanlığı ve sınav kaygısı yönetimi alanında uzman PDR. Ergenlik dönemindeki kimlik gelişimi ve aile ilişkileriyle çalışmaktadır.',
    clientCount: 11,
    sessionFee: 550,
  },
] as const;

const SESSION_TYPES = ['Bireysel', 'Online', 'Yüz yüze', 'Grup', 'Online'];
const COMPLAINT_AREAS = [
  'Kaygı',
  'Depresyon',
  'İlişki sorunları',
  'İş stresi',
  'Yas',
  'Öfke yönetimi',
  'Özgüven',
  'Travma',
  'Sınav kaygısı',
  'Aile çatışması',
];
const NOTE_TAGS = [
  'takip gerektiriyor',
  'ilerleme iyi',
  'aile desteği',
  'ilaç değerlendirmesi',
  'kriz riski yok',
  'ödev tamamlandı',
];
const PAYMENT_METHODS = ['Nakit', 'Banka transferi', 'Kredi kartı'];

const NOTE_POOL = [
  'Danışan bu hafta yaşadığı stres kaynaklarını paylaştı. İş ortamındaki çatışma belirgin şekilde artmış durumda. Nefes egzersizleri ve duygu kaydı tutması önerildi. Bir sonraki seansta ev ödevi değerlendirilecek.',
  'Geçen haftaki ev ödevleri değerlendirildi. Danışan otomatik düşünce günlüğünü düzenli tutmuş. BDT çerçevesinde bilişsel yeniden yapılandırma üzerine çalışıldı. Günlük tutma alışkanlığını sürdürmesi istendi.',
  'Danışan uyku problemlerinin devam ettiğini belirtti. Uyku hijyeni protokolü gözden geçirildi ve gevşeme teknikleri pratik edildi. Psikiyatri konsültasyonu değerlendirilecek; referans için bilgi verildi.',
  'Aile ilişkileri bağlamında sınır koyma üzerine konuşuldu. Danışan annesiyle yaşanan çatışmayı aktardı. Rol yapma egzersizi yapıldı. Bir sonraki seansta aile dinamiklerine devam edilecek.',
  'Danışan öfke kontrolü konusunu gündeme taşıdı. Tetikleyiciler belirlendi ve ABC modeli üzerinden analiz yapıldı. Duygu düzenleme stratejileri paylaşıldı. Kızgınlık günlüğü tutması istendi.',
  'İlerleme değerlendirmesi yapıldı. 3 ay öncesiyle kıyaslandığında sosyal işlevsellikte belirgin artış gözlemlendi. Hedefler yeniden gözden geçirildi ve yeni dönem için öncelikler belirlendi.',
  'Danışan iş yerinde yaşadığı zorbalık deneyimini ilk kez paylaştı. Güçlü duygusal tepki gözlemlendi. Güvenli bir keşif ortamı oluşturuldu; bir sonraki seans da bu konuya ayrılacak.',
  'Kaygı belirtilerinde azalma gözlemleniyor. Danışan sosyal ortamlarda daha rahat hissetmeye başladığını ifade etti. Kaygı hiyerarşisindeki sıradaki basamak planlandı.',
  'Danışan ilişkisindeki iletişim sorunlarını aktardı. Aktif dinleme ve "ben dili" kullanımı üzerine psikoeğitim verildi. Çift seansına yönlendirme düşünülüyor.',
  'Yas süreci üzerine odaklanıldı. Danışan kaybının yıl dönümünde zorlandığını belirtti. Anlam bulma ve anma ritüelleri üzerine konuşuldu. Sosyal destek ağı güçlendirilmesi hedeflendi.',
  'Danışan belirgin enerji düşüklüğü ve motivasyon kaybı bildiriyor. Aktivite planlaması ve davranışsal aktivasyon egzersizleri başlatıldı. PHQ-9 skoru bir önceki seanstan 3 puan düşmüş.',
  'Özgüven ve öz-yeterlik algısı üzerine çalışıldı. Güçlü yönleri belirleme egzersizi yapıldı. Olumlu öz-değerlendirme pratiği için ev ödevi verildi. Sonuçlar gelecek seansta paylaşılacak.',
  'Sınav kaygısı detaylı değerlendirildi. Bilişsel yeniden çerçeveleme ve dikkat yönetimi teknikleri üzerinde duruldu. Sınav öncesi hazırlık stratejileri ve zaman yönetimi planlandı.',
  'Danışan sosyal izolasyonunun azaldığını bildirdi. Bu hafta iki sosyal etkinliğe katılmış, olumlu deneyimler yaşamış. Sosyal beceri gelişimi desteklenmeye devam edildi.',
  'Beden imajı ve yeme tutumu değerlendirildi. Danışan bedenine yönelik olumsuz düşüncelerin azaldığını aktardı. Mindful yeme egzersizlerine devam edilmesi istendi.',
  'Ergenlik dönemi kimlik gelişimi ve aile baskısı üzerine konuşuldu. Danışan kariyer kararlarında aile beklentileri ile kendi istekleri arasında sıkıştığını ifade etti. Değerler egzersizi yapıldı.',
  'Danışan panik ataklarının sıklığının azaldığını bildirdi. Nefes ve grounding teknikleri gözden geçirildi. İnteroceptive exposure egzersizleri programa eklendi.',
  'Çift seansı: İletişim örüntüleri değerlendirildi. Her iki tarafın dinleme güçlükleri belirlendi. Gottman yönteminden iletişim egzersizleri verildi. Haftalık bağlantı ritüeli planlandı.',
  'Travmatik deneyim üzerine çalışıldı. EMDR protokolü 4. oturumu tamamlandı. Danışan rahatsız edici anının yoğunluğunun azaldığını (SUDs: 7\'den 3\'e) belirtti. Sonraki hedef belirlendi.',
  'Kariyer belirsizliği üzerine konuşuldu. Meslek ilgi envanteri sonuçları değerlendirildi. Güçlü yanlar ve değerler listesi oluşturuldu. Bilgi görüşmeleri yapması için yönlendirme verildi.',
];

// Turkish ordinal names 1–57
const ORDINALS = [
  '',
  'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz', 'On',
  'On Bir', 'On İki', 'On Üç', 'On Dört', 'On Beş', 'On Altı', 'On Yedi', 'On Sekiz', 'On Dokuz', 'Yirmi',
  'Yirmi Bir', 'Yirmi İki', 'Yirmi Üç', 'Yirmi Dört', 'Yirmi Beş', 'Yirmi Altı', 'Yirmi Yedi', 'Yirmi Sekiz', 'Yirmi Dokuz', 'Otuz',
  'Otuz Bir', 'Otuz İki', 'Otuz Üç', 'Otuz Dört', 'Otuz Beş', 'Otuz Altı', 'Otuz Yedi', 'Otuz Sekiz', 'Otuz Dokuz', 'Kırk',
  'Kırk Bir', 'Kırk İki', 'Kırk Üç', 'Kırk Dört', 'Kırk Beş', 'Kırk Altı', 'Kırk Yedi', 'Kırk Sekiz', 'Kırk Dokuz', 'Elli',
  'Elli Bir', 'Elli İki', 'Elli Üç', 'Elli Dört', 'Elli Beş', 'Elli Altı', 'Elli Yedi',
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function cleanDemo(): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
  if (!tenant) {
    console.log('⚠  Demo tenant bulunamadı, temizlenecek bir şey yok.');
    return;
  }
  // Cascade delete handles all related records
  await prisma.tenant.delete({ where: { id: tenant.id } });
  // Also clean up orphan users created under this tenant
  await prisma.user.deleteMany({ where: { auth0Sub: { in: EXPERTS.map((e) => e.auth0Sub) } } });
  console.log('✓  Demo tenant ve tüm ilişkili veriler silindi.');
}

async function seedDemo(): Promise<void> {
  // Idempotency check
  const existing = await prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
  if (existing) {
    console.log(`⚠  Demo tenant zaten mevcut (id: ${existing.id}).`);
    console.log('   Yeniden oluşturmak için --clean ile çalıştırın.');
    return;
  }

  // ── Tenant ──────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Klinik',
      slug: DEMO_SLUG,
      plan: 'PRO',
      maxClients: 200,
      defaultSessionFee: 700,
      defaultCurrency: 'TRY',
      isActive: true,
    },
  });
  console.log(`✓  Demo tenant oluşturuldu: ${tenant.id}`);

  const dek = deriveDek(tenant.id);
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  // Fetch available forms (seeded by main seed)
  const phq9Form = await prisma.formDefinition.findUnique({ where: { code: 'phq9' } });
  const gad7Form = await prisma.formDefinition.findUnique({ where: { code: 'gad7' } });
  const who5Form = await prisma.formDefinition.findUnique({ where: { code: 'who5' } });
  const dass21Form = await prisma.formDefinition.findUnique({ where: { code: 'dass21' } });
  const availableForms = [phq9Form, gad7Form, who5Form, dass21Form].filter(Boolean);

  let clientSeq = 0;
  let totalNotes = 0;
  let totalAppts = 0;
  let totalTests = 0;

  for (let ei = 0; ei < EXPERTS.length; ei++) {
    const exp = EXPERTS[ei]!;
    const eseed = (ei + 1) * 10_000;

    // ── User ──────────────────────────────────────────────────────────────────
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        auth0Sub: exp.auth0Sub,
        email: exp.email,
        fullName: exp.fullName,
        role: 'PSYCHOLOGIST',
        passwordHash,
        isActive: true,
        licenseStatus: 'VERIFIED',
      },
    });

    await prisma.psychologistProfile.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        bio: exp.bio,
        specializations: [...exp.specializations],
        sessionTypes: ['Bireysel', 'Online'],
        sessionFee: exp.sessionFee,
        languages: ['Türkçe'],
      },
    });

    await prisma.paymentSettings.create({
      data: {
        tenantId: tenant.id,
        psychologistId: user.id,
        defaultSessionFee: exp.sessionFee,
        currency: 'TRY',
        supportedCurrencies: ['TRY'],
        reminderDays: 3,
      },
    });

    console.log(`\n  👤 ${exp.fullName} (${exp.type})`);

    // ── Clients ───────────────────────────────────────────────────────────────
    for (let ci = 0; ci < exp.clientCount; ci++) {
      clientSeq++;
      const cseed = eseed + ci * 100;

      const firstName = 'Danışan';
      const lastName = clientSeq <= ORDINALS.length - 1 ? ORDINALS[clientSeq]! : String(clientSeq);

      // Random demographics
      const birthYear = 1975 + randInt(cseed + 1, 0, 35);
      const gender = randInt(cseed + 2, 0, 1) === 0 ? 'Erkek' : 'Kadın';
      const maritalStatuses = ['Bekar', 'Evli', 'Boşanmış', 'Dul'];
      const educationLevels = ['Ortaokul', 'Lise', 'Ön Lisans', 'Lisans', 'Yüksek Lisans'];

      // Complaint areas (1-3 unique)
      const numComplaints = randInt(cseed + 3, 1, 3);
      const complaints = Array.from(
        new Set(Array.from({ length: numComplaints }, (_, k) => pick(COMPLAINT_AREAS, cseed + 30 + k))),
      );

      const client = await prisma.client.create({
        data: {
          tenantId: tenant.id,
          firstName,
          lastName,
          phone: encryptPii(dek, `0530${String(clientSeq).padStart(3, '0')}${randInt(cseed + 5, 1000, 9999)}`),
          email: encryptPii(dek, `danisan${clientSeq}@demo.psikoport.com`),
          birthDate: new Date(`${birthYear}-${String(randInt(cseed + 6, 1, 12)).padStart(2, '0')}-15`),
          gender,
          maritalStatus: pick(maritalStatuses, cseed + 7),
          educationLevel: pick(educationLevels, cseed + 8),
          complaintAreas: complaints,
          status: 'ACTIVE',
        },
      });

      // ── Session notes (1–20) ─────────────────────────────────────────────────
      const noteCount = randInt(cseed + 10, 1, 20);

      for (let ni = 0; ni < noteCount; ni++) {
        const nseed = cseed + ni * 7 + 300;
        // Sessions run weekly, most recent first
        const daysAgo = (noteCount - ni) * 7 - randInt(nseed, 0, 2);
        const sessionDate = new Date();
        sessionDate.setDate(sessionDate.getDate() - Math.max(daysAgo, 1));

        const noteText = pick(NOTE_POOL, nseed);
        const { encryptedContent, contentNonce, contentAuthTag } = encryptNote(dek, noteText);

        const numTags = randInt(nseed + 1, 0, 2);
        const tags = Array.from(
          new Set(Array.from({ length: numTags }, (_, k) => pick(NOTE_TAGS, nseed + 60 + k))),
        );

        await prisma.consultationNote.create({
          data: {
            tenantId: tenant.id,
            clientId: client.id,
            sessionDate,
            sessionNumber: ni + 1,
            sessionType: pick(SESSION_TYPES, nseed + 2),
            moodRating: randInt(nseed + 3, 3, 9),
            durationMinutes: pick([45, 50, 60, 90], nseed + 4),
            tags,
            symptomCategories: complaints.slice(0, 1),
            encryptedContent,
            contentNonce,
            contentAuthTag,
            // Server-side encryption sentinel (no DEK envelope)
            encryptedDek: Buffer.alloc(0),
            dekNonce: Buffer.alloc(0),
            dekAuthTag: Buffer.alloc(0),
          },
        });
        totalNotes++;
      }

      // ── Appointments (COMPLETED, matching note count) ─────────────────────
      const apptCount = Math.max(1, Math.min(noteCount, randInt(cseed + 20, 1, noteCount)));

      for (let ai = 0; ai < apptCount; ai++) {
        const aseed = cseed + ai * 9 + 500;
        const daysAgo = (apptCount - ai) * 7 - randInt(aseed, 0, 2);
        const startTime = new Date();
        startTime.setDate(startTime.getDate() - Math.max(daysAgo, 1));
        startTime.setHours(9 + randInt(aseed + 1, 0, 7), 0, 0, 0);
        startTime.setSeconds(0, 0);

        const durationMinutes = pick([50, 60, 90], aseed + 2);
        const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
        const locationType = randInt(aseed + 3, 0, 2) === 0 ? 'ONLINE' : 'IN_PERSON';

        const appt = await prisma.appointment.create({
          data: {
            tenantId: tenant.id,
            clientId: client.id,
            psychologistId: user.id,
            startTime,
            endTime,
            durationMinutes,
            status: 'COMPLETED',
            sessionType: pick(SESSION_TYPES, aseed + 4),
            locationType,
          },
        });
        totalAppts++;

        // ── Payment for appointment ─────────────────────────────────────────
        const fee = exp.sessionFee + randInt(aseed + 5, 0, 3) * 50;
        const isPaid = pseudo(aseed + 6) < 0.78; // 78% paid
        await prisma.sessionPayment.create({
          data: {
            tenantId: tenant.id,
            clientId: client.id,
            psychologistId: user.id,
            appointmentId: appt.id,
            sessionDate: startTime,
            amount: fee,
            currency: 'TRY',
            status: isPaid ? 'PAID' : 'PENDING',
            paidAmount: isPaid ? fee : 0,
            paidAt: isPaid ? endTime : null,
            paymentMethod: isPaid ? pick(PAYMENT_METHODS, aseed + 7) : null,
          },
        });
      }

      // ── Form submissions (~45% of clients) ──────────────────────────────────
      if (availableForms.length > 0 && pseudo(cseed + 700) < 0.45) {
        const testCount = randInt(cseed + 701, 1, Math.min(3, availableForms.length));

        for (let ti = 0; ti < testCount; ti++) {
          const form = pick(availableForms, cseed + 710 + ti);
          if (!form) continue;
          const tseed = cseed + ti * 11 + 800;

          const score = randInt(tseed, 4, 24);
          const severity =
            score < 5 ? 'minimal' :
            score < 10 ? 'mild' :
            score < 15 ? 'moderate' :
            score < 20 ? 'moderately-severe' : 'severe';

          const submittedDaysAgo = randInt(tseed + 1, 1, 60);

          await prisma.formSubmission.create({
            data: {
              tenantId: tenant.id,
              clientId: client.id,
              formDefinitionId: form.id,
              psychologistId: user.id,
              responses: {
                q1: randInt(tseed + 2, 0, 3),
                q2: randInt(tseed + 3, 0, 3),
                q3: randInt(tseed + 4, 0, 3),
                q4: randInt(tseed + 5, 0, 3),
                q5: randInt(tseed + 6, 0, 3),
              },
              scores: { total: score },
              severityLevel: severity,
              completionStatus: 'COMPLETE',
              submittedAt: new Date(Date.now() - submittedDaysAgo * 24 * 60 * 60 * 1000),
            },
          });
          totalTests++;
        }
      }
    }

    console.log(
      `     → ${exp.clientCount} danışan | ${totalNotes} not (kümülatif) | ${totalAppts} randevu (kümülatif)`,
    );
  }

  console.log('\n─────────────────────────────────────────────');
  console.log(`✅ Demo seed tamamlandı`);
  console.log(`   Tenant    : ${DEMO_SLUG} (${tenant.id})`);
  console.log(`   Uzmanlar  : ${EXPERTS.length} (3 psikolog + 2 PDR)`);
  console.log(`   Danışanlar: ${clientSeq}`);
  console.log(`   Notlar    : ${totalNotes}`);
  console.log(`   Randevular: ${totalAppts}`);
  console.log(`   Testler   : ${totalTests}`);
  console.log('\nDemo hesaplar (Auth0 ile giriş yapılabilir):');
  EXPERTS.forEach((e) =>
    console.log(`  ${e.type.padEnd(12)} ${e.fullName.padEnd(14)} ${e.email}`),
  );
}

async function main() {
  if (CLEAN) {
    console.log('🧹 Demo verisi temizleniyor...');
    await cleanDemo();
    console.log('');
  }
  await seedDemo();
}

main()
  .catch((e) => {
    console.error('❌ Demo seed hatası:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
