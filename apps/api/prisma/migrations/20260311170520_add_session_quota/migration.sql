-- CreateTable
CREATE TABLE "PlanConfig" (
    "id" TEXT NOT NULL,
    "planCode" "TenantPlan" NOT NULL,
    "monthlySessionQuota" INTEGER NOT NULL,
    "testsPerSession" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "PlanConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planCode" "TenantPlan" NOT NULL,
    "monthlySessionQuota" INTEGER NOT NULL,
    "testsPerSession" INTEGER NOT NULL DEFAULT 10,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySessionBudget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalQuota" INTEGER NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlySessionBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanConfig_planCode_createdAt_idx" ON "PlanConfig"("planCode", "createdAt");

-- CreateIndex
CREATE INDEX "TenantSubscription_tenantId_startDate_idx" ON "TenantSubscription"("tenantId", "startDate");

-- CreateIndex
CREATE INDEX "MonthlySessionBudget_tenantId_idx" ON "MonthlySessionBudget"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySessionBudget_tenantId_year_month_key" ON "MonthlySessionBudget"("tenantId", "year", "month");

-- AddForeignKey
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySessionBudget" ADD CONSTRAINT "MonthlySessionBudget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
