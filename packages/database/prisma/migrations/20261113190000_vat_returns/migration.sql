-- VAT return lifecycle and settlement configuration.
-- Additive only; no existing business rows are modified.

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "vatSettlementPayableAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "vatSettlementReceivableAccountId" TEXT;

DO $$ BEGIN
  CREATE TYPE "VatReturnStatus" AS ENUM ('DRAFT', 'FILED', 'SETTLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "vat_returns" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" "VatReturnStatus" NOT NULL DEFAULT 'DRAFT',
  "outputVat" DECIMAL(18,2),
  "inputVat" DECIMAL(18,2),
  "netVat" DECIMAL(18,2),
  "filedAt" TIMESTAMP(3),
  "filedBy" TEXT,
  "settlementVersion" INTEGER NOT NULL DEFAULT 0,
  "settlementJournalId" TEXT,
  "reversalJournalId" TEXT,
  "settledAt" TIMESTAMP(3),
  "settledBy" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vat_returns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vat_returns_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "vat_returns_tenantId_periodStart_periodEnd_key"
ON "vat_returns"("tenantId","periodStart","periodEnd");

CREATE INDEX IF NOT EXISTS "vat_returns_tenantId_status_idx"
ON "vat_returns"("tenantId","status");

CREATE INDEX IF NOT EXISTS "vat_returns_tenantId_periodStart_periodEnd_idx"
ON "vat_returns"("tenantId","periodStart","periodEnd");
