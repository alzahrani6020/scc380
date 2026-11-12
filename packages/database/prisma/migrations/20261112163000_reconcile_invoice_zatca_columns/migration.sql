-- Reconcile Invoice columns that exist in Prisma schema but are absent from the historical migration chain.
-- Additive only: no data rewrite, no DROP/DELETE/TRUNCATE.

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "zatcaSignedXml" TEXT,
  ADD COLUMN IF NOT EXISTS "previousInvoiceHash" TEXT,
  ADD COLUMN IF NOT EXISTS "digitalSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "qrCodeData" TEXT,
  ADD COLUMN IF NOT EXISTS "clearanceStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "reportingStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "retentionUntil" TIMESTAMP(3);
