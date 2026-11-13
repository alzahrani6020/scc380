-- Annual/monthly accounting budgets.
-- Additive migration only. No existing business rows are modified or deleted.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BudgetStatus') THEN
    CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT','APPROVED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "budget_plans" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "notes" TEXT,
  "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "budget_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "budget_lines" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "accountId" TEXT NOT NULL,
  "costCenterId" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "budget_lines_month_check" CHECK ("month" BETWEEN 1 AND 12),
  CONSTRAINT "budget_lines_amount_check" CHECK ("amount" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "budget_plans_tenantId_year_key"
ON "budget_plans"("tenantId","year");

CREATE INDEX IF NOT EXISTS "budget_plans_tenantId_idx" ON "budget_plans"("tenantId");
CREATE INDEX IF NOT EXISTS "budget_plans_status_idx" ON "budget_plans"("status");
CREATE INDEX IF NOT EXISTS "budget_lines_tenantId_idx" ON "budget_lines"("tenantId");
CREATE INDEX IF NOT EXISTS "budget_lines_planId_idx" ON "budget_lines"("planId");
CREATE INDEX IF NOT EXISTS "budget_lines_accountId_idx" ON "budget_lines"("accountId");
CREATE INDEX IF NOT EXISTS "budget_lines_costCenterId_idx" ON "budget_lines"("costCenterId");
CREATE INDEX IF NOT EXISTS "budget_lines_month_idx" ON "budget_lines"("month");

CREATE UNIQUE INDEX IF NOT EXISTS "budget_lines_total_account_month_key"
ON "budget_lines"("planId","month","accountId")
WHERE "costCenterId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "budget_lines_cost_center_account_month_key"
ON "budget_lines"("planId","month","accountId","costCenterId")
WHERE "costCenterId" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='budget_plans_tenantId_fkey') THEN
    ALTER TABLE "budget_plans"
      ADD CONSTRAINT "budget_plans_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='budget_lines_tenantId_fkey') THEN
    ALTER TABLE "budget_lines"
      ADD CONSTRAINT "budget_lines_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='budget_lines_planId_fkey') THEN
    ALTER TABLE "budget_lines"
      ADD CONSTRAINT "budget_lines_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "budget_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='budget_lines_accountId_fkey') THEN
    ALTER TABLE "budget_lines"
      ADD CONSTRAINT "budget_lines_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='budget_lines_costCenterId_fkey') THEN
    ALTER TABLE "budget_lines"
      ADD CONSTRAINT "budget_lines_costCenterId_fkey"
      FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
