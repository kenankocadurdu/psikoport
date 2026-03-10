-- TASK-S3-02: FormSubmission (form yanıtları + puanlama)
CREATE TYPE "CompletionStatus" AS ENUM ('DRAFT', 'COMPLETE', 'EXPIRED');

CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "formDefinitionId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "sessionId" TEXT,
    "responses" JSONB NOT NULL,
    "scores" JSONB,
    "severityLevel" TEXT,
    "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completionStatus" "CompletionStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "formVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FormSubmission_tenantId_idx" ON "FormSubmission"("tenantId");
CREATE INDEX "FormSubmission_clientId_idx" ON "FormSubmission"("clientId");
CREATE INDEX "FormSubmission_formDefinitionId_idx" ON "FormSubmission"("formDefinitionId");
CREATE INDEX "FormSubmission_completionStatus_idx" ON "FormSubmission"("completionStatus");

ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formDefinitionId_fkey" FOREIGN KEY ("formDefinitionId") REFERENCES "FormDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
