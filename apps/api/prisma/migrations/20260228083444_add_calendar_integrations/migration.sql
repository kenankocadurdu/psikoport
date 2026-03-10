-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateTable
CREATE TABLE "CalendarIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "calendarId" TEXT NOT NULL,
    "encryptedAccessToken" BYTEA NOT NULL,
    "encryptedRefreshToken" BYTEA NOT NULL,
    "tokenNonce" BYTEA NOT NULL,
    "refreshTokenNonce" BYTEA NOT NULL,
    "accessTokenExpiry" TIMESTAMP(3),
    "syncToken" TEXT,
    "channelId" TEXT,
    "channelExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalCalendarEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "calendarIntegrationId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarIntegration_tenantId_idx" ON "CalendarIntegration"("tenantId");

-- CreateIndex
CREATE INDEX "CalendarIntegration_psychologistId_idx" ON "CalendarIntegration"("psychologistId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarIntegration_tenantId_psychologistId_provider_key" ON "CalendarIntegration"("tenantId", "psychologistId", "provider");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_tenantId_idx" ON "ExternalCalendarEvent"("tenantId");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_psychologistId_idx" ON "ExternalCalendarEvent"("psychologistId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCalendarEvent_calendarIntegrationId_googleEventId_key" ON "ExternalCalendarEvent"("calendarIntegrationId", "googleEventId");

-- AddForeignKey
ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarEvent" ADD CONSTRAINT "ExternalCalendarEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarEvent" ADD CONSTRAINT "ExternalCalendarEvent_calendarIntegrationId_fkey" FOREIGN KEY ("calendarIntegrationId") REFERENCES "CalendarIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
