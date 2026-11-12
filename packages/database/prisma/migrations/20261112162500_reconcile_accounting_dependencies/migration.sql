-- Reconcile core accounting dependencies that are present in Prisma schema but absent from the historical migration chain.
-- Additive only. Existing production tables are never rewritten.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountType') THEN
    CREATE TYPE "AccountType" AS ENUM ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "chart_of_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "parentId" TEXT,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chart_of_accounts_tenantId_code_key"
ON "chart_of_accounts"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "chart_of_accounts_tenantId_idx"
ON "chart_of_accounts"("tenantId");

CREATE TABLE IF NOT EXISTS "financial_periods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "financial_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "financial_periods_tenantId_year_month_key"
ON "financial_periods"("tenantId", "year", "month");
CREATE INDEX IF NOT EXISTS "financial_periods_tenantId_idx"
ON "financial_periods"("tenantId");

CREATE TABLE IF NOT EXISTS "journal_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "debitAmount" DECIMAL(18,2) NOT NULL,
    "creditAmount" DECIMAL(18,2) NOT NULL,
    "accountId" TEXT,
    "type" "JournalType" NOT NULL DEFAULT 'GENERAL',
    "status" "JournalStatus" NOT NULL DEFAULT 'POSTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_entryNumber_key"
ON "journal_entries"("entryNumber");
CREATE INDEX IF NOT EXISTS "journal_entries_tenantId_idx"
ON "journal_entries"("tenantId");
CREATE INDEX IF NOT EXISTS "journal_entries_date_idx"
ON "journal_entries"("date");
CREATE INDEX IF NOT EXISTS "journal_entries_accountId_idx"
ON "journal_entries"("accountId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chart_of_accounts_tenantId_fkey') THEN
    ALTER TABLE "chart_of_accounts"
      ADD CONSTRAINT "chart_of_accounts_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_periods_tenantId_fkey') THEN
    ALTER TABLE "financial_periods"
      ADD CONSTRAINT "financial_periods_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_tenantId_fkey') THEN
    ALTER TABLE "journal_entries"
      ADD CONSTRAINT "journal_entries_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_accountId_fkey') THEN
    ALTER TABLE "journal_entries"
      ADD CONSTRAINT "journal_entries_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entry_lines_accountId_fkey') THEN
    ALTER TABLE "journal_entry_lines"
      ADD CONSTRAINT "journal_entry_lines_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
