-- Reconcile generic expense accounting schema.
-- Additive only; explicit debit/credit accounts avoid guessing the settlement model.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseCategory') THEN
    CREATE TYPE "ExpenseCategory" AS ENUM (
      'OFFICE','TRAVEL','MEALS','UTILITIES','MARKETING','SALARIES',
      'RENT','MAINTENANCE','INSURANCE','TAXES','SUPPLIES','OTHER'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseStatus') THEN
    CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING','APPROVED','REJECTED','REIMBURSED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "expenses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT DEFAULT 'SAR',
    "description" TEXT NOT NULL,
    "receiptUrl" TEXT,
    "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "debitAccountId" TEXT,
    "creditAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "debitAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "creditAccountId" TEXT;

CREATE INDEX IF NOT EXISTS "expenses_tenantId_idx" ON "expenses"("tenantId");
CREATE INDEX IF NOT EXISTS "expenses_category_idx" ON "expenses"("category");
CREATE INDEX IF NOT EXISTS "expenses_debitAccountId_idx" ON "expenses"("debitAccountId");
CREATE INDEX IF NOT EXISTS "expenses_creditAccountId_idx" ON "expenses"("creditAccountId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_tenantId_fkey') THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_debitAccountId_fkey') THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_debitAccountId_fkey"
      FOREIGN KEY ("debitAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_creditAccountId_fkey') THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_creditAccountId_fkey"
      FOREIGN KEY ("creditAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
