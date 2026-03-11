-- AlterTable: PlanConfig — add monthlyPrice, trialDays, updatedAt
ALTER TABLE "PlanConfig" ADD COLUMN "monthlyPrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlanConfig" ADD COLUMN "trialDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlanConfig" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
