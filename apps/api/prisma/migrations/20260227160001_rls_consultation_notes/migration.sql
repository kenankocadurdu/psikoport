-- RLS for ConsultationNote table (TASK-S2-03)
-- RLS-002: Her yeni tabloda tenant_isolation policy

ALTER TABLE "ConsultationNote" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "ConsultationNote"
  USING ("tenantId" = current_setting('app.current_tenant', true));
