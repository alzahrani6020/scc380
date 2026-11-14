-- Additive only: append-only rent collection receipts. Never recalculate historical receivables.
CREATE TABLE "rent_collections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rentPaymentId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT,
    "transactionRef" TEXT,
    "bankReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rent_collections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rent_collections_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "rent_payments_id_tenantId_key" ON "rent_payments"("id", "tenantId");

CREATE UNIQUE INDEX "rent_collections_tenantId_idempotencyKey_key"
ON "rent_collections" ("tenantId", "idempotencyKey");
CREATE INDEX "rent_collections_tenantId_rentPaymentId_idx"
ON "rent_collections" ("tenantId", "rentPaymentId");
CREATE INDEX "rent_collections_tenantId_collectedAt_idx"
ON "rent_collections" ("tenantId", "collectedAt");

ALTER TABLE "rent_collections"
ADD CONSTRAINT "rent_collections_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rent_collections"
ADD CONSTRAINT "rent_collections_rentPaymentId_fkey"
FOREIGN KEY ("rentPaymentId", "tenantId") REFERENCES "rent_payments"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
