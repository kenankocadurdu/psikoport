-- TASK-S2-01: Client (Danışan) model

CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "tcKimlik" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "maritalStatus" TEXT,
    "educationLevel" TEXT,
    "occupation" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "emergencyContact" JSONB,
    "preferredContact" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "complaintAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "referralSource" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");
CREATE INDEX "Client_status_idx" ON "Client"("status");
CREATE INDEX "Client_deletedAt_idx" ON "Client"("deletedAt");

-- GIN indexes for array contains search
CREATE INDEX "Client_tags_gin_idx" ON "Client" USING GIN ("tags");
CREATE INDEX "Client_complaintAreas_gin_idx" ON "Client" USING GIN ("complaintAreas");

ALTER TABLE "Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
