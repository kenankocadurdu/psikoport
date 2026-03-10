-- TASK-S1-04: AuditLog BigInt id + details, WORM trigger
-- Drops and recreates AuditLog with new schema (id: BigInt, details: Json)

DROP TRIGGER IF EXISTS prevent_audit_modification_trigger ON "AuditLog";
DROP TABLE IF EXISTS "AuditLog";

CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- WORM: Prevent UPDATE/DELETE (AUDIT-001)
CREATE TRIGGER prevent_audit_modification_trigger
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
