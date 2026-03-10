-- RLS for FormSubmission table (TASK-S3-02)
-- RLS-002: Her yeni tabloda tenant_isolation policy

ALTER TABLE "FormSubmission" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "FormSubmission"
  USING ("tenantId" = current_setting('app.current_tenant', true));
