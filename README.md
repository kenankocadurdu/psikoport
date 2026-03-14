# Psikoport

**Psikolog ve PDR uzmanları için danışmanlık yönetim platformu.**

Psikoport; danışan takibi, seans notları, psikometrik testler, takvim, randevu ve gelir yönetimini tek çatı altında toplayan, gizliliği önceliğe alan bir SaaS platformudur. Her psikolog kendi izole çalışma alanında çalışır; veriler birbirinden tamamen ayrıdır.

---

## Platforma Sunulan Özellikler

### Danışan Yönetimi (CRM)

Psikolog, danışanlarının temel bilgilerini (ad, iletişim, demografik bilgiler) sisteme kaydeder. Her danışanın zaman çizelgesi otomatik tutulur: hangi tarihte randevu alındı, hangi test uygulandı, hangi ödeme yapıldı — hepsi tek sayfada görülür. Danışanlar CSV ile toplu içe aktarılabilir. Danışan silindiğinde tüm seans notları da kriptografik olarak imha edilir; bu veriler artık kurtarılamaz hale gelir (crypto-shred).

### Seans Notları (Uçtan Uca Şifreli)

Seans notları sunucuya gönderilmeden önce **tarayıcıda şifrelenir**. Sunucu, notların içeriğini hiçbir zaman düz metin olarak görmez; yalnızca şifreli veri bloğunu saklar. Şifreli anahtarın kendisi hiçbir zaman sunucuya iletilmez. Bu mimari sayesinde olası bir veritabanı sızıntısında bile seans içerikleri okunamaz.

Her nota; seans tarihi, süresi, tipi, seans numarası, ruh hali puanı (1–10) ve etiket bilgileri eklenebilir. Notlar tarih ve etikete göre filtrelenebilir, sayfalanabilir.

### Psikometrik Test Motoru

Platform altı hazır psikometrik test içerir:

| Test | Ne Ölçer |
|------|----------|
| PHQ-9 | Depresyon belirtileri (9 madde) |
| GAD-7 | Yaygın anksiyete bozukluğu (7 madde) |
| DASS-21 | Depresyon, anksiyete ve stres (21 madde, 3 alt ölçek) |
| PCL-5 | PTSD belirti şiddeti (20 madde) |
| PSS-10 | Algılanan stres (10 madde) |
| WHO-5 | İyi oluş indeksi (5 madde) |

Bunların yanı sıra psikolog kendi form tanımlarını da oluşturabilir. Testler, danışana token ile bağlantı gönderilerek doldurtulur; danışan sisteme giriş yapmak zorunda değildir. Form tamamlandığında puanlama otomatik yapılır ve sonuç psikologun paneline düşer.

### Kriz Uyarı Sistemi

Bazı test maddeleri (örneğin PHQ-9'un 9. sorusu — intihar düşüncesi) otomatik kriz bayrağı taşır. Danışan bu maddeye kritik bir yanıt verdiğinde sistem anında harekete geçer: psikoloğa e-posta ve SMS gönderilir, denetim kaydı oluşturulur. Psikolog 30 dakika içinde uyarıyı onaylamazsa sistem yeniden bildirim gönderir.

### Takvim ve Randevu Yönetimi

Psikolog uygunluk saatlerini tanımlar. Randevular; duruma göre PLANLANMIŞ, TAMAMLANDI, İPTAL EDİLDİ veya GELMEDI olarak izlenir. Google Calendar ve Microsoft Outlook ile çift yönlü senkronizasyon desteklenir; takvim değişiklikleri anlık olarak yansır. Zoom entegrasyonu ile randevuya otomatik video toplantı bağlantısı eklenir.

Randevudan 24 saat ve 1 saat önce danışana otomatik SMS ve e-posta hatırlatması gönderilir.

### Gelir ve Ödeme Takibi

Her randevuya ödeme kaydı bağlanabilir. Ödeme yöntemi (nakit, havale, kredi kartı), durumu (bekliyor, ödendi, kısmi, iptal) ve fatura bilgisi tutulur. Aylık ve dönemsel gelir raporları ile grafik görünümü sunar. Vadesi gelen ödemeler için otomatik hatırlatma gönderilir.

### Abonelik Planları ve Kotalar

Üç plan vardır: Free, Pro, Pro Plus. Her planın aylık seans kotası, seans başına test limiti ve özel form kotası vardır. Kota aşıldığında sistem yeni kayda izin vermez. Plan konfigürasyonu süper yönetici tarafından değiştirilebilir.

### Ekip Yönetimi

Psikolog, asistanlarını sisteme davet edebilir. Asistanlar danışan bilgilerini görüntüleyebilir, randevu oluşturabilir ve ödeme takibi yapabilir; ancak seans notlarına erişemez.

### Blog ve Halka Açık Profil

Her psikologa özel bir sayfa (`/p/[slug]`) oluşturulur. Blog yazıları bu sayfada yayınlanabilir; ziyaretçiler sisteme giriş yapmadan okuyabilir.

### KVKK Uyumu ve Denetim Kaydı

Platforma giriş, her danışan oluşturma ve silme işlemi denetim kaydına yazılır: kim, ne zaman, hangi kaynakla işlem yaptı. KVKK açık rıza metinleri versiyonlanır; her güncelleme yeni versiyon olarak saklanır.

### Süper Yönetici Konsolu

Platform sahibinin eriştiği yönetim paneli. Tüm kiracılar (psikologlar), kullanıcılar ve abonelik planları buradan yönetilir. Tenant aktivasyonu, kota görüntüleme ve sistem konfigürasyonu (Auth0 aç/kapat vb.) burada yapılır.

---

## Teknik Yapı

### Genel Mimari

```
Tarayıcı (Next.js)
    │
    ▼
NestJS API (port 3001)
    │
    ├── PostgreSQL  — tüm yapısal veriler
    ├── Redis       — iş kuyruğu ve geçici veri
    ├── MinIO/S3    — dosya depolama (lisanslar, danışan dosyaları)
    └── Worker      — arka plan işleri (scoring, hatırlatma, kriz)
```

### Neden Monorepo?

Proje tek bir Git deposunda üç uygulama barındırır: API, frontend ve paylaşılan paketler (tipler, form şemaları, puanlama motoru). Turborepo sayesinde sadece değişen kısım yeniden derlenir; bu derleme sürelerini kısaltır. pnpm workspace ile paketler birbirini referans alabilir.

### Backend — NestJS

NestJS, TypeScript tabanlı, modüler bir Node.js çerçevesidir. Her özellik (danışan, takvim, finans vb.) kendi modülünde yaşar. Modüller bağımsız test edilebilir ve birbirinden izole geliştirilir.

API'ye gelen her istek dört güvenlik katmanından geçer (sırayla):

1. **ThrottlerGuard** — Dakikada kaç istek yapılabileceğini sınırlar. Kötü niyetli tekrarlı istekleri keser.
2. **JwtAuthGuard** — Auth0'dan gelen JWT tokenını doğrular. Geçersiz veya süresi dolmuş token kabul edilmez.
3. **TwoFactorGuard** — İki faktörlü doğrulama aktifse, sadece 2FA tamamlanmış oturumlar geçer.
4. **RolesGuard** — Kullanıcının rolüne göre endpoint erişimi kontrol edilir (psikolog, asistan, süper admin).

### Veritabanı — PostgreSQL + Prisma

PostgreSQL ilişkisel veri tabanıdır. Prisma, TypeScript'te veritabanı sorgularını tip güvenli şekilde yazmanı sağlayan ORM'dir.

Her tablo `tenant_id` sütunu içerir. API'ye gelen her istekte PostgreSQL'e `SET app.current_tenant` komutu çalıştırılır; böylece bir psikolog asla başka bir psikologa ait veriye erişemez. Bu izolasyon veritabanı katmanında uygulanır — uygulama koduna bağlı değildir.

Veritabanı WAL (Write-Ahead Log) arşivleme ile yedeklenir. Günlük yedekler MinIO'ya (S3 uyumlu depolama) gönderilir. Gerektiğinde herhangi bir noktaya geri dönülebilir.

### Redis — Ne İşe Yarıyor?

Redis, bellekte çalışan bir veri deposudur. Platformda iki amaçla kullanılır:

1. **İş Kuyruğu (BullMQ):** Bir test tamamlandığında, bir randevu oluşturulduğunda veya kriz bayrağı tetiklendiğinde — bu işler anında kuyruklanır. İşin kendisi arka planda, API'den bağımsız olarak işlenir. Böylece API hızlıca yanıt verir, ağır iş arka plana bırakılır.
2. **Hız Sınırlama:** ThrottlerGuard, istek sayılarını Redis'te tutar.

### Worker — Ne İşe Yarıyor?

Worker, API ile aynı NestJS kodunu çalıştıran ama HTTP isteği kabul etmeyen ayrı bir süreçtir. Sadece Redis kuyruğunu dinler ve iş geldiğinde işler. Bu ayrım sayesinde ağır arka plan işleri API'nin yanıt süresini etkilemez.

Worker'ın işlediği kuyruklar:

| Kuyruk | Ne Yapar |
|--------|----------|
| `scoring` | Form yanıtlarını puanlama motorundan geçirir, şiddet seviyesini hesaplar, kriz bayrağı varsa kriz kuyruğuna iletir |
| `crisis-alert` | Psikoloğa e-posta ve SMS gönderir, denetim kaydı oluşturur, 30 dakika sonra takip kuyruğuna ekler |
| `appointment-reminder-run` | Randevudan 24 saat ve 1 saat önce danışana hatırlatma gönderir |
| `appointment-notification` | Randevu değişikliklerini (iptal, güncelleme) danışana bildirir |
| `calendar-sync` | Google Calendar ve Outlook ile senkronizasyonu çalıştırır |
| `payment-reminder-run` | Vadesi gelen ödemeler için hatırlatma gönderir |

### Puanlama Motoru — `@psikoport/scoring-engine`

Paylaşılan bir TypeScript paketidir. Her form tanımının içinde `scoringConfig` alanı bulunur: hangi maddelerin nasıl toplanacağını, hangi eşiklerin hangi şiddet seviyesini temsil ettiğini, hangi maddelerin kriz bayrağı taşıdığını tanımlar. Puanlama motoru bu konfigürasyonu okur ve sonuç üretir — form tanımından bağımsızdır, herhangi bir JSON formuyla çalışır.

İki hesaplama tipi desteklenir:
- **SUM:** Tüm maddelerin puanları toplanır (PHQ-9, GAD-7, WHO-5, PSS-10).
- **Subscale:** Maddeler gruplara ayrılır, her grup ayrı toplanır (DASS-21, PCL-5).

### Güvenlik Mimarisi

**Seans Notları (Client-Side Encryption):**

```
Psikolog yazar → Tarayıcı şifreler (AES-256-GCM) → Sunucuya şifreli veri gönderilir
                                                       ↓
                                              Sunucu sadece şifreli bloğu saklar
                                                       ↓
Psikolog okur ← Tarayıcı çözer ← Sunucudan şifreli veri gelir
```

Şifreleme anahtarı (KEK) psikoloğun şifresinden türetilir, tarayıcıda kalır, sunucuya gönderilmez, localStorage'a yazılmaz. Sunucu saldırıya uğrasa bile notların içeriği okunamaz.

**Auth0 + JWT:**
Auth0 Universal Login kullanılır. Kullanıcı giriş yaptıktan sonra JWT token alır. Token içine `tenant_id`, `role` ve `amr` (2FA durumu) claim'leri Auth0 Action ile eklenir. API her istekte bu token'ı doğrular.

**2FA (İki Faktörlü Doğrulama):**
TOTP tabanlıdır (Google Authenticator gibi uygulamalar). Aktif edildiğinde 2FA tamamlanmadan kritik endpointlere erişilemez.

### Frontend — Next.js 15

Next.js App Router kullanılır. Sayfalar route gruplarına ayrılmıştır:

```
app/
├── (auth)/          — giriş, 2FA kurulumu
├── (dashboard)/     — danışanlar, takvim, testler, notlar, finans, profil
├── (forms)/         — token ile form doldurma (danışan girişsiz)
└── (public)/        — psikolog halka açık profil sayfası
```

Veri çekme için TanStack Query (React Query) kullanılır: cache'leme, arka plan güncellemeleri ve hata yönetimi otomatik yapılır. Global durum Zustand ile yönetilir.

### Dosya Depolama — MinIO / S3

MinIO, yerel geliştirmede Amazon S3'ün yerini tutan açık kaynaklı bir nesne depolarıdır. Üretimde gerçek AWS S3 ile değiştirilebilir — API aynı kalır. Kullanıcılar dosyaları doğrudan S3'e yükler (presigned URL ile); API büyük dosyaları üzerinden geçirmez.

### E-posta ve SMS

E-postalar SendGrid üzerinden gönderilir. SMS için ayrı bir sağlayıcı entegre edilmiştir. Her iki kanal da Worker tarafından kuyruktan işlenir — hata durumunda otomatik tekrar deneme yapılır.

### Dağıtık İzleme — Jaeger / OpenTelemetry

API ve Worker'dan gelen izler (trace) Jaeger'a gönderilir. Bir isteğin hangi modülden geçtiği, ne kadar sürdüğü, nerede yavaşladığı Jaeger arayüzünden görülebilir. Üretimde farklı bir OTLP uyumlu backend (Grafana Tempo, Datadog vb.) ile değiştirilebilir.

---

## Teknoloji Listesi

| Katman | Teknoloji | Neden |
|--------|-----------|-------|
| Backend | NestJS 11 + TypeScript | Modüler yapı, tip güvenliği, ekosistem zenginliği |
| ORM | Prisma 5 | Tip güvenli sorgular, migration yönetimi, schema-first |
| Veritabanı | PostgreSQL 16 | ACID uyumlu, JSON sütun desteği, güçlü indeksleme |
| İş Kuyruğu | BullMQ 5 + Redis 7 | Güvenilir kuyruk, otomatik retry, gecikmiş iş desteği |
| Auth | Auth0 + Passport JWT | Yönetilen kimlik doğrulama, TOTP 2FA, OIDC |
| Frontend | Next.js 15 + React 19 | App Router, server components, streaming |
| Stil | Tailwind CSS 4 + Shadcn/ui | Utility-first CSS, erişilebilir bileşenler |
| Veri Çekme | TanStack Query | Cache yönetimi, optimistic updates, background refetch |
| Global State | Zustand | Hafif, boilerplate'siz state yönetimi |
| Rich Text | TipTap | Seans notu ve blog editörü |
| Dosya Depolama | AWS S3 / MinIO | Presigned URL ile doğrudan yükleme |
| E-posta | SendGrid | Transaksiyonel e-posta |
| Şifreleme | AES-256-GCM + Argon2 | Uçtan uca not şifreleme (tarayıcıda) |
| İzleme | OpenTelemetry + Jaeger | Dağıtık trace, performans analizi |
| Konteyner | Docker + Docker Compose | Tekrarlanabilir ortam |
| Monorepo | Turborepo + pnpm | Paralel build, cache, workspace bağımlılıkları |

---

## Proje Klasör Yapısı

```
psikoport/
├── apps/
│   ├── api/                  — NestJS backend (port 3001)
│   │   ├── src/modules/      — her özelliğin modülü
│   │   ├── src/queue/        — BullMQ worker processor'ları
│   │   ├── src/common/       — guard, filter, interceptor, decorator
│   │   └── prisma/           — şema, migration, seed
│   └── frontend/             — Next.js frontend (port 3000)
│       ├── app/              — sayfa route'ları
│       ├── components/       — özelliğe göre ayrılmış bileşenler
│       └── lib/
│           ├── api/          — API istemcisi ve endpoint fonksiyonları
│           └── crypto/       — tarayıcı tarafı şifreleme
├── shared/
│   └── packages/
│       ├── shared/           — ortak TypeScript tipleri (@psikoport/shared)
│       ├── form-schemas/     — form JSON tanımları (@psikoport/form-schemas)
│       │   ├── tests/        — phq9, gad7, dass21, who5, pss10, pcl5
│       │   └── intake/       — general, depression, anxiety-panic, trauma-ptsd
│       └── scoring-engine/   — psikometrik puanlama (@psikoport/scoring-engine)
├── infra/
│   ├── docker-compose.yml    — tüm servisler
│   ├── Dockerfile.api        — API imajı (multi-stage)
│   ├── Dockerfile.frontend   — frontend imajı
│   ├── Dockerfile.worker     — worker imajı
│   └── postgres/             — WAL-G yedekleme scriptleri
└── docs/                     — teknik dokümantasyon (01-10)
```

---

## Veri Modeli (Özet)

```
Tenant (psikolog çalışma alanı)
  └── User (psikolog, asistan, süper admin)
  └── Client (danışan)
        ├── ConsultationNote (şifreli seans notu)
        ├── FormSubmission (test yanıtı + puan)
        ├── Appointment (randevu)
        │     └── SessionPayment (ödeme)
        ├── ClientFile (S3 dosyası)
        └── Consent (KVKK onayı)
  └── FormDefinition (hazır veya özel form şablonu)
  └── CalendarIntegration (Google/Outlook bağlantısı)
  └── VideoIntegration (Zoom bağlantısı)
  └── AuditLog (denetim kaydı)
```

---

## Terminoloji Notu

Platform Türk mevzuatına uygun terminoloji kullanır. Kodda ve kullanıcı arayüzünde şu kurallar geçerlidir:

| Yasak | Onaylı |
|-------|--------|
| tedavi / terapi | danışmanlık |
| klinik | seans |
| hasta | danışan |
| HIPAA | KVKK |

---

## Lisans

Tescilli yazılım. Tüm hakları saklıdır.
