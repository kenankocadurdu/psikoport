-- RLS for Appointment and AvailabilitySlot tables (TASK-S4-01)

ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Appointment"
  USING ("tenantId" = current_setting('app.current_tenant', true));

ALTER TABLE "AvailabilitySlot" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "AvailabilitySlot"
  USING ("tenantId" = current_setting('app.current_tenant', true));
