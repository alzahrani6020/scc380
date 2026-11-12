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


-- InvoiceItem drift: Prisma schema includes optional productId but historical migrations do not.
ALTER TABLE "invoice_items"
  ADD COLUMN IF NOT EXISTS "productId" TEXT;

CREATE INDEX IF NOT EXISTS "invoice_items_productId_idx"
ON "invoice_items"("productId");

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_productId_fkey'
     ) THEN
    ALTER TABLE "invoice_items"
      ADD CONSTRAINT "invoice_items_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
