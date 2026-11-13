-- Reconcile inventory foundation on fresh databases and enforce tenant-scoped identifiers.
-- Additive/data-safe: no business rows are modified or deleted.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StockMovementType') THEN
    CREATE TYPE "StockMovementType" AS ENUM ('IN','OUT','SALE','RETURN','ADJUSTMENT','TRANSFER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransferStatus') THEN
    CREATE TYPE "TransferStatus" AS ENUM ('PENDING','APPROVED','SHIPPED','RECEIVED','REJECTED','CANCELLED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "product_categories" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "parentId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "products" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameAr" TEXT,
  "sku" TEXT NOT NULL,
  "barcode" TEXT,
  "categoryId" TEXT,
  "unitOfMeasure" TEXT NOT NULL DEFAULT 'piece',
  "costPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "salePrice" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "wholesalePrice" DECIMAL(18,4),
  "minStockLevel" INTEGER NOT NULL DEFAULT 0,
  "currentStock" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isService" BOOLEAN NOT NULL DEFAULT false,
  "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
  "description" TEXT,
  "imageUrl" TEXT,
  "weightKg" DECIMAL(10,3),
  "dimensions" JSONB DEFAULT '{}'::jsonb,
  "supplierId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "warehouses" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "location" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "branchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "warehouseId" TEXT,
  "type" "StockMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "totalCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "reference" TEXT,
  "referenceId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stock_transfers" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "transferNumber" TEXT NOT NULL,
  "fromBranchId" TEXT NOT NULL,
  "toBranchId" TEXT NOT NULL,
  "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "requestedBy" TEXT,
  "approvedBy" TEXT,
  "shippedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stock_transfer_items" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "receivedQty" INTEGER NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "products" GROUP BY "tenantId","sku" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate product SKU exists within a tenant';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "products" WHERE "barcode" IS NOT NULL
    GROUP BY "tenantId","barcode" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate product barcode exists within a tenant';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "warehouses" WHERE "code" IS NOT NULL
    GROUP BY "tenantId","code" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate warehouse code exists within a tenant';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "stock_transfers"
    GROUP BY "tenantId","transferNumber" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate transfer number exists within a tenant';
  END IF;
END
$$;

DROP INDEX IF EXISTS "products_sku_key";
DROP INDEX IF EXISTS "products_barcode_key";
DROP INDEX IF EXISTS "warehouses_code_key";
DROP INDEX IF EXISTS "stock_transfers_transferNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS "products_tenantId_sku_key"
ON "products"("tenantId","sku");
CREATE UNIQUE INDEX IF NOT EXISTS "products_tenantId_barcode_key"
ON "products"("tenantId","barcode");
CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_tenantId_code_key"
ON "warehouses"("tenantId","code");
CREATE UNIQUE INDEX IF NOT EXISTS "stock_transfers_tenantId_transferNumber_key"
ON "stock_transfers"("tenantId","transferNumber");

CREATE INDEX IF NOT EXISTS "product_categories_tenantId_idx" ON "product_categories"("tenantId");
CREATE INDEX IF NOT EXISTS "products_tenantId_idx" ON "products"("tenantId");
CREATE INDEX IF NOT EXISTS "products_categoryId_idx" ON "products"("categoryId");
CREATE INDEX IF NOT EXISTS "products_barcode_idx" ON "products"("barcode");
CREATE INDEX IF NOT EXISTS "warehouses_tenantId_idx" ON "warehouses"("tenantId");
CREATE INDEX IF NOT EXISTS "warehouses_branchId_idx" ON "warehouses"("branchId");
CREATE INDEX IF NOT EXISTS "stock_movements_tenantId_idx" ON "stock_movements"("tenantId");
CREATE INDEX IF NOT EXISTS "stock_movements_productId_idx" ON "stock_movements"("productId");
CREATE INDEX IF NOT EXISTS "stock_movements_warehouseId_idx" ON "stock_movements"("warehouseId");
CREATE INDEX IF NOT EXISTS "stock_movements_type_idx" ON "stock_movements"("type");
CREATE INDEX IF NOT EXISTS "stock_transfers_tenantId_idx" ON "stock_transfers"("tenantId");
CREATE INDEX IF NOT EXISTS "stock_transfers_status_idx" ON "stock_transfers"("status");
CREATE INDEX IF NOT EXISTS "stock_transfer_items_tenantId_idx" ON "stock_transfer_items"("tenantId");
CREATE INDEX IF NOT EXISTS "stock_transfer_items_transferId_idx" ON "stock_transfer_items"("transferId");
CREATE INDEX IF NOT EXISTS "stock_transfer_items_productId_idx" ON "stock_transfer_items"("productId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_categories_tenantId_fkey') THEN
    ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_tenantId_fkey') THEN
    ALTER TABLE "products" ADD CONSTRAINT "products_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_categoryId_fkey') THEN
    ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF to_regclass('public.suppliers') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_supplierId_fkey') THEN
    ALTER TABLE "products" ADD CONSTRAINT "products_supplierId_fkey"
      FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='warehouses_tenantId_fkey') THEN
    ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF to_regclass('public.branches') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='warehouses_branchId_fkey') THEN
    ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stock_movements_tenantId_fkey') THEN
    ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stock_movements_productId_fkey') THEN
    ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stock_movements_warehouseId_fkey') THEN
    ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey"
      FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stock_transfers_tenantId_fkey') THEN
    ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stock_transfer_items_tenantId_fkey') THEN
    ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stock_transfer_items_transferId_fkey') THEN
    ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transferId_fkey"
      FOREIGN KEY ("transferId") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stock_transfer_items_productId_fkey') THEN
    ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
