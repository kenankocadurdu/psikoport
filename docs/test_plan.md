# Backend Unit Test Plan

> **Kapsam:** Sadece business logic, hesaplamalar ve durum kontrolleri.
> **İzolasyon:** Tüm DB (TypeORM), S3, Redis, Stripe, Auth0, BullMQ ve e-posta çağrıları mock'lanacak.
> **Framework:** Jest + `@nestjs/testing` + `jest.fn()` / `jest.spyOn()`

---

## İçindekiler

1. [SubscriptionService](#1-subscriptionservice)
2. [AvailabilityService](#2-availabilityservice)
3. [AppointmentsService](#3-appointmentsservice)
4. [PaymentsService (Finance)](#4-paymentsservice-finance)
5. [ClientsService](#5-clientsservice)
6. [AuthService](#6-authservice)
7. [FormSubmissionsService](#7-formsubmissionsservice)
8. [ExportService (GDPR)](#8-exportservice-gdpr)
9. [ConsentService](#9-consentservice)
10. [NotesService](#10-notesservice)
11. [EncryptionService](#11-encryptionservice)
12. [LicensesService (Admin)](#12-licensesservice-admin)
13. [AdminService](#13-adminservice)
14. [CrisisService](#14-crisisservice)

---

## 1. SubscriptionService

**Dosya:** `apps/api/src/modules/subscriptions/subscription.service.ts`
**Mock'lanacaklar:** `TenantSubscriptionRepository`, `MonthlySessionBudgetRepository`, `PlanConfigRepository`, `TenantRepository`

### 1.1 `getCurrentPlanConfig()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 1 | `should return plan config from DB when it exists` | Repository bir kayıt döner | Dönen config objesi DB'den gelenle eşleşir |
| 2 | `should return hardcoded FREE defaults when no DB config found` | Repository `null` döner, plan=FREE | maxSessions=25 olan default config döner |
| 3 | `should return hardcoded PRO defaults when no DB config found` | Repository `null` döner, plan=PRO | maxSessions=250 olan default config döner |
| 4 | `should return hardcoded PROPLUS defaults when no DB config found` | Repository `null` döner, plan=PROPLUS | maxSessions=500 olan default config döner |

### 1.2 `upgradePlan()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 5 | `should close old subscription by setting endDate to now` | Mevcut aktif abonelik var | Eski aboneliğin `endDate` alanı set edilir |
| 6 | `should create a new subscription snapshot for the new plan` | Geçerli upgrade senaryosu | Yeni plan ile `TenantSubscription` kaydı oluşturulur |
| 7 | `should add new quota ON TOP of remaining sessions on upgrade` | Mevcut ayda 10 kullanılmış, kalan 15, yeni quota 250 | Yeni budget `used=10, total=10+250=260` olur (kalan+yeni) |
| 8 | `should update tenant.plan field to new plan on upgrade` | FREE→PRO upgrade | `tenant.plan` PRO olarak güncellenir |

### 1.3 `downgradePlan()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 9 | `should REPLACE current month budget with new plan quota on downgrade` | Mevcut budget total=250, PRO→FREE | Yeni budget `total=25` olur (additive değil, replacement) |
| 10 | `should close old subscription on downgrade` | Geçerli downgrade senaryosu | Eski aboneliğin `endDate` set edilir |
| 11 | `should update tenant.plan field to new plan on downgrade` | PRO→FREE | `tenant.plan` FREE olarak güncellenir |

### 1.4 `consumeSession()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 12 | `should increment usedCount by 1 for current month budget` | Geçerli budget `used=5` | `used=6` olarak kaydedilir |
| 13 | `should throw if no monthly budget found for tenant` | Budget kaydı yok | Exception fırlatır |

### 1.5 `checkQuota()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 14 | `should return allowed=true when used < limit` | `used=10, limit=25` | `{ allowed: true, current: 10, limit: 25 }` |
| 15 | `should return allowed=false when used >= limit` | `used=25, limit=25` | `{ allowed: false, current: 25, limit: 25 }` |

### 1.6 `ensureMonthlyBudget()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 16 | `should return existing budget if already created for this month` | Aynı yıl/ay için kayıt mevcut | Mevcut kayıt döner, yeni kayıt oluşturulmaz |
| 17 | `should create new budget with usedCount=0 if none exists for this month` | Kayıt yok | Yeni budget `used=0` ile oluşturulur |

---

## 2. AvailabilityService

**Dosya:** `apps/api/src/modules/calendar/scheduling/availability.service.ts`
**Mock'lanacaklar:** `AvailabilitySlotRepository`, `AppointmentRepository`, `CalendarSyncService`

### 2.1 `getAvailableSlots()` — Temel Slot Hesaplama

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 18 | `should return all 30-min chunks when no appointments exist` | 09:00-11:00 availability, randevu yok | `[09:00, 09:30, 10:00, 10:30]` döner |
| 19 | `should exclude slot that exactly matches an existing appointment` | 09:00-09:30 randevusu var | `09:00` slotu dönen listede olmaz |
| 20 | `should exclude slot that partially overlaps with an appointment` | 09:15-09:45 randevusu var | `09:00` ve `09:30` slotları çakıştığı için hariç tutulur |
| 21 | `should return empty array when no availability slots defined` | Psikolog için availability kaydı yok | `[]` döner |
| 22 | `should return empty array when all slots are occupied` | Tüm günlük slotlar dolu | `[]` döner |

### 2.2 `getAvailableSlots()` — Busy Range Merging

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 23 | `should merge two overlapping busy ranges into one` | Randevu 1: 09:00-09:45, Randevu 2: 09:30-10:15 | Tek birleşik busy range: 09:00-10:15 |
| 24 | `should NOT merge two non-overlapping busy ranges` | Randevu 1: 09:00-09:30, Randevu 2: 10:00-10:30 | İki ayrı busy range korunur; 09:30-10:00 arası free |
| 25 | `should merge external calendar events with appointment busy ranges` | 1 randevu + 1 Google Calendar eventi aynı aralıkta | Tek birleşik range olarak hesaplanır |
| 26 | `should handle adjacent (touching but not overlapping) ranges separately` | Randevu 1: 09:00-09:30, Randevu 2: 09:30-10:00 | İki ayrı busy range; bitişik ama farklı |

### 2.3 `setSlots()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 27 | `should delete all existing slots before inserting new ones` | Mevcut 3 slot var, 2 yeni slot gelir | Delete çağrılır, ardından 2 yeni slot insert edilir |
| 28 | `should do nothing if new slots array is empty` | Boş array gönderilir | Mevcut slotlar silinir, insert çağrılmaz |

---

## 3. AppointmentsService

**Dosya:** `apps/api/src/modules/calendar/scheduling/appointments.service.ts`
**Mock'lanacaklar:** `AppointmentRepository`, `RedisService`, `StripeService`, `VideoService`, `CalendarSyncService`, `SubscriptionService`, `NotificationService`, `BullMQ Queue`

### 3.1 `create()` — Slot Locking & Validation

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 29 | `should acquire Redis lock before creating appointment` | Normal oluşturma akışı | Redis `set NX PX` çağrısı yapılır |
| 30 | `should throw ConflictException if Redis lock cannot be acquired` | Redis lock başka biri tarafından tutuluyor | `ConflictException` fırlatılır |
| 31 | `should throw ConflictException if overlapping appointment exists in DB` | Aynı saat aralığında aktif randevu var | `ConflictException` fırlatılır, DB'ye kayıt yapılmaz |
| 32 | `should release Redis lock in finally block even if creation fails` | DB insert sırasında hata oluşur | `finally` bloğunda Redis `del` çağrılır |
| 33 | `should throw NotFoundException if client does not belong to tenant` | Client başka tenant'a ait | `NotFoundException` fırlatılır |
| 34 | `should create video meeting if appointment type is ONLINE` | `type=ONLINE` | `VideoService.create()` çağrılır |
| 35 | `should NOT create video meeting if appointment type is IN_PERSON` | `type=IN_PERSON` | `VideoService.create()` çağrılmaz |
| 36 | `should enqueue notification job after successful creation` | Başarılı oluşturma | BullMQ queue'ya job eklenir |

### 3.2 `cancel()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 37 | `should void Stripe payment intent if one exists` | `appointment.stripePaymentIntentId` dolu | `StripeService.voidPayment()` çağrılır |
| 38 | `should NOT call Stripe if no payment intent on appointment` | `stripePaymentIntentId` null | `StripeService.voidPayment()` çağrılmaz |
| 39 | `should consume session quota after cancellation` | Geçerli iptal senaryosu | `SubscriptionService.consumeSession()` çağrılır |
| 40 | `should send cancellation notification` | Geçerli iptal | Bildirim servisi çağrılır |
| 41 | `should throw if appointment is not in SCHEDULED status` | Status=COMPLETED | İşlem reddedilir |

### 3.3 `complete()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 42 | `should capture Stripe payment on complete` | Payment intent mevcut | `StripeService.capturePayment()` çağrılır |
| 43 | `should create SessionPayment record on complete` | Başarılı tamamlama | `SessionPayment` kaydı oluşturulur |
| 44 | `should consume session quota on complete` | Başarılı tamamlama | `SubscriptionService.consumeSession()` çağrılır |
| 45 | `should throw if appointment is already COMPLETED` | Status=COMPLETED | İşlem reddedilir |

### 3.4 `noShow()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 46 | `should capture full Stripe amount as penalty on no-show` | Stripe intent mevcut | `StripeService.capturePayment()` tam tutarla çağrılır |
| 47 | `should update appointment status to NO_SHOW` | Geçerli no-show | `appointment.status = NO_SHOW` olarak güncellenir |

---

## 4. PaymentsService (Finance)

**Dosya:** `apps/api/src/modules/finance/payments.service.ts`
**Mock'lanacaklar:** `SessionPaymentRepository`, `AppointmentRepository`, `UserRepository`, `TenantRepository`

### 4.1 `createFromAppointment()` — Fee Hierarchy

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 48 | `should use client.sessionFee if defined` | `client.sessionFee=200, psych.defaultFee=150, tenant.defaultFee=100` | Fee=200 kullanılır |
| 49 | `should fall back to psychologist.defaultSessionFee if client fee is null` | `client.sessionFee=null, psych.defaultFee=150` | Fee=150 kullanılır |
| 50 | `should fall back to tenant.defaultSessionFee if both client and psych fees are null` | `client.sessionFee=null, psych.defaultFee=null, tenant.defaultFee=100` | Fee=100 kullanılır |
| 51 | `should use fee=0 if all fee sources are null` | Tüm fee'ler null | Fee=0 kullanılır |
| 52 | `should skip creation if a payment already exists for appointment` | Aynı appointment için kayıt var | Yeni kayıt oluşturulmaz, mevcut döner |

### 4.2 `getRevenueSummary()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 53 | `should aggregate total, collected and pending for weekly period` | `period=weekly`, çeşitli ödemeler | Son 7 günlük toplamlar doğru hesaplanır |
| 54 | `should aggregate total, collected and pending for monthly period` | `period=monthly` | Ayın başından bugüne toplamlar hesaplanır |
| 55 | `should return zero for all fields if no payments in period` | Ödeme yok | `{ totalRevenue: 0, collected: 0, pending: 0 }` |

### 4.3 `getMonthlyChartData()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 56 | `should return data for last 6 months by default` | Default çağrı | 6 elemanlı array döner |
| 57 | `should return zero-revenue entry for month with no payments` | 3. ayda ödeme yok | O ayın objesi `totalRevenue=0` ile dahil edilir |

### 4.4 `findUnpaidForReminder()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 58 | `should return payments older than reminderDays threshold` | reminderDays=3, 4 günlük ödeme var | Ödeme listede yer alır |
| 59 | `should NOT return payments newer than reminderDays threshold` | reminderDays=3, 2 günlük ödeme | Liste boş döner |

---

## 5. ClientsService

**Dosya:** `apps/api/src/modules/clients/clients.service.ts`
**Mock'lanacaklar:** `ClientRepository`, `TenantRepository`, `SubscriptionService`, `EncryptionService`, `DekCacheService`

### 5.1 `create()` — Quota Enforcement

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 60 | `should create client when active client count is below quota` | `count=10, maxClients=25` | Client başarıyla oluşturulur |
| 61 | `should throw ForbiddenException when client count equals quota` | `count=25, maxClients=25` | `ForbiddenException` fırlatılır |
| 62 | `should throw ForbiddenException when client count exceeds quota` | `count=26, maxClients=25` | `ForbiddenException` fırlatılır |

### 5.2 `importBulk()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 63 | `should import all valid rows and return correct counts` | 5 satır, hepsi geçerli | `{ imported: 5, failed: 0, errors: [] }` |
| 64 | `should skip invalid rows and report them in errors` | 3 geçerli, 2 geçersiz satır | `{ imported: 3, failed: 2, errors: [...] }` |
| 65 | `should stop importing when quota is reached mid-batch` | Kota 2. satırda dolacak | 1. satır import edilir, 2. ve sonrası `failed` sayılır |
| 66 | `should report validation error message for each invalid row` | Email formatı hatalı satır | `errors[0].message` içerik açıklayıcı |

### 5.3 `softDelete()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 67 | `should set deletedAt and status=INACTIVE on soft delete` | Aktif client | `deletedAt` now, `status=INACTIVE` |
| 68 | `should throw NotFoundException if client does not exist` | Client yok | `NotFoundException` fırlatılır |

### 5.4 `cryptoShred()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 69 | `should nullify encryptedClientDek and clientDekNonce` | Geçerli client | Her iki alan `null` yapılır |
| 70 | `should invalidate DEK cache for client after shred` | DEK cache'de mevcut | `DekCacheService.invalidate()` çağrılır |
| 71 | `should create audit log entry after crypto shred` | Başarılı shred | Audit log kaydı oluşturulur |

### 5.5 `anonymize()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 72 | `should replace firstName, lastName, phone with masked values` | Gerçek verili client | Alanlarda `***` veya benzeri maske değerleri |

---

## 6. AuthService

**Dosya:** `apps/api/src/modules/auth/auth.service.ts`
**Mock'lanacaklar:** `UserRepository`, `TenantRepository`, `Auth0ManagementClient`, `JwksClient`, `NotificationService`, `ArgonService`, `S3Service`, `SubscriptionService`

### 6.1 `localLogin()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 73 | `should return token when email and password are correct` | Doğru bilgiler | JWT token döner |
| 74 | `should throw UnauthorizedException when password does not match` | Yanlış şifre | `UnauthorizedException` fırlatılır |
| 75 | `should throw UnauthorizedException when user not found` | Kayıtsız email | `UnauthorizedException` fırlatılır |
| 76 | `should throw ForbiddenException when user is inactive` | `user.isActive=false` | `ForbiddenException` fırlatılır |
| 77 | `should throw ForbiddenException when tenant is inactive` | `tenant.isActive=false` | `ForbiddenException` fırlatılır |

### 6.2 `register()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 78 | `should hash password with Argon2 before saving` | Geçerli kayıt | Repository'ye düz metin değil hash kaydedilir |
| 79 | `should create tenant and user in the same transaction` | Geçerli kayıt | Hem tenant hem user oluşturulur |
| 80 | `should call SubscriptionService.createInitialSubscription after registration` | Geçerli kayıt | `createInitialSubscription()` çağrılır |
| 81 | `should throw ConflictException if email already in use` | Mevcut email | `ConflictException` fırlatılır |
| 82 | `should generate local auth0Sub if Auth0 Management API is not available` | Auth0 unavailable | `auth0Sub` lokal olarak üretilir |

### 6.3 `loginCallback()` — MFA Detection

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 83 | `should set is2faEnabled=true when amr claim contains mfa` | JWT payload'da `amr: ['mfa']` | `user.is2faEnabled = true` |
| 84 | `should set is2faEnabled=true when Management API reports MFA enrollment` | amr yok ama Auth0 enrollment mevcut | `user.is2faEnabled = true` |
| 85 | `should set is2faEnabled=false when no MFA evidence found` | amr yok, enrollment yok | `user.is2faEnabled = false` |

### 6.4 `invite()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 86 | `should create invite token with 7-day expiration` | Geçerli davet | Token `expiresAt = now + 7days` ile oluşturulur |
| 87 | `should throw ConflictException if pending invite already exists for email` | Aynı email için bekleyen davet var | `ConflictException` fırlatılır |
| 88 | `should send invitation email via NotificationService` | Geçerli davet | `NotificationService.sendInvite()` çağrılır |

### 6.5 `switchTenant()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 89 | `should return new JWT for target tenant when user is a member` | `TenantMember` kaydı var | Yeni tenant context'li JWT döner |
| 90 | `should throw ForbiddenException if user is not a member of target tenant` | `TenantMember` yok | `ForbiddenException` fırlatılır |

---

## 7. FormSubmissionsService

**Dosya:** `apps/api/src/modules/tests/form-submissions/form-submissions.service.ts`
**Mock'lanacaklar:** `FormSubmissionRepository`, `FormDefinitionRepository`, `BullMQ Queue`, `CrisisService`

### 7.1 `checkCrisisTrigger()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 91 | `should return true when response matches crisis trigger value in schema` | Form şemasında `crisis_trigger: true` field var, response eşleşiyor | `true` döner |
| 92 | `should return false when no field in schema is marked as crisis trigger` | Şemada trigger field yok | `false` döner |
| 93 | `should return false when trigger field exists but response does not match trigger value` | Trigger field var ama cevap farklı | `false` döner |

### 7.2 `createAndComplete()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 94 | `should set riskFlags=["suicide_risk"] when crisis trigger is detected` | Crisis trigger tetiklendi | Submission `riskFlags` içinde `suicide_risk` var |
| 95 | `should NOT set riskFlags when crisis trigger is not detected` | Trigger yok | `riskFlags` boş veya içermez |
| 96 | `should enqueue scoring job if form has scoringConfig` | ScoringConfig tanımlı | BullMQ'ya scoring job eklenir |
| 97 | `should NOT enqueue scoring job if form has no scoringConfig` | ScoringConfig yok | BullMQ çağrılmaz |
| 98 | `should enqueue crisis alert job if crisis trigger fires` | Crisis tetiklendi | BullMQ'ya crisis job eklenir |

### 7.3 `complete()` — State Transition

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 99 | `should transition submission from DRAFT to COMPLETE` | Status=DRAFT | `status=COMPLETE` olarak güncellenir |
| 100 | `should throw BadRequestException if submission is already COMPLETE` | Status=COMPLETE | `BadRequestException` fırlatılır |

### 7.4 `submitByToken()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 101 | `should throw UnauthorizedException if token is expired` | Token süresi dolmuş | `UnauthorizedException` fırlatılır |
| 102 | `should throw UnauthorizedException if token does not exist` | Geçersiz token | `UnauthorizedException` fırlatılır |
| 103 | `should create submission and mark token as used on valid submission` | Geçerli token | Submission oluşturulur, token `usedAt` set edilir |

---

## 8. ExportService (GDPR)

**Dosya:** `apps/api/src/modules/clients/export/export.service.ts`
**Mock'lanacaklar:** `FormSubmissionRepository`, `AppointmentRepository`, `SessionPaymentRepository`, `ClientFileRepository`, `EncryptionService`

### 8.1 `exportGdprJson()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 104 | `should include decrypted note content in GDPR export` | Note var, decryption başarılı | Export'ta `content` alanı açık metin içerir |
| 105 | `should include [DECRYPTION FAILED] placeholder when decryption throws` | Decryption hatası | İlgili note'ta `[DECRYPTION FAILED]` string'i görünür, export başarıyla tamamlanır |
| 106 | `should include all appointment statuses in GDPR export` | COMPLETED + CANCELLED + SCHEDULED randevular | Üçü de export'a dahil edilir |
| 107 | `should include form submissions with responses` | 2 submission mevcut | Her ikisi de `submissions` alanında yer alır |
| 108 | `should return empty arrays for sections with no data` | Client'ın hiç verisi yok | Tüm alanlar boş array |

---

## 9. ConsentService

**Dosya:** `apps/api/src/modules/legal/consent.service.ts`
**Mock'lanacaklar:** `ConsentTextRepository`, `ClientConsentRepository`

### 9.1 `grantConsent()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 109 | `should throw BadRequestException if provided hash does not match consent text hash` | Hash uyuşmuyor | `BadRequestException` fırlatılır |
| 110 | `should create consent record when hash matches` | Hash doğru | `ClientConsent` kaydı oluşturulur |

### 9.2 `revokeConsent()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 111 | `should set revokedAt and isGranted=false` | Mevcut aktif consent | `revokedAt=now, isGranted=false` |
| 112 | `should throw NotFoundException if consent record does not exist` | Kayıt yok | `NotFoundException` fırlatılır |

### 9.3 `getPendingConsentsForUser()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 113 | `should return consent types where user has never granted` | Kullanıcı hiç onay vermemiş | 3 tip de pending listede |
| 114 | `should return consent types where a newer version exists after user granted` | Kullanıcı v1'e onay verdi, v2 yayınlandı | İlgili tip pending listede |
| 115 | `should return empty array when all consents are up-to-date` | Kullanıcı tüm güncel versiyonlara onay verdi | `[]` döner |

### 9.4 `createConsentTextVersion()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 116 | `should compute SHA256 hash of consent text content` | Yeni versiyon oluşturma | `hash` alanı SHA256 ile üretilmiş değer |
| 117 | `should compute diff against previous version` | Önceki versiyon var | `diff` alanı dolu |
| 118 | `should store diff as empty or null when no previous version exists` | İlk versiyon | `diff` null veya boş |

---

## 10. NotesService

**Dosya:** `apps/api/src/modules/clients/notes/notes.service.ts`
**Mock'lanacaklar:** `ConsultationNoteRepository`, `EncryptionService`

### 10.1 `create()` — Encryption Format

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 119 | `should call EncryptionService.encrypt() with plaintext content` | Düz metin gönderilir | `EncryptionService.encrypt()` çağrılır |
| 120 | `should decode base64 content before encrypting when base64 detected` | Base64 encoded content | Decode edildikten sonra encrypt çağrılır |
| 121 | `should store empty buffer sentinel for server-side encrypted notes` | Server-side şifreleme | DEK alanına boş buffer sentinel yazılır |

### 10.2 `findOne()` — Format Detection

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 122 | `should return decrypted content for server-side encrypted notes` | Sentinel DEK var | `EncryptionService.decrypt()` çağrılır, düz metin döner |
| 123 | `should return raw encrypted envelope for legacy client-side encrypted notes` | Sentinel yoktur | Şifreli envelope client'a iletilir, decrypt çağrılmaz |

---

## 11. EncryptionService

**Dosya:** `apps/api/src/modules/common/encryption/encryption.service.ts`
**Mock'lanacaklar:** `TenantRepository`, `DekCacheService`

### 11.1 `encrypt()` / `decrypt()`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 124 | `should return ciphertext different from plaintext` | Plaintext şifrelenir | Sonuç farklı bytes |
| 125 | `should successfully decrypt what was encrypted` | encrypt → decrypt döngüsü | Orijinal metin geri elde edilir |
| 126 | `should use cached DEK without hitting DB on second call` | Aynı tenant için iki şifreleme | DB sadece bir kez sorgulanır |
| 127 | `should throw if DEK not found in DB and not in cache` | DEK hiç yok | Exception fırlatılır |
| 128 | `should produce different ciphertext for same plaintext (random nonce)` | Aynı metin iki kez şifrelenir | İki ciphertext farklı (nonce farkından dolayı) |

---

## 12. LicensesService (Admin)

**Dosya:** `apps/api/src/modules/admin/licenses.service.ts`
**Mock'lanacaklar:** `UserRepository`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 129 | `should return only users with PENDING license status and uploaded document` | Çeşitli statuslarda kullanıcılar var | Sadece PENDING + licenseDocUrl olanlar döner |
| 130 | `should set license status to VERIFIED on approve` | PENDING kullanıcı | `licenseStatus=VERIFIED` olarak güncellenir |
| 131 | `should set license status to REJECTED on reject` | PENDING kullanıcı | `licenseStatus=REJECTED` olarak güncellenir |
| 132 | `should throw NotFoundException when approving non-existent user` | Kullanıcı yok | `NotFoundException` fırlatılır |

---

## 13. AdminService

**Dosya:** `apps/api/src/modules/admin/admin.service.ts`
**Mock'lanacaklar:** `TenantRepository`, `UserRepository`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 133 | `should aggregate correct stats (total tenants, active, psychologists, pending licenses)` | 3 tenant, 2 aktif, 5 psikolog, 1 pending lisans | Stats doğru değerleri yansıtır |
| 134 | `should deactivate tenant by setting isActive=false` | Aktif tenant | `tenant.isActive=false` |
| 135 | `should activate tenant by setting isActive=true` | İnaktif tenant | `tenant.isActive=true` |
| 136 | `should set rndPartnerUntil date when marking tenant as R&D partner` | Tarih sağlanır | `tenant.rndPartnerUntil` set edilir |

---

## 14. CrisisService

**Dosya:** `apps/api/src/modules/crisis/crisis.service.ts`
**Mock'lanacaklar:** `FormSubmissionRepository`, `AuditLogService`

| # | Test Adı | Senaryo | Beklenen Sonuç |
|---|----------|---------|----------------|
| 137 | `should return only submissions with suicide_risk flag and unacknowledged` | Çeşitli submission'lar | Sadece `riskFlags=['suicide_risk']` ve `crisisAcknowledgedAt=null` olanlar |
| 138 | `should set crisisAcknowledgedAt to now on acknowledge` | Geçerli submission | `crisisAcknowledgedAt = now` |
| 139 | `should create audit log entry on acknowledgment` | Başarılı acknowledge | `AuditLogService.logAction()` çağrılır |
| 140 | `should throw BadRequestException if submission has no suicide_risk flag` | risk flag yok | `BadRequestException` fırlatılır |
| 141 | `should throw NotFoundException if submission does not exist` | ID geçersiz | `NotFoundException` fırlatılır |

---

## Özet

| Modül | Test Sayısı |
|-------|-------------|
| SubscriptionService | 17 |
| AvailabilityService | 11 |
| AppointmentsService | 19 |
| PaymentsService | 12 |
| ClientsService | 13 |
| AuthService | 18 |
| FormSubmissionsService | 13 |
| ExportService | 5 |
| ConsentService | 10 |
| NotesService | 5 |
| EncryptionService | 5 |
| LicensesService | 4 |
| AdminService | 4 |
| CrisisService | 5 |
| **Toplam** | **141** |

---

## Teknik Notlar

### Test Dosya Yapısı (örnek)

```
apps/api/src/modules/
  subscriptions/
    __tests__/
      subscription.service.spec.ts
  calendar/
    scheduling/
      __tests__/
        availability.service.spec.ts
        appointments.service.spec.ts
  ...
```

### Mock Şablonu

```typescript
const mockRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(),
};

const module = await Test.createTestingModule({
  providers: [
    TargetService,
    { provide: getRepositoryToken(Entity), useValue: mockRepo },
  ],
}).compile();
```

### Temel Kurallar

- Her `beforeEach()` içinde `jest.clearAllMocks()` çağrılır
- Zaman bağımlı testlerde `jest.useFakeTimers()` + `jest.setSystemTime()` kullanılır
- `Date.now()` ve `new Date()` gerçek değer yerine sabit değere pin'lenir
- Her test kendi mock verisini kendisi kurar (shared state yok)
