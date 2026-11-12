-- Reconcile Payment persistence required by finance/accounting services.
-- Safety: additive/idempotent only. No DROP/TRUNCATE/DELETE/business-data UPDATE.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
    CREATE TYPE "PaymentMethod" AS ENUM (
      'CASH',
      'BANK_TRANSFER',
      'CREDIT_CARD',
      'DEBIT_CARD',
      'CHECK',
      'ONLINE',
      'SADAD',
      'APPLE_PAY',
      'STC_PAY'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
    CREATE TYPE "PaymentStatus" AS ENUM (
      'PENDING',
      'COMPLETED',
      'FAILED',
      'REFUNDED'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "payments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT DEFAULT 'SAR',
  "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
  "reference" TEXT,
  "notes" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(18,2);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'SAR';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "method" "PaymentMethod" DEFAULT 'CASH';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "status" "PaymentStatus" DEFAULT 'COMPLETED';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "payments_tenantId_idx"
ON "payments"("tenantId");

CREATE INDEX IF NOT EXISTS "payments_invoiceId_idx"
ON "payments"("invoiceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_tenantId_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_invoiceId_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
