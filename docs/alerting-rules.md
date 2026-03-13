# Alerting Kuralları

Tüm metrikler OpenTelemetry aracılığıyla Jaeger/Prometheus'a gönderilir. Alert eşikleri aşıldığında PagerDuty veya Slack'e bildirim gidecek şekilde yapılandırılmalıdır.

---

## P1 Alertler (Acil — Hemen Müdahale Gerekli)

### 1. BullMQ Kuyruk Birikimi

| Alan | Değer |
|------|-------|
| **Metrik** | `bullmq_queue_depth` |
| **Eşik** | `> 100` (herhangi bir kuyrukta) |
| **Severity** | P1 |
| **Pencere** | 5 dakika |

**Aksiyon:**
- Worker process'lerini kontrol et (`docker logs psikoport-worker`)
- Redis bağlantısını doğrula
- Hatalı job'ları BullMQ dashboard'unda incele
- Gerekirse worker instance'larını scale et

---

### 2. API Yanıt Süresi (p99)

| Alan | Değer |
|------|-------|
| **Metrik** | `http.server.duration` (p99 percentile) |
| **Eşik** | `> 2000ms` |
| **Severity** | P1 |
| **Pencere** | 5 dakika |

**Aksiyon:**
- Jaeger'da yavaş trace'leri incele
- Veritabanı bağlantı havuzunu kontrol et
- N+1 sorgu var mı diye Prisma query log'larına bak
- CPU/memory kullanımını kontrol et

---

### 3. BullMQ Job Hata Oranı

| Alan | Değer |
|------|-------|
| **Metrik** | `bullmq.job.failure_rate` |
| **Eşik** | `> 5%` (son 15 dakikada) |
| **Severity** | P1 |
| **Pencere** | 15 dakika |

**Aksiyon:**
- Worker log'larında hata mesajlarını incele
- Failed job'ları BullMQ dashboard'unda retry et veya discard et
- Dış servis bağımlılıklarını kontrol et (SendGrid, S3, Auth0)
- Retry/backoff konfigürasyonunu gözden geçir

---

## P2 Alertler (Önemli — Mesai İçinde Müdahale)

### 4. DEK Cache Hit Ratio Düşüklüğü

| Alan | Değer |
|------|-------|
| **Metrik** | `encryption_dek_cache_hit_ratio` |
| **Eşik** | `< 0.8` (son 10 dakikada) |
| **Severity** | P2 |
| **Pencere** | 10 dakika |

**Aksiyon:**
- `DekCacheService` LRU kapasitesini gözden geçir (mevcut: 500 tenant)
- Cache TTL'ini kontrol et (mevcut: 5 dakika)
- Aktif tenant sayısını kontrol et — büyümüş olabilir
- Beklenmedik `invalidate()` çağrısı olup olmadığını incele

---

### 5. Prisma Sorgu Süresi (p99)

| Alan | Değer |
|------|-------|
| **Metrik** | `prisma.client.queries.duration` (p99 percentile) |
| **Eşik** | `> 500ms` |
| **Severity** | P2 |
| **Pencere** | 10 dakika |

**Aksiyon:**
- `EXPLAIN ANALYZE` ile yavaş sorguları incele
- Eksik index olup olmadığını kontrol et (`@@index` tanımlarına bak)
- `app.current_tenant` RLS context'inin doğru set edildiğini doğrula
- Bağlantı havuzu doygunluğunu kontrol et (`DATABASE_URL`'deki `connection_limit`)

---

## Alert Konfigürasyonu (Prometheus/Grafana)

```yaml
# prometheus/rules/psikoport.yml örneği
groups:
  - name: psikoport
    rules:
      - alert: QueueDepthHigh
        expr: bullmq_queue_depth > 100
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "BullMQ queue {{ $labels.queue }} depth exceeds 100"

      - alert: ApiLatencyHigh
        expr: histogram_quantile(0.99, rate(http_server_duration_bucket[5m])) > 2
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API p99 latency exceeds 2s"

      - alert: DekCacheHitRatioLow
        expr: encryption_dek_cache_hit_ratio < 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "DEK cache hit ratio below 80%"

      - alert: PrismaQuerySlow
        expr: histogram_quantile(0.99, rate(prisma_client_queries_duration_bucket[10m])) > 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Prisma p99 query duration exceeds 500ms"
```
