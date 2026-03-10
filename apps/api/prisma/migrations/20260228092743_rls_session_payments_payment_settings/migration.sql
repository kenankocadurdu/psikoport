-- RLS for SessionPayment and PaymentSettings (TASK-S4-07)

ALTER TABLE "SessionPayment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "SessionPayment"
  USING ("tenantId" = current_setting('app.current_tenant', true));

ALTER TABLE "PaymentSettings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "PaymentSettings"
  USING ("tenantId" = current_setting('app.current_tenant', true));
