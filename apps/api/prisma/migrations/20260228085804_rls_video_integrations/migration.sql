-- RLS for VideoIntegration

ALTER TABLE "VideoIntegration" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "VideoIntegration"
  USING ("tenantId" = current_setting('app.current_tenant', true));
