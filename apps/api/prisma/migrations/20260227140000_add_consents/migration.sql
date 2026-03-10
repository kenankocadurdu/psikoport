-- TASK-S1-05: ConsentText + Consent (KVKK)

CREATE TYPE "ConsentType" AS ENUM (
  'KVKK_DATA_PROCESSING',
  'KVKK_SPECIAL_DATA',
  'SESSION_RECORDING',
  'ONLINE_CONSULTATION',
  'CANCELLATION_POLICY',
  'PLATFORM_TOS'
);

CREATE TABLE "ConsentText" (
    "id" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "diffFromPrevious" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentText_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConsentText_consentType_version_key" ON "ConsentText"("consentType", "version");
CREATE INDEX "ConsentText_consentType_idx" ON "ConsentText"("consentType");
CREATE INDEX "ConsentText_effectiveFrom_idx" ON "ConsentText"("effectiveFrom");

CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "userId" TEXT,
    "consentType" "ConsentType" NOT NULL,
    "consentTextVersion" INTEGER NOT NULL,
    "consentTextHash" TEXT NOT NULL,
    "isGranted" BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Consent_tenantId_idx" ON "Consent"("tenantId");
CREATE INDEX "Consent_clientId_idx" ON "Consent"("clientId");
CREATE INDEX "Consent_consentType_idx" ON "Consent"("consentType");
