ALTER TABLE "BlogPost" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "BlogPost"
  USING ("tenantId" = current_setting('app.current_tenant', true));
