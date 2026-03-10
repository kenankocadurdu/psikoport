-- CreateTable
CREATE TABLE "VideoIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "provider" "VideoProvider" NOT NULL,
    "encryptedAccessToken" BYTEA NOT NULL,
    "encryptedRefreshToken" BYTEA,
    "tokenNonce" BYTEA NOT NULL,
    "refreshTokenNonce" BYTEA,
    "accessTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoIntegration_tenantId_idx" ON "VideoIntegration"("tenantId");

-- CreateIndex
CREATE INDEX "VideoIntegration_psychologistId_idx" ON "VideoIntegration"("psychologistId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoIntegration_tenantId_psychologistId_provider_key" ON "VideoIntegration"("tenantId", "psychologistId", "provider");

-- AddForeignKey
ALTER TABLE "VideoIntegration" ADD CONSTRAINT "VideoIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoIntegration" ADD CONSTRAINT "VideoIntegration_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
