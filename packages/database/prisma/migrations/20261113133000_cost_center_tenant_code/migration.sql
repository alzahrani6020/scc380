-- Reconcile cost centers on fresh databases and scope codes per tenant.
-- Data-safe: no business rows are modified or deleted.

CREATE TABLE IF NOT EXISTS "cost_centers" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "type" TEXT NOT NULL DEFAULT 'DEPARTMENT',
  "budget" DECIMAL(18,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "cost_centers"
    WHERE "code" IS NOT NULL
    GROUP BY "tenantId", "code"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate cost center code exists within a tenant';
  END IF;
END
$$;

DROP INDEX IF EXISTS "cost_centers_code_key";

CREATE UNIQUE INDEX IF NOT EXISTS "cost_centers_tenantId_code_key"
ON "cost_centers"("tenantId","code");

CREATE INDEX IF NOT EXISTS "cost_centers_tenantId_idx"
ON "cost_centers"("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cost_centers_tenantId_fkey'
  ) THEN
    ALTER TABLE "cost_centers"
      ADD CONSTRAINT "cost_centers_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public.journal_entry_lines') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'journal_entry_lines_costCenterId_fkey'
     ) THEN
    ALTER TABLE "journal_entry_lines"
      ADD CONSTRAINT "journal_entry_lines_costCenterId_fkey"
      FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
