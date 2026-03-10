-- TASK-S2-03: ConsultationNote (CSE — Client-Side Encrypted)

CREATE TABLE "ConsultationNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "sessionNumber" INTEGER,
    "sessionType" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "symptomCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moodRating" INTEGER,
    "durationMinutes" INTEGER,
    "encryptedContent" BYTEA NOT NULL,
    "encryptedDek" BYTEA NOT NULL,
    "contentNonce" BYTEA NOT NULL,
    "contentAuthTag" BYTEA NOT NULL,
    "dekNonce" BYTEA NOT NULL,
    "dekAuthTag" BYTEA NOT NULL,
    "aiSummaryEncrypted" BYTEA,
    "aiSummaryNonce" BYTEA,
    "aiSummaryAuthTag" BYTEA,
    "aiSummaryDek" BYTEA,
    "aiSummaryDekNonce" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsultationNote_tenantId_idx" ON "ConsultationNote"("tenantId");
CREATE INDEX "ConsultationNote_clientId_idx" ON "ConsultationNote"("clientId");
CREATE INDEX "ConsultationNote_sessionDate_idx" ON "ConsultationNote"("sessionDate");

ALTER TABLE "ConsultationNote" ADD CONSTRAINT "ConsultationNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultationNote" ADD CONSTRAINT "ConsultationNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
