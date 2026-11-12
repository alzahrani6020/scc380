-- Wave 2: additive accounting-core tables.
-- Safety: no DROP, TRUNCATE, DELETE, UPDATE, or legacy journal mutation.
-- Compatibility: historical migrations do not create the later finance schema on a fresh DB,
-- so enum types and optional finance-dimension foreign keys are created conditionally.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JournalType') THEN
    CREATE TYPE "JournalType" AS ENUM ('GENERAL', 'ADJUSTING', 'CLOSING', 'REVERSING');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JournalStatus') THEN
    CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');
  END IF;
END
$$;


CREATE TABLE "journal_entry_headers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "type" "JournalType" NOT NULL DEFAULT 'GENERAL',
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "reversalOfId" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entry_headers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journal_entry_lines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "debitAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "costCenterId" TEXT,
    "projectId" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "journal_entry_lines_amount_check"
      CHECK (
        "debitAmount" >= 0
        AND "creditAmount" >= 0
        AND (
          ("debitAmount" > 0 AND "creditAmount" = 0)
          OR ("creditAmount" > 0 AND "debitAmount" = 0)
        )
      )
);

CREATE UNIQUE INDEX "journal_entry_headers_tenantId_entryNumber_key"
ON "journal_entry_headers"("tenantId", "entryNumber");

CREATE UNIQUE INDEX "journal_entry_headers_tenantId_sourceType_sourceId_key"
ON "journal_entry_headers"("tenantId", "sourceType", "sourceId");

CREATE INDEX "journal_entry_headers_tenantId_date_idx"
ON "journal_entry_headers"("tenantId", "date");

CREATE INDEX "journal_entry_headers_tenantId_status_idx"
ON "journal_entry_headers"("tenantId", "status");

CREATE INDEX "journal_entry_headers_reversalOfId_idx"
ON "journal_entry_headers"("reversalOfId");

CREATE UNIQUE INDEX "journal_entry_lines_journalEntryId_lineNumber_key"
ON "journal_entry_lines"("journalEntryId", "lineNumber");

CREATE INDEX "journal_entry_lines_tenantId_idx"
ON "journal_entry_lines"("tenantId");

CREATE INDEX "journal_entry_lines_accountId_idx"
ON "journal_entry_lines"("accountId");

CREATE INDEX "journal_entry_lines_costCenterId_idx"
ON "journal_entry_lines"("costCenterId");

CREATE INDEX "journal_entry_lines_projectId_idx"
ON "journal_entry_lines"("projectId");

CREATE INDEX "journal_entry_lines_branchId_idx"
ON "journal_entry_lines"("branchId");

ALTER TABLE "journal_entry_headers"
ADD CONSTRAINT "journal_entry_headers_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_entry_headers"
ADD CONSTRAINT "journal_entry_headers_reversalOfId_fkey"
FOREIGN KEY ("reversalOfId") REFERENCES "journal_entry_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "journal_entry_lines"
ADD CONSTRAINT "journal_entry_lines_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_entry_lines"
ADD CONSTRAINT "journal_entry_lines_journalEntryId_fkey"
FOREIGN KEY ("journalEntryId") REFERENCES "journal_entry_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  IF to_regclass('public.chart_of_accounts') IS NOT NULL THEN
    ALTER TABLE "journal_entry_lines"
      ADD CONSTRAINT "journal_entry_lines_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public.cost_centers') IS NOT NULL THEN
    ALTER TABLE "journal_entry_lines"
      ADD CONSTRAINT "journal_entry_lines_costCenterId_fkey"
      FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public.projects') IS NOT NULL THEN
    ALTER TABLE "journal_entry_lines"
      ADD CONSTRAINT "journal_entry_lines_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public.branches') IS NOT NULL THEN
    ALTER TABLE "journal_entry_lines"
      ADD CONSTRAINT "journal_entry_lines_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
