-- RLS for ClientFile table (TASK-S2-06)
ALTER TABLE "ClientFile" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "ClientFile"
  USING ("tenantId" = current_setting('app.current_tenant', true));
