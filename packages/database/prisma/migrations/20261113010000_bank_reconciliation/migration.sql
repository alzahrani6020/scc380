-- Bank reconciliation foundation.
-- Safety: additive/idempotent only. No DROP/TRUNCATE/DELETE/business-data UPDATE.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BankReconciliationStatus') THEN
    CREATE TYPE "BankReconciliationStatus" AS ENUM ('DRAFT','COMPLETED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BankStatementLineStatus') THEN
    CREATE TYPE "BankStatementLineStatus" AS ENUM ('UNMATCHED','MATCHED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "bank_accounts" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "iban" TEXT,
  "swiftCode" TEXT,
  "currency" TEXT DEFAULT 'SAR',
  "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "branchId" TEXT,
  "chartAccountId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "bank_accounts" ADD COLUMN IF NOT EXISTS "chartAccountId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "bank_accounts_accountNumber_key"
ON "bank_accounts"("accountNumber");
CREATE INDEX IF NOT EXISTS "bank_accounts_tenantId_idx"
ON "bank_accounts"("tenantId");
CREATE INDEX IF NOT EXISTS "bank_accounts_chartAccountId_idx"
ON "bank_accounts"("chartAccountId");

CREATE TABLE IF NOT EXISTS "bank_reconciliations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bankAccountId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "openingBalance" DECIMAL(18,2) NOT NULL,
  "endingBalance" DECIMAL(18,2) NOT NULL,
  "ledgerBalance" DECIMAL(18,2),
  "difference" DECIMAL(18,2),
  "status" "BankReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_reconciliations_tenantId_bankAccountId_endDate_key"
ON "bank_reconciliations"("tenantId","bankAccountId","endDate");
CREATE INDEX IF NOT EXISTS "bank_reconciliations_tenantId_idx"
ON "bank_reconciliations"("tenantId");
CREATE INDEX IF NOT EXISTS "bank_reconciliations_bankAccountId_idx"
ON "bank_reconciliations"("bankAccountId");

CREATE TABLE IF NOT EXISTS "bank_statement_lines" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reconciliationId" TEXT NOT NULL,
  "bankAccountId" TEXT NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "reference" TEXT,
  "description" TEXT,
  "externalId" TEXT,
  "status" "BankStatementLineStatus" NOT NULL DEFAULT 'UNMATCHED',
  "matchedJournalEntryLineId" TEXT,
  "matchedLegacyJournalEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_statement_lines_tenantId_bankAccountId_externalId_key"
ON "bank_statement_lines"("tenantId","bankAccountId","externalId");
CREATE INDEX IF NOT EXISTS "bank_statement_lines_tenantId_idx"
ON "bank_statement_lines"("tenantId");
CREATE INDEX IF NOT EXISTS "bank_statement_lines_reconciliationId_idx"
ON "bank_statement_lines"("reconciliationId");
CREATE INDEX IF NOT EXISTS "bank_statement_lines_bankAccountId_idx"
ON "bank_statement_lines"("bankAccountId");
CREATE INDEX IF NOT EXISTS "bank_statement_lines_status_idx"
ON "bank_statement_lines"("status");
CREATE INDEX IF NOT EXISTS "bank_statement_lines_matchedJournalEntryLineId_idx"
ON "bank_statement_lines"("matchedJournalEntryLineId");
CREATE INDEX IF NOT EXISTS "bank_statement_lines_matchedLegacyJournalEntryId_idx"
ON "bank_statement_lines"("matchedLegacyJournalEntryId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bank_accounts_tenantId_fkey') THEN
    ALTER TABLE "bank_accounts"
      ADD CONSTRAINT "bank_accounts_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public.branches') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bank_accounts_branchId_fkey') THEN
    ALTER TABLE "bank_accounts"
      ADD CONSTRAINT "bank_accounts_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bank_accounts_chartAccountId_fkey') THEN
    ALTER TABLE "bank_accounts"
      ADD CONSTRAINT "bank_accounts_chartAccountId_fkey"
      FOREIGN KEY ("chartAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bank_reconciliations_tenantId_fkey') THEN
    ALTER TABLE "bank_reconciliations"
      ADD CONSTRAINT "bank_reconciliations_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bank_reconciliations_bankAccountId_fkey') THEN
    ALTER TABLE "bank_reconciliations"
      ADD CONSTRAINT "bank_reconciliations_bankAccountId_fkey"
      FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bank_statement_lines_tenantId_fkey') THEN
    ALTER TABLE "bank_statement_lines"
      ADD CONSTRAINT "bank_statement_lines_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bank_statement_lines_reconciliationId_fkey') THEN
    ALTER TABLE "bank_statement_lines"
      ADD CONSTRAINT "bank_statement_lines_reconciliationId_fkey"
      FOREIGN KEY ("reconciliationId") REFERENCES "bank_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bank_statement_lines_bankAccountId_fkey') THEN
    ALTER TABLE "bank_statement_lines"
      ADD CONSTRAINT "bank_statement_lines_bankAccountId_fkey"
      FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bank_statement_lines_matchedJournalEntryLineId_fkey') THEN
    ALTER TABLE "bank_statement_lines"
      ADD CONSTRAINT "bank_statement_lines_matchedJournalEntryLineId_fkey"
      FOREIGN KEY ("matchedJournalEntryLineId") REFERENCES "journal_entry_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bank_statement_lines_matchedLegacyJournalEntryId_fkey') THEN
    ALTER TABLE "bank_statement_lines"
      ADD CONSTRAINT "bank_statement_lines_matchedLegacyJournalEntryId_fkey"
      FOREIGN KEY ("matchedLegacyJournalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
