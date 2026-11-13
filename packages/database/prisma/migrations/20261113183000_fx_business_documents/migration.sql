-- FX-aware AR/AP business documents and settlements.
-- Additive only. Existing rows remain unchanged and preserve current semantics.

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "fxGainAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "fxLossAccountId" TEXT;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(18,8),
  ADD COLUMN IF NOT EXISTS "baseTotal" DECIMAL(18,2);

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(18,8),
  ADD COLUMN IF NOT EXISTS "baseAmount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "realizedFxDifference" DECIMAL(18,2);

ALTER TABLE "supplier_invoices"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(18,8),
  ADD COLUMN IF NOT EXISTS "baseTotal" DECIMAL(18,2);

ALTER TABLE "supplier_payments"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(18,8),
  ADD COLUMN IF NOT EXISTS "baseAmount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "realizedFxDifference" DECIMAL(18,2);

CREATE INDEX IF NOT EXISTS "invoices_tenantId_currency_idx"
ON "invoices"("tenantId","currency");
CREATE INDEX IF NOT EXISTS "payments_tenantId_currency_idx"
ON "payments"("tenantId","currency");
CREATE INDEX IF NOT EXISTS "supplier_invoices_tenantId_currency_idx"
ON "supplier_invoices"("tenantId","currency");
CREATE INDEX IF NOT EXISTS "supplier_payments_tenantId_currency_idx"
ON "supplier_payments"("tenantId","currency");
