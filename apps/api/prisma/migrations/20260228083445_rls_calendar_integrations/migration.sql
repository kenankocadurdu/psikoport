-- RLS for CalendarIntegration and ExternalCalendarEvent

ALTER TABLE "CalendarIntegration" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "CalendarIntegration"
  USING ("tenantId" = current_setting('app.current_tenant', true));

ALTER TABLE "ExternalCalendarEvent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "ExternalCalendarEvent"
  USING ("tenantId" = current_setting('app.current_tenant', true));
