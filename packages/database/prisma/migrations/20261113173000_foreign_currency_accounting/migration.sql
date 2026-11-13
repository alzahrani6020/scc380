-- Foreign-currency accounting foundation.
-- Additive only: existing journals retain null FX metadata and base currency defaults to SAR.

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "baseCurrency" TEXT NOT NULL DEFAULT 'SAR';

ALTER TABLE "journal_entry_headers"
  ADD COLUMN IF NOT EXISTS "transactionCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(18,8);

ALTER TABLE "journal_entry_lines"
  ADD COLUMN IF NOT EXISTS "foreignDebitAmount" DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "foreignCreditAmount" DECIMAL(18,4);

CREATE TABLE IF NOT EXISTS "exchange_rates" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fromCurrency" TEXT NOT NULL,
  "toCurrency" TEXT NOT NULL,
  "rate" DECIMAL(18,8) NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exchange_rates_rate_check" CHECK ("rate" > 0),
  CONSTRAINT "exchange_rates_distinct_currency_check" CHECK ("fromCurrency" <> "toCurrency")
);

CREATE UNIQUE INDEX IF NOT EXISTS "exchange_rates_tenantId_fromCurrency_toCurrency_effectiveDate_key"
ON "exchange_rates"("tenantId","fromCurrency","toCurrency","effectiveDate");

CREATE INDEX IF NOT EXISTS "exchange_rates_lookup_idx"
ON "exchange_rates"("tenantId","fromCurrency","toCurrency","effectiveDate");

CREATE INDEX IF NOT EXISTS "journal_entry_headers_transactionCurrency_idx"
ON "journal_entry_headers"("tenantId","transactionCurrency","date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='exchange_rates_tenantId_fkey'
  ) THEN
    ALTER TABLE "exchange_rates"
      ADD CONSTRAINT "exchange_rates_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
