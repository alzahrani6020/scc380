-- POS foundational schema missing from the committed migration chain.
-- Additive only. Fail closed if a legacy/partial POS table already exists:
-- never overwrite, rename, delete, or silently adopt historical business records.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('pos_sessions','pos_orders','pos_order_items','pos_payments')
  ) THEN
    RAISE EXCEPTION 'POS_SCHEMA_PREFLIGHT_BLOCKED: existing POS tables require read-only compatibility review';
  END IF;
END $$;

CREATE TYPE "SessionStatus" AS ENUM ('OPEN','CLOSED','FORCE_CLOSED');
CREATE TYPE "PosOrderStatus" AS ENUM ('PENDING','COMPLETED','CANCELLED','REFUNDED');
CREATE TYPE "PosPaymentMethod" AS ENUM ('CASH','CARD','MADA','APPLE_PAY','STC_PAY','SADAD','WALLET','BANK_TRANSFER');

CREATE TABLE "pos_sessions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "openingCash" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "closingCash" DECIMAL(18,2),
  "expectedCash" DECIMAL(18,2),
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
  "posTerminal" TEXT,
  "notes" TEXT,
  "branchId" TEXT,
  CONSTRAINT "pos_sessions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "pos_orders" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "customerId" TEXT,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "subtotal" DECIMAL(18,2) NOT NULL,
  "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
  "taxAmount" DECIMAL(18,2) NOT NULL,
  "total" DECIMAL(18,2) NOT NULL,
  "status" "PosOrderStatus" NOT NULL DEFAULT 'COMPLETED',
  "branchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_orders_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "pos_order_items" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT,
  "productName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(18,4) NOT NULL,
  "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
  "total" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_order_items_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "pos_payments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "method" "PosPaymentMethod" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "reference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_orders_orderNumber_key" ON "pos_orders"("orderNumber");
CREATE INDEX "pos_sessions_tenantId_idx" ON "pos_sessions"("tenantId");
CREATE INDEX "pos_sessions_userId_idx" ON "pos_sessions"("userId");
CREATE INDEX "pos_sessions_status_idx" ON "pos_sessions"("status");
CREATE INDEX "pos_sessions_branchId_idx" ON "pos_sessions"("branchId");
CREATE INDEX "pos_orders_tenantId_idx" ON "pos_orders"("tenantId");
CREATE INDEX "pos_orders_sessionId_idx" ON "pos_orders"("sessionId");
CREATE INDEX "pos_orders_status_idx" ON "pos_orders"("status");
CREATE INDEX "pos_orders_branchId_idx" ON "pos_orders"("branchId");
CREATE INDEX "pos_order_items_tenantId_idx" ON "pos_order_items"("tenantId");
CREATE INDEX "pos_order_items_orderId_idx" ON "pos_order_items"("orderId");
CREATE INDEX "pos_order_items_productId_idx" ON "pos_order_items"("productId");
CREATE INDEX "pos_payments_tenantId_idx" ON "pos_payments"("tenantId");
CREATE INDEX "pos_payments_orderId_idx" ON "pos_payments"("orderId");

ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "pos_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "pos_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "pos_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
