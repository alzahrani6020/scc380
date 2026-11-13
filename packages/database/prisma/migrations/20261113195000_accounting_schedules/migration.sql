-- Recurring journals, accruals, and prepaid recognition schedules.
-- Additive only: new enums/tables/indexes; no existing business data is modified.

DO $$ BEGIN
  CREATE TYPE "AccountingScheduleKind" AS ENUM ('RECURRING', 'ACCRUAL', 'PREPAID');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AccountingScheduleFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AccountingScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AccountingScheduleRunStatus" AS ENUM ('POSTED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "accounting_schedules" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "AccountingScheduleKind" NOT NULL,
  "frequency" "AccountingScheduleFrequency" NOT NULL,
  "status" "AccountingScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "nextRunDate" TIMESTAMP(3) NOT NULL,
  "anchorDay" INTEGER NOT NULL,
  "autoReverse" BOOLEAN NOT NULL DEFAULT false,
  "reverseAfterDays" INTEGER NOT NULL DEFAULT 1,
  "entryPrefix" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdBy" TEXT,
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounting_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounting_schedules_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "accounting_schedule_lines" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "accountId" TEXT NOT NULL,
  "debitAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "creditAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "description" TEXT,
  "costCenterId" TEXT,
  "projectId" TEXT,
  "branchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounting_schedule_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounting_schedule_lines_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "accounting_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "accounting_schedule_runs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "scheduledDate" TIMESTAMP(3) NOT NULL,
  "status" "AccountingScheduleRunStatus" NOT NULL DEFAULT 'POSTED',
  "postingJournalId" TEXT NOT NULL,
  "reversalDueDate" TIMESTAMP(3),
  "reversalJournalId" TEXT,
  "snapshot" JSONB NOT NULL,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounting_schedule_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounting_schedule_runs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "accounting_schedule_runs_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "accounting_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_schedules_tenantId_entryPrefix_key"
ON "accounting_schedules"("tenantId","entryPrefix");
CREATE INDEX IF NOT EXISTS "accounting_schedules_tenantId_status_nextRunDate_idx"
ON "accounting_schedules"("tenantId","status","nextRunDate");
CREATE INDEX IF NOT EXISTS "accounting_schedules_tenantId_kind_idx"
ON "accounting_schedules"("tenantId","kind");

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_schedule_lines_scheduleId_lineNumber_key"
ON "accounting_schedule_lines"("scheduleId","lineNumber");
CREATE INDEX IF NOT EXISTS "accounting_schedule_lines_accountId_idx"
ON "accounting_schedule_lines"("accountId");
CREATE INDEX IF NOT EXISTS "accounting_schedule_lines_costCenterId_idx"
ON "accounting_schedule_lines"("costCenterId");
CREATE INDEX IF NOT EXISTS "accounting_schedule_lines_projectId_idx"
ON "accounting_schedule_lines"("projectId");
CREATE INDEX IF NOT EXISTS "accounting_schedule_lines_branchId_idx"
ON "accounting_schedule_lines"("branchId");

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_schedule_runs_scheduleId_scheduledDate_key"
ON "accounting_schedule_runs"("scheduleId","scheduledDate");
CREATE INDEX IF NOT EXISTS "accounting_schedule_runs_tenantId_scheduledDate_idx"
ON "accounting_schedule_runs"("tenantId","scheduledDate");
CREATE INDEX IF NOT EXISTS "accounting_schedule_runs_tenantId_status_reversalDueDate_idx"
ON "accounting_schedule_runs"("tenantId","status","reversalDueDate");
CREATE INDEX IF NOT EXISTS "accounting_schedule_runs_postingJournalId_idx"
ON "accounting_schedule_runs"("postingJournalId");
CREATE INDEX IF NOT EXISTS "accounting_schedule_runs_reversalJournalId_idx"
ON "accounting_schedule_runs"("reversalJournalId");
