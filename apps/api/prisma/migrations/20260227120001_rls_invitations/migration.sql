-- RLS for Invitation table (TASK-S1-03)
-- RLS-002: Her yeni tabloda tenant_isolation policy

ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Invitation"
  USING ("tenantId" = current_setting('app.current_tenant', true));
