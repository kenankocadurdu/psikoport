# Psikoport

Psikologlar için SaaS danışmanlık yönetim yazılımı. Danışan CRM, psikometrik test motoru, takvim/randevu yönetimi, client-side şifreli seans notları, gelir takibi ve KVKK uyumlu altyapıyı tek platformda birleştirir.

**Kapsam:** Psikologlar için danışmanlık yönetimi.
**Kapsam Dışı:** Marketplace, tele-sağlık platformu, video görüşme altyapısı.

---

## Özellikler

- **Çok kiracılı mimari** — her psikolog izole bir tenant olarak çalışır
- **Şifreli seans notları** — istemci tarafı şifreleme (CSE) ile notlar sunucuda okunamaz
- **Psikometrik testler** — PHQ-9, GAD-7, DASS-21, WHO-5, PSS-10, PCL-5 entegrasyonu ve otomatik skorlama
- **Randevu yönetimi** — takvim görünümü, online/yüz yüze seans desteği
- **Danışan formu** — özelleştirilebilir intake ve ek form desteği
- **Ödeme takibi** — seans bazlı ödeme kaydı
- **2FA zorunluluğu** — TOTP ile iki aşamalı doğrulama
- **KVKK uyumu** — açık rıza metni ve onay takibi
- **Denetim günlüğü** — tüm işlemler WORM log ile kayıt altına alınır

---

## Teknoloji Yığını

| Katman | Teknoloji | Versiyon |
|--------|-----------|----------|
| Frontend | Next.js (App Router) | 15.x, React 19 |
| UI | Tailwind CSS 4, Shadcn/ui, Radix | — |
| State | Zustand, TanStack Query | — |
| Backend | NestJS | 11.x |
| ORM | Prisma | 5.x |
| Auth | Auth0 (OAuth 2.0, OIDC, TOTP 2FA) | — |
| Veritabanı | PostgreSQL | 16.x |
| Cache / Queue | Redis 7, BullMQ | — |
| Şifreleme | WebCrypto, AES-256-GCM | CSE |
| E-posta | SendGrid | — |
| Depolama | AWS S3 / MinIO | — |
| Monorepo | Turborepo, pnpm workspaces | — |

---

## Proje Yapısı

```
psikoport/
├── apps/
│   ├── api/                    # NestJS backend (port 3001)
│   │   ├── prisma/             # Schema, migrations, seed
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── database/       # PrismaModule
│   │       ├── modules/        # Feature modüller
│   │       ├── queue/          # BullMQ processors
│   │       └── common/         # Guards, pipes, filters, decorators
│   └── frontend/               # Next.js frontend (port 3000)
│       ├── app/
│       │   ├── (auth)/         # Login, 2FA
│       │   ├── (dashboard)/    # Ana uygulama
│       │   ├── (forms)/        # Token ile form doldurma
│       │   └── (public)/       # Public sayfalar
│       ├── components/
│       └── lib/                # API client, utils, crypto
├── shared/
│   ├── packages/
│   │   ├── shared/             # Ortak tipler ve sabitler (@psikoport/shared)
│   │   ├── form-schemas/       # JSON form tanımları (@psikoport/form-schemas)
│   │   └── scoring-engine/     # Psikometrik puanlama (@psikoport/scoring-engine)
│   └── scripts/                # Yardımcı araçlar
└── infra/
    ├── docker-compose.yml      # Tüm servisler
    ├── Dockerfile.api          # NestJS Docker imajı
    └── Dockerfile.frontend     # Next.js Docker imajı
```

---

## Hızlı Başlangıç

### Gereksinimler

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)
- Docker & Docker Compose

### Kurulum (İlk Kez)

```bash
# 1. Repoyu klonla
git clone <repo-url>
cd psikoport

# 2. Bağımlılıkları yükle
pnpm install

# 3. Ortam değişkenlerini ayarla
cp .env.example .env
# .env dosyasını düzenle — Auth0 ve diğer credential'ları gir (aşağıdaki Auth0 Kurulumu bölümüne bak)

# 4. Altyapı servislerini başlat (PostgreSQL + Redis + MinIO)
pnpm docker:infra

# 5. Veritabanı migrasyonlarını çalıştır
pnpm db:migrate

# 6. Demo veri yükle (isteğe bağlı)
cd apps/api && pnpm db:seed && cd ../..

# 7. Geliştirme sunucularını başlat
pnpm dev
```

Uygulama adresleri:
- **Frontend:** http://localhost:3000
- **API:** http://localhost:3001
- **Swagger:** http://localhost:3001/api/docs
- **MinIO Console:** http://localhost:9001 (kullanıcı: `psikoport`, şifre: `psikoport`)

### Docker ile Tam Yığın

```bash
pnpm docker:build   # Derle ve başlat
pnpm docker:up      # Başlat (önceden build edilmişse)
pnpm docker:down    # Durdur
pnpm docker:fresh   # Volume'ları silerek sıfırla
```

---

## Geliştirme Komutları

```bash
pnpm dev              # Tüm servisleri geliştirme modunda başlat (turbo)
pnpm build            # Tüm paketi derle
pnpm lint             # ESLint kontrolü
pnpm typecheck        # TypeScript tip kontrolü
pnpm test             # Tüm testleri çalıştır
pnpm db:migrate       # Veritabanı migrasyonu (Prisma)
pnpm docker:infra     # Sadece postgres + redis + minio (geliştirme altyapısı)
pnpm create-import-template  # Danışan import Excel şablonu oluştur
```

Servis bazlı geliştirme:
```bash
# Sadece API
cd apps/api && pnpm start:dev

# Sadece Frontend
cd apps/frontend && pnpm dev

# Seed veri
cd apps/api && pnpm db:seed
```

---

## Auth0 Kurulumu

**SDK:** `@auth0/nextjs-auth0` v3 — Route Handler (Node.js) kullanır.

### Giriş Akışı

1. Kullanıcı `/login` → Auth0 Universal Login → callback → session cookie
2. `returnTo` → `/auth/sync-token`
3. Sync sayfası `/api/auth/access-token` ile token alır, `localStorage`'a yazar
4. `POST /auth/login-callback` → AMR claim kontrol → `is2faEnabled` DB'ye yazılır
5. `GET /api/auth/me` → 2FA durumu → dashboard veya `/setup-2fa`
6. Dashboard API çağrılarında `Authorization: Bearer <token>` kullanılır

### 2FA Akışı

```
1. Kullanıcı kayıt olur (POST /auth/register)
   → Backend Auth0'da user oluşturur
   → app_metadata: { tenant_id, role } yazılır
   → Auth0 Action bu metadata'yı JWT'ye ekler

2. Kullanıcı login olur → Auth0 Universal Login
   → MFA policy "Always" ise: QR kodu gösterilir
   → Kullanıcı Google Authenticator ile tarar
   → Token'da amr: ["mfa", "otp"] claim'i eklenir

3. Callback → /auth/sync-token
   → POST /auth/login-callback → hasMfa=true → is2faEnabled=true
   → Dashboard'a yönlendirilir
```

### Auth0 Dashboard Kurulum Sırası

**1. Application (Regular Web Application)**

1. Auth0 Dashboard → Applications → Create Application → Regular Web Application
2. Settings sekmesinde:
   - **Allowed Callback URLs:** `http://localhost:3000/api/auth/callback`
   - **Allowed Logout URLs:** `http://localhost:3000`
   - **Allowed Web Origins:** `http://localhost:3000`
3. Domain, Client ID, Client Secret değerlerini `.env`'e al

**2. API (Access token audience — zorunlu)**

1. Applications → APIs → + Create API
2. **Identifier:** `http://localhost:3001`, **Signing Algorithm:** RS256
3. `.env` içinde `AUTH0_AUDIENCE=http://localhost:3001` olmalı

**3. Auth0 Action — tenant_id JWT'ye ekleme (ZORUNLU)**

Bu Action olmadan tüm API istekleri **401 "Token missing tenant_id claim"** hatası döner.

Actions → Library → + Create Action → Build from scratch
- Name: `Add tenant_id to tokens`
- Trigger: **Login / Post Login**

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const tenantId = event.user.app_metadata?.tenant_id;
  const role = event.user.app_metadata?.role;

  if (tenantId) {
    api.accessToken.setCustomClaim('tenant_id', tenantId);
    api.idToken.setCustomClaim('tenant_id', tenantId);
  }
  if (role) {
    api.accessToken.setCustomClaim('role', role);
    api.idToken.setCustomClaim('role', role);
  }

  const methods = event.authentication?.methods ?? [];
  if (methods.length > 0) {
    api.accessToken.setCustomClaim('amr', methods.map(function(m) { return m.name; }));
  }
};
```

Deploy et → Flows → Login → Action'ı flow'a sürükle → Apply.

> **Not:** Action deploy edilmeden flow'a eklenmiş olsa bile çalışmaz. Önce Deploy, sonra Flow'a ekle.

**4. M2M Application (Kayıt için — zorunlu)**

1. Applications → + Create Application → Machine to Machine Applications
2. Auth0 Management API'yi seç, şu izinleri işaretle:
   - `create:users`, `update:users`, `read:users`, `read:user_enrollments`
3. `.env` → `AUTH0_M2M_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`

**5. 2FA / MFA (TOTP)**

Auth0 Dashboard → Security → Multi-factor Auth → One-time Password → Enable
Policy: **Always** → Save

### Gerekli Ortam Değişkenleri

```env
# Web (Frontend)
AUTH0_DOMAIN=your-tenant.eu.auth0.com
AUTH0_BASE_URL=http://localhost:3000
APP_BASE_URL=http://localhost:3000
AUTH0_CLIENT_ID=<Regular Web App Client ID>
AUTH0_CLIENT_SECRET=<Regular Web App Client Secret>
AUTH0_AUDIENCE=http://localhost:3001
AUTH0_SECRET=<openssl rand -hex 32>

# API (Backend)
DATABASE_URL=postgresql://psikoport:psikoport@localhost:5432/psikoport
REDIS_URL=redis://localhost:6379
AUTH0_M2M_CLIENT_ID=<M2M App Client ID>
AUTH0_M2M_CLIENT_SECRET=<M2M App Client Secret>
SENDGRID_API_KEY=<sendgrid key>
S3_ACCESS_KEY=<s3 key>
S3_SECRET_KEY=<s3 secret>
S3_BUCKET=<bucket name>
FORM_TOKEN_SECRET=<openssl rand -hex 32>
CALENDAR_TOKEN_ENCRYPTION_KEY=<openssl rand -base64 32>
```

### Auth0 Sorun Giderme

| Hata | Çözüm |
|------|-------|
| "Token missing tenant_id claim" (401) | Auth0 Action deploy edilmemiş. Dashboard → Actions → Library → Deploy → Flow'a ekle |
| "Service not found: http://localhost:3001" | AUTH0_AUDIENCE ile eşleşen API yok. Dashboard → APIs → Create API (Identifier: `http://localhost:3001`) |
| "Auth0 Management API not configured" | AUTH0_M2M_CLIENT_ID veya AUTH0_M2M_CLIENT_SECRET eksik |
| QR kodu çıkmıyor | MFA policy "Never". Dashboard → Security → Multi-factor Auth → Policy: Always |
| is2faEnabled hep false | POST /auth/login-callback başarısız. API ayakta mı? AUTH0_AUDIENCE uyumlu mu? |
| Dashboard'a girince 401 | CORS — allowedHeaders içinde Authorization olmalı. localStorage.access_token yazılmış mı? |
| "The state parameter is missing" | Tarayıcıda `http://localhost:3000` (127.0.0.1 değil). Allowed Callback URL ekli mi? |

---

## Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                      psikoport (root)                        │
│   pnpm workspaces | Turborepo | Node ≥20                     │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│ apps/frontend│     │   apps/api   │     │ shared/packages/ │
│  Next.js 15  │────▶│  NestJS 11   │     │   shared         │
│  Port 3000   │     │  Port 3001   │◀────│   form-schemas   │
└──────────────┘     └──────────────┘     │   scoring-engine │
         │                    │           └──────────────────┘
         ▼                    ▼
┌──────────────┐     ┌──────────────┐
│    Auth0     │     │  PostgreSQL  │
│  (JWT, OIDC) │     │    Redis     │
└──────────────┘     └──────────────┘
```

### Veri Akışı

1. **Kullanıcı → Web:** Auth0 ile giriş, token alır.
2. **Web → API:** `Authorization: Bearer <token>` ile istek.
3. **API:** JWT doğrulanır, `user` ve `tenantId` set edilir.
4. **PostgreSQL:** RLS ile `app.current_tenant` kullanılır; sadece ilgili tenant verisi döner.
5. **Queue:** E-posta, SMS, puanlama vb. asenkron işler Redis üzerinden BullMQ ile çalışır.

### Global Guard Zinciri (API)

| Sağlayıcı | Amaç |
|-----------|------|
| ThrottlerGuard | Rate limiting (600 istek/60s) |
| JwtAuthGuard | JWT doğrulama (Auth0 RS256) |
| TwoFactorGuard | 2FA zorunluluğu kontrolü |
| RolesGuard | Rol tabanlı erişim (psychologist, assistant, super_admin) |
| HttpExceptionFilter | Hata yanıt standardizasyonu |
| ValidationPipe | class-validator ile DTO doğrulama |
| AuditLogInterceptor | Hassas erişim kaydı |

### AppModule Bağımlılıkları

```
AppModule
├── ConfigModule (global)
├── PrismaModule
├── BullModule (Redis)
├── ThrottlerModule
├── AuthModule
├── StorageModule (S3)
├── NotificationModule (SendGrid, SMS)
├── ClientsModule
│   ├── NotesModule
│   ├── TimelineModule
│   ├── FilesModule
│   └── ExportModule
├── LegalModule (Consent, AuditLog)
├── TestsModule (FormDefinitions, FormSubmissions)
├── CalendarModule (Appointments, Availability, Integrations)
├── FinanceModule
├── ProfileModule
├── CrisisModule
├── AdminModule
├── BlogModule
└── QueueModule (BullMQ processors)
```

---

## Veritabanı

**Provider:** PostgreSQL 16
**Konfigürasyon:** `apps/api/prisma/schema.prisma`

### Modeller

| Grup | Model | Açıklama |
|------|-------|----------|
| Auth & Tenancy | **Tenant** | Çok kiracılı kuruluş; plan, maxClients, videoProvider |
| | **User** | Auth0 bağlantılı kullanıcı; rol, 2FA, lisans |
| | **Invitation** | Asistan davet token'ları |
| Profil | **PsychologistProfile** | Psikolog public profil; bio, SEO alanları |
| | **BlogPost** | Tenant blog yazıları |
| Legal | **ConsentText** | KVKK metin versiyonları |
| | **Consent** | Verilen rızalar |
| CRM | **Client** | Danışan kaydı; soft delete, anonymize desteği |
| | **ConsultationNote** | CSE şifreli seans notları |
| | **ClientFile** | S3 dosya metadata |
| Test & Form | **FormDefinition** | Form şeması, scoringConfig |
| | **FormSubmission** | Form yanıtları, skorlar, risk_flags |
| Takvim | **Appointment** | Randevu; video linkleri, durum |
| | **AvailabilitySlot** | Haftalık müsaitlik |
| | **CalendarIntegration** | Google/Outlook OAuth token'ları |
| | **ExternalCalendarEvent** | Senkronize edilen etkinlikler |
| | **VideoIntegration** | Zoom/Meet token'ları |
| Finans | **SessionPayment** | Randevu bazlı ödeme |
| | **PaymentSettings** | Psikolog bazlı ücret ayarları |
| Audit | **AuditLog** | Erişim ve işlem kayıtları (WORM) |

### Önemli Enum'lar

| Enum | Değerler |
|------|----------|
| TenantPlan | FREE, PRO, ENTERPRISE |
| VideoProvider | NONE, ZOOM, GOOGLE_MEET |
| AppointmentStatus | SCHEDULED, COMPLETED, CANCELLED, NO_SHOW |
| UserRole | SUPER_ADMIN, PSYCHOLOGIST, ASSISTANT |
| FormType | INTAKE, INTAKE_ADDON, PSYCHOMETRIC, CUSTOM |

### Row-Level Security (RLS)

- Her tablo `tenant_id` içerir
- Her API isteğinde `SET app.current_tenant = '<tenant_id>'` uygulanır

---

## REST API

**Base URL:** `http://localhost:3001`
**Swagger UI:** `http://localhost:3001/api/docs`

| Grup | Endpoint |
|------|----------|
| Auth | `/auth/*` — register, login-callback, invite, me, license |
| Danışan | `/clients` — CRUD, toplu import |
| Notlar | `/clients/:clientId/notes` — CRUD (şifreli) |
| Timeline | `/clients/:clientId/timeline` |
| Dosyalar | `/clients/:clientId/files/upload-url` |
| Form Tanımları | `/form-definitions` |
| Form Gönderimi | `/form-submissions`, `/clients/:clientId/form-submissions` |
| Public Form | `/forms/public/:token` |
| Randevular | `/appointments`, `/appointments/calendar` |
| Müsaitlik | `/psychologists/availability` |
| Takvim Entegrasyon | `/calendar-integrations/auth-url`, `/callback` |
| Video Entegrasyon | `/video-integrations/auth-url`, `/callback` |
| Finans | `/finance/payments`, `/finance/summary`, `/finance/payment-settings` |
| Profil | `/profile` |
| Kriz | `/crisis/alerts` |
| Admin | `/admin/licenses` |
| Blog | `/blog` |
| Rızalar | `/consents/*` |
| Denetim | `/legal/audit-logs` |

---

## Frontend

### Stack

| Kütüphane | Kullanım |
|-----------|----------|
| Next.js 15 | App Router, Turbopack |
| React 19 | UI |
| Auth0 | `@auth0/nextjs-auth0` v3 |
| TanStack Query | Server state |
| Zustand | İstemci state |
| Tailwind CSS 4 | Stil |
| Radix UI / Shadcn | UI bileşenleri |
| react-hook-form, Zod | Form yönetimi |
| TipTap | Zengin metin editörü |

### Dizin Yapısı

```
apps/frontend/
├── app/
│   ├── (auth)/                 # Giriş, 2FA
│   ├── (dashboard)/            # Ana uygulama
│   │   ├── clients/            # Danışan CRM
│   │   ├── calendar/           # Takvim
│   │   ├── tests/              # Test motoru
│   │   ├── notes/              # Seans notları
│   │   ├── finance/            # Gelir
│   │   ├── profile/            # Profil
│   │   └── settings/           # Ayarlar
│   ├── (forms)/[formToken]/    # Token ile form doldurma
│   └── (public)/p/[slug]/      # Psikolog public profil
├── components/
│   ├── ui/                     # Shadcn primitives
│   ├── calendar/               # Takvim bileşenleri
│   ├── finance/                # Gelir grafikleri
│   ├── forms/                  # Form alanları, wizard
│   ├── layout/                 # Sidebar, header
│   ├── notes/                  # Not diyalogları
│   ├── onboarding/             # Onboarding wizard
│   └── tests/                  # Test gönderme, görüntüleme
└── lib/
    ├── api/                    # API client + endpoint fonksiyonları
    ├── crypto/                 # CSE yardımcıları
    └── utils.ts
```

### Önemli Sayfalar

| Route | Açıklama |
|-------|----------|
| `/` | Ana ekran: bugünün randevuları, kriz uyarıları |
| `/clients` | Danışan listesi |
| `/clients/new` | Yeni danışan |
| `/clients/import` | CSV/Excel toplu içe aktarım |
| `/clients/[id]` | Danışan detay (genel, testler, notlar, dosyalar) |
| `/calendar` | Takvim (gün/hafta/ay) |
| `/notes` | Seans notları listesi |
| `/finance` | Gelir takibi |
| `/profile` | Psikolog profil |
| `/settings/integrations` | Zoom, Meet, takvim entegrasyonları |

---

## NestJS Modülleri

| Modül | Amaç |
|-------|------|
| AuthModule | Kayıt, giriş callback, davet, lisans |
| StorageModule | S3 presigned URL |
| NotificationModule | E-posta, SMS |
| ClientsModule | Danışan CRUD, toplu import |
| NotesModule | CSE seans notları |
| TimelineModule | Danışan zaman çizelgesi |
| FilesModule | Danışan dosya yükleme |
| ExportModule | Danışan dışa aktarma |
| LegalModule | KVKK rızaları, audit log |
| TestsModule | Form tanımları, gönderimler |
| CalendarModule | Randevular, entegrasyonlar |
| FinanceModule | Ödemeler, özet |
| ProfileModule | Psikolog profil |
| CrisisModule | Kriz protokolü |
| AdminModule | Lisans yönetimi |
| BlogModule | Blog yazıları |
| QueueModule | BullMQ kuyrukları |

**Ana Servisler:** AuthService, ClientsService, NotesService, FormSubmissionsService, AppointmentsService, PaymentsService, ConsentService, AuditLogService

---

## Shared Paketler

### @psikoport/shared — `shared/packages/shared/`

- **Tipler:** auth, client, note, appointment, payment, form, common
- **Sabitler:** terminology, symptom-categories, plans, test-catalog

### @psikoport/form-schemas — `shared/packages/form-schemas/`

- **Intake:** general, depression, anxiety-panic, trauma-ptsd
- **Testler:** phq9, gad7, dass21, who5, pss10, pcl5
- Seed sırasında FormDefinition olarak DB'ye yüklenir

### @psikoport/scoring-engine — `shared/packages/scoring-engine/`

- Psikometrik puanlama (SumCalculator, SubscaleCalculator)
- API scoring queue processor tarafından kullanılır

---

## BullMQ Kuyrukları

| Kuyruk | İşlemci | Açıklama |
|--------|---------|----------|
| scoring | ScoringProcessor | Form yanıtlarını puanlar, DB günceller |
| crisis-alert | CrisisAlertProcessor | Risk uyarılarını işler |
| appointment-notification | AppointmentNotificationProcessor | Randevu bildirimi gönderir |
| appointment-reminder-run | AppointmentReminderProcessor + Scheduler | Cron ile hatırlatma |
| sms | SmsProcessor | SMS gönderimi |
| email | EmailProcessor | E-posta gönderimi |
| payment-reminder-run | PaymentReminderProcessor + Scheduler | Cron ile ödeme hatırlatma |
| calendar-sync | CalendarSyncProcessor | Google/Outlook takvim senkronu |

---

## Altyapı & Docker

**Compose dosyası:** `infra/docker-compose.yml`

| Servis | Port | Açıklama |
|--------|------|----------|
| postgres | 5432 | PostgreSQL 16 |
| redis | 6379 | BullMQ / Cache |
| minio | 9000 | Dosya depolama (S3-uyumlu) |
| minio-init | — | Bucket oluşturma (one-shot) |
| minio console | 9001 | MinIO yönetim arayüzü |
| api | 3001 | NestJS |
| web | 3000 | Next.js |

```bash
pnpm docker:infra   # Sadece postgres + redis + minio (geliştirme)
pnpm docker:up      # Tam yığın başlat
pnpm docker:down    # Durdur
pnpm docker:build   # Yeniden build + başlat
pnpm docker:fresh   # Volume'ları silerek sıfırla
```

MinIO yönetim arayüzü: `http://localhost:9001` (kullanıcı: `psikoport`, şifre: `psikoport`)

---

## Güvenlik & Kurallar

- **CSE:** Seans notları tarayıcıda AES-256-GCM ile şifrelenir; sunucu düz metin **asla** görmez
- **KEK:** Sunucuya gönderilmez; `localStorage`, `sessionStorage`, `IndexedDB`'ye yazılmaz
- **RLS:** Her tablo `tenant_id` içerir; her API isteğinde `SET app.current_tenant` çalışır
- **JWT:** Tüm API istekleri Auth0 RS256 JWT ile doğrulanır
- **2FA:** TOTP Auth0 MFA ile zorunlu hale getirilir
- **Rate limiting:** Global 600 istek/60s
- **Audit log:** Tüm yönetimsel işlemler WORM log ile kayıt altına alınır

**Terminoloji (Yasal):**
- Yasaklı: tedavi, terapi, klinik, tele-sağlık, HIPAA
- Onaylı: danışmanlık, değerlendirme, seans, danışan

---

## Lisans

Tescilli yazılım — tüm hakları saklıdır.
