-- TASK-S3-01: FormDefinition (form/test tanımları)
CREATE TYPE "FormType" AS ENUM ('INTAKE', 'INTAKE_ADDON', 'PSYCHOMETRIC', 'CUSTOM');

CREATE TABLE "FormDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "formType" "FormType" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "targetAgeGroup" TEXT,
    "estimatedMinutes" INTEGER,
    "licenseStatus" TEXT,
    "schema" JSONB NOT NULL,
    "scoringConfig" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FormDefinition_code_key" ON "FormDefinition"("code");
CREATE INDEX "FormDefinition_tenantId_idx" ON "FormDefinition"("tenantId");
CREATE INDEX "FormDefinition_formType_idx" ON "FormDefinition"("formType");
CREATE INDEX "FormDefinition_code_idx" ON "FormDefinition"("code");

ALTER TABLE "FormDefinition" ADD CONSTRAINT "FormDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
