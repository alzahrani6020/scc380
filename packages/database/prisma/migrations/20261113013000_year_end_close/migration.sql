-- Auditable year-end close records.
-- Safety: additive/idempotent only. No DROP/TRUNCATE/DELETE/business-data UPDATE.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'YearEndCloseStatus') THEN
    CREATE TYPE "YearEndCloseStatus" AS ENUM ('CLOSED','REVERSED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "year_end_closes" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "retainedEarningsAccountId" TEXT NOT NULL,
  "netIncome" DECIMAL(18,2) NOT NULL,
  "status" "YearEndCloseStatus" NOT NULL DEFAULT 'CLOSED',
  "closingJournalId" TEXT,
  "reversalJournalId" TEXT,
  "closedBy" TEXT,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedBy" TEXT,
  "reversedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "year_end_closes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "year_end_closes_tenantId_year_key"
ON "year_end_closes"("tenantId","year");
CREATE UNIQUE INDEX IF NOT EXISTS "year_end_closes_closingJournalId_key"
ON "year_end_closes"("closingJournalId");
CREATE UNIQUE INDEX IF NOT EXISTS "year_end_closes_reversalJournalId_key"
ON "year_end_closes"("reversalJournalId");
CREATE INDEX IF NOT EXISTS "year_end_closes_tenantId_idx"
ON "year_end_closes"("tenantId");
CREATE INDEX IF NOT EXISTS "year_end_closes_status_idx"
ON "year_end_closes"("status");
CREATE INDEX IF NOT EXISTS "year_end_closes_retainedEarningsAccountId_idx"
ON "year_end_closes"("retainedEarningsAccountId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='year_end_closes_tenantId_fkey') THEN
    ALTER TABLE "year_end_closes"
      ADD CONSTRAINT "year_end_closes_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='year_end_closes_retainedEarningsAccountId_fkey') THEN
    ALTER TABLE "year_end_closes"
      ADD CONSTRAINT "year_end_closes_retainedEarningsAccountId_fkey"
      FOREIGN KEY ("retainedEarningsAccountId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='year_end_closes_closingJournalId_fkey') THEN
    ALTER TABLE "year_end_closes"
      ADD CONSTRAINT "year_end_closes_closingJournalId_fkey"
      FOREIGN KEY ("closingJournalId") REFERENCES "journal_entry_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='year_end_closes_reversalJournalId_fkey') THEN
    ALTER TABLE "year_end_closes"
      ADD CONSTRAINT "year_end_closes_reversalJournalId_fkey"
      FOREIGN KEY ("reversalJournalId") REFERENCES "journal_entry_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
