-- Reconcile supplier/AP schema missing from the historical migration chain.
-- Additive only. Supplier invoice line accountId is required by auto-posting policy, but remains nullable at DB level for legacy compatibility.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupplierInvoiceStatus') THEN
    CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('UNPAID','PARTIAL','PAID','OVERDUE','CANCELLED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "suppliers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "code" TEXT NOT NULL,
    "taxNumber" TEXT,
    "commercialReg" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'SA',
    "contactName" TEXT,
    "contactPhone" TEXT,
    "paymentTerms" INTEGER NOT NULL DEFAULT 30,
    "creditLimit" DECIMAL(18,2),
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "supplier_invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "supplier_invoice_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierInvoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "supplier_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierInvoiceId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "supplier_invoice_items"
  ADD COLUMN IF NOT EXISTS "accountId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_code_key" ON "suppliers"("code");
CREATE INDEX IF NOT EXISTS "suppliers_tenantId_idx" ON "suppliers"("tenantId");
CREATE INDEX IF NOT EXISTS "suppliers_code_idx" ON "suppliers"("code");

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_invoices_invoiceNumber_key"
ON "supplier_invoices"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "supplier_invoices_tenantId_idx" ON "supplier_invoices"("tenantId");
CREATE INDEX IF NOT EXISTS "supplier_invoices_supplierId_idx" ON "supplier_invoices"("supplierId");
CREATE INDEX IF NOT EXISTS "supplier_invoices_status_idx" ON "supplier_invoices"("status");

CREATE INDEX IF NOT EXISTS "supplier_invoice_items_tenantId_idx"
ON "supplier_invoice_items"("tenantId");
CREATE INDEX IF NOT EXISTS "supplier_invoice_items_supplierInvoiceId_idx"
ON "supplier_invoice_items"("supplierInvoiceId");
CREATE INDEX IF NOT EXISTS "supplier_invoice_items_accountId_idx"
ON "supplier_invoice_items"("accountId");

CREATE INDEX IF NOT EXISTS "supplier_payments_tenantId_idx" ON "supplier_payments"("tenantId");
CREATE INDEX IF NOT EXISTS "supplier_payments_supplierId_idx" ON "supplier_payments"("supplierId");
CREATE INDEX IF NOT EXISTS "supplier_payments_supplierInvoiceId_idx"
ON "supplier_payments"("supplierInvoiceId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_tenantId_fkey') THEN
    ALTER TABLE "suppliers"
      ADD CONSTRAINT "suppliers_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_invoices_tenantId_fkey') THEN
    ALTER TABLE "supplier_invoices"
      ADD CONSTRAINT "supplier_invoices_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_invoices_supplierId_fkey') THEN
    ALTER TABLE "supplier_invoices"
      ADD CONSTRAINT "supplier_invoices_supplierId_fkey"
      FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_invoice_items_tenantId_fkey') THEN
    ALTER TABLE "supplier_invoice_items"
      ADD CONSTRAINT "supplier_invoice_items_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_invoice_items_supplierInvoiceId_fkey') THEN
    ALTER TABLE "supplier_invoice_items"
      ADD CONSTRAINT "supplier_invoice_items_supplierInvoiceId_fkey"
      FOREIGN KEY ("supplierInvoiceId") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_invoice_items_accountId_fkey') THEN
    ALTER TABLE "supplier_invoice_items"
      ADD CONSTRAINT "supplier_invoice_items_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_payments_tenantId_fkey') THEN
    ALTER TABLE "supplier_payments"
      ADD CONSTRAINT "supplier_payments_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_payments_supplierId_fkey') THEN
    ALTER TABLE "supplier_payments"
      ADD CONSTRAINT "supplier_payments_supplierId_fkey"
      FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_payments_supplierInvoiceId_fkey') THEN
    ALTER TABLE "supplier_payments"
      ADD CONSTRAINT "supplier_payments_supplierInvoiceId_fkey"
      FOREIGN KEY ("supplierInvoiceId") REFERENCES "supplier_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
