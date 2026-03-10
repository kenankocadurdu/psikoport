-- RLS for PsychologistProfile (TASK-S5-02)

ALTER TABLE "PsychologistProfile" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "PsychologistProfile"
  USING ("tenantId" = current_setting('app.current_tenant', true));
