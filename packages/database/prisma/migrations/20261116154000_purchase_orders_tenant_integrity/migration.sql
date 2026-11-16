-- Additive repair: PurchaseOrder is present in Prisma schema but absent
-- from the result of applying the checked-in migrations to fresh PostgreSQL.
-- Verified only on disposable CI before any production migration.
DO $$ BEGIN
  CREATE TYPE public."POStatus" AS ENUM (
    'DRAFT','SENT','APPROVED','REJECTED',
    'PARTIALLY_RECEIVED','RECEIVED','CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public."purchase_orders" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "poNumber" TEXT NOT NULL,
  "vendorId" TEXT,
  "status" public."POStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal" DECIMAL(18,2) NOT NULL,
  "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,2) NOT NULL,
  "currency" TEXT DEFAULT 'SAR',
  "expectedDelivery" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_orders_poNumber_key" UNIQUE ("poNumber"),
  CONSTRAINT "purchase_orders_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES public."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_vendorId_fkey" FOREIGN KEY ("vendorId")
    REFERENCES public."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_amount_integrity" CHECK (
    "subtotal" >= 0 AND "taxAmount" >= 0 AND "total" >= 0
    AND "total" = "subtotal" + "taxAmount"
  )
);
CREATE INDEX IF NOT EXISTS "purchase_orders_tenantId_idx"
  ON public."purchase_orders"("tenantId");
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx"
  ON public."purchase_orders"("status");
