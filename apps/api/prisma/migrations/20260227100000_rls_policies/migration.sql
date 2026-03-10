-- TASK-S0-04: RLS Policies & WORM (Row-Level Security)
-- Her yeni tablo eklendiğinde bu dosyaya ilgili policy eklenir.

-- ---------------------------------------------------------------------------
-- 1. users tablosunda RLS aktifleştir
-- Not: Prisma model adı "User", sütun "tenantId" (cuid/TEXT)
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "User"
  USING ("tenantId" = current_setting('app.current_tenant', true));

-- ---------------------------------------------------------------------------
-- 2. API isteğinde tenant ayarlamak için fonksiyon
-- NestJS Guard her istekte: SELECT set_current_tenant('<tenant_id_from_jwt>');
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_current_tenant(tid TEXT) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant', tid, true);
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 3. audit_logs WORM trigger fonksiyonu
-- audit_logs tablosu oluşturulduğunda şu trigger eklenecek:
--
--   CREATE TRIGGER prevent_audit_modification_trigger
--     BEFORE UPDATE OR DELETE ON audit_logs
--     FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
--
-- Şimdilik sadece fonksiyon tanımlanır (tablo henüz yok).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs tablosu değiştirilemez (WORM)';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
