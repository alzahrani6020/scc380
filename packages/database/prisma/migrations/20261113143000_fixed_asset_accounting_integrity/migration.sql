-- Fixed-asset accounting integrity.
-- Data-safe: no business rows are modified or deleted.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "fixed_assets"
    WHERE "code" IS NOT NULL
    GROUP BY "tenantId", "code"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate fixed asset code exists within a tenant';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "depreciation_entries"
    GROUP BY "assetId", "period"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate depreciation entries exist for an asset period';
  END IF;
END
$$;

DROP INDEX IF EXISTS "fixed_assets_code_key";

CREATE UNIQUE INDEX IF NOT EXISTS "fixed_assets_tenantId_code_key"
ON "fixed_assets"("tenantId","code");

CREATE UNIQUE INDEX IF NOT EXISTS "depreciation_entries_assetId_period_key"
ON "depreciation_entries"("assetId","period");
