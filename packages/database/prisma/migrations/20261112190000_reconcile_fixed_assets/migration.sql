-- Reconcile fixed-asset models that existed in Prisma schema but were missing
-- from the historical migration chain. All operations are additive/idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DepreciationMethod') THEN
    CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE','DECLINING_BALANCE','UNITS_OF_PRODUCTION');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssetStatus') THEN
    CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE','DISPOSED','SOLD','FULLY_DEPRECIATED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "fixed_asset_categories" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "depreciationRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "usefulLifeYears" INTEGER NOT NULL DEFAULT 5,
  "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fixed_asset_categories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "fixed_asset_categories"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "depreciationRate" DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "usefulLifeYears" INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "depreciationMethod" "DepreciationMethod" DEFAULT 'STRAIGHT_LINE',
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "fixed_assets" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "categoryId" TEXT NOT NULL,
  "acquisitionCost" DECIMAL(18,2) NOT NULL,
  "salvageValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "usefulLifeYears" INTEGER NOT NULL DEFAULT 5,
  "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
  "purchaseDate" TIMESTAMP(3) NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
  "accumulatedDepreciation" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "currentValue" DECIMAL(18,2) NOT NULL,
  "location" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "fixed_assets"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "acquisitionCost" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "salvageValue" DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "usefulLifeYears" INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "depreciationMethod" "DepreciationMethod" DEFAULT 'STRAIGHT_LINE',
  ADD COLUMN IF NOT EXISTS "purchaseDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "status" "AssetStatus" DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "accumulatedDepreciation" DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currentValue" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "depreciation_entries" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "depreciationAmount" DECIMAL(18,2) NOT NULL,
  "accumulatedDepreciation" DECIMAL(18,2) NOT NULL,
  "bookValue" DECIMAL(18,2) NOT NULL,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "depreciation_entries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "depreciation_entries"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "assetId" TEXT,
  ADD COLUMN IF NOT EXISTS "period" TEXT,
  ADD COLUMN IF NOT EXISTS "depreciationAmount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "accumulatedDepreciation" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "bookValue" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "fixed_asset_categories_tenantId_idx" ON "fixed_asset_categories"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "fixed_assets_code_key" ON "fixed_assets"("code");
CREATE INDEX IF NOT EXISTS "fixed_assets_tenantId_idx" ON "fixed_assets"("tenantId");
CREATE INDEX IF NOT EXISTS "fixed_assets_categoryId_idx" ON "fixed_assets"("categoryId");
CREATE INDEX IF NOT EXISTS "depreciation_entries_tenantId_idx" ON "depreciation_entries"("tenantId");
CREATE INDEX IF NOT EXISTS "depreciation_entries_assetId_idx" ON "depreciation_entries"("assetId");
CREATE INDEX IF NOT EXISTS "depreciation_entries_period_idx" ON "depreciation_entries"("period");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fixed_asset_categories_tenantId_fkey') THEN
    ALTER TABLE "fixed_asset_categories"
      ADD CONSTRAINT "fixed_asset_categories_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fixed_assets_tenantId_fkey') THEN
    ALTER TABLE "fixed_assets"
      ADD CONSTRAINT "fixed_assets_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fixed_assets_categoryId_fkey') THEN
    ALTER TABLE "fixed_assets"
      ADD CONSTRAINT "fixed_assets_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "fixed_asset_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'depreciation_entries_tenantId_fkey') THEN
    ALTER TABLE "depreciation_entries"
      ADD CONSTRAINT "depreciation_entries_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'depreciation_entries_assetId_fkey') THEN
    ALTER TABLE "depreciation_entries"
      ADD CONSTRAINT "depreciation_entries_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
