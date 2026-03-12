-- AlterTable: PlanConfig -- add formsPerSession and remindersPerSession
ALTER TABLE "PlanConfig" ADD COLUMN "formsPerSession" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PlanConfig" ADD COLUMN "remindersPerSession" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: TenantSubscription -- snapshot fields
ALTER TABLE "TenantSubscription" ADD COLUMN "formsPerSession" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TenantSubscription" ADD COLUMN "remindersPerSession" INTEGER NOT NULL DEFAULT 0;
