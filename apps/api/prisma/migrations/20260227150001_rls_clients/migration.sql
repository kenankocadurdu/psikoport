-- RLS for Client table (TASK-S2-01)
-- RLS-002: Her yeni tabloda tenant_isolation policy

ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Client"
  USING ("tenantId" = current_setting('app.current_tenant', true));
