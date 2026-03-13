-- Audit Log: Convert to monthly RANGE partitioning on "createdAt"
-- Note: PostgreSQL partitioned tables require the partition key in the PRIMARY KEY.
-- We change PK from ("id") to ("id", "createdAt").

-- Step 1: Drop WORM triggers and rename existing table
DROP TRIGGER IF EXISTS audit_log_worm_trigger ON "AuditLog";
DROP TRIGGER IF EXISTS prevent_audit_modification_trigger ON "AuditLog";

ALTER TABLE "AuditLog" RENAME TO "AuditLog_old";

-- Step 2: Create new partitioned table
CREATE TABLE "AuditLog" (
    "id"           BIGINT GENERATED ALWAYS AS IDENTITY,
    "tenantId"     TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "action"       TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId"   TEXT,
    "details"      JSONB,
    "ipAddress"    TEXT,
    "userAgent"    TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

-- Step 3: Monthly partitions 2026-03 through 2026-09 (+ default catch-all)
CREATE TABLE "audit_logs_2026_03" PARTITION OF "AuditLog"
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE "audit_logs_2026_04" PARTITION OF "AuditLog"
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE "audit_logs_2026_05" PARTITION OF "AuditLog"
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE "audit_logs_2026_06" PARTITION OF "AuditLog"
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE "audit_logs_2026_07" PARTITION OF "AuditLog"
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE "audit_logs_2026_08" PARTITION OF "AuditLog"
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE "audit_logs_2026_09" PARTITION OF "AuditLog"
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE "audit_logs_default" PARTITION OF "AuditLog" DEFAULT;

-- Step 4: Indexes on partitioned table
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog" ("tenantId");
CREATE INDEX "AuditLog_userId_idx"   ON "AuditLog" ("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");

-- Step 5: Migrate existing data
INSERT INTO "AuditLog" ("tenantId", "userId", "action", "resourceType", "resourceId", "details", "ipAddress", "userAgent", "createdAt")
SELECT "tenantId", "userId", "action", "resourceType", "resourceId", "details", "ipAddress", "userAgent", "createdAt"
FROM "AuditLog_old";

-- Step 6: Drop old table
DROP TABLE "AuditLog_old";

-- Step 7: Re-apply WORM trigger on the new partitioned table
CREATE TRIGGER audit_log_worm_trigger
    BEFORE UPDATE OR DELETE ON "AuditLog"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();
