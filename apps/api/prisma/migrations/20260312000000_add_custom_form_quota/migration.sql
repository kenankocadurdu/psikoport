-- AlterTable: PlanConfig -- add customFormQuota column
ALTER TABLE "PlanConfig" ADD COLUMN "customFormQuota" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: TenantSubscription -- add customFormQuota column (snapshot)
ALTER TABLE "TenantSubscription" ADD COLUMN "customFormQuota" INTEGER NOT NULL DEFAULT 0;
