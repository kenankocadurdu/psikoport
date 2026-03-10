-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('NOT_ISSUED', 'ISSUED');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "sessionFee" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "SessionPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAmount" DECIMAL(10,2),
    "paidAt" TIMESTAMP(3),
    "invoiceStatus" "InvoiceStatus" NOT NULL DEFAULT 'NOT_ISSUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "defaultSessionFee" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "reminderDays" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionPayment_appointmentId_key" ON "SessionPayment"("appointmentId");

-- CreateIndex
CREATE INDEX "SessionPayment_tenantId_idx" ON "SessionPayment"("tenantId");

-- CreateIndex
CREATE INDEX "SessionPayment_clientId_idx" ON "SessionPayment"("clientId");

-- CreateIndex
CREATE INDEX "SessionPayment_psychologistId_idx" ON "SessionPayment"("psychologistId");

-- CreateIndex
CREATE INDEX "SessionPayment_sessionDate_idx" ON "SessionPayment"("sessionDate");

-- CreateIndex
CREATE INDEX "SessionPayment_status_idx" ON "SessionPayment"("status");

-- CreateIndex
CREATE INDEX "PaymentSettings_tenantId_idx" ON "PaymentSettings"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentSettings_psychologistId_idx" ON "PaymentSettings"("psychologistId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSettings_tenantId_psychologistId_key" ON "PaymentSettings"("tenantId", "psychologistId");

-- AddForeignKey
ALTER TABLE "SessionPayment" ADD CONSTRAINT "SessionPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPayment" ADD CONSTRAINT "SessionPayment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPayment" ADD CONSTRAINT "SessionPayment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPayment" ADD CONSTRAINT "SessionPayment_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSettings" ADD CONSTRAINT "PaymentSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSettings" ADD CONSTRAINT "PaymentSettings_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
