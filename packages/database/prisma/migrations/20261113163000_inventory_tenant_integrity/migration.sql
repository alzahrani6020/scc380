-- Multi-tenant inventory identifier integrity.
-- No business rows are modified or deleted.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "products"
    GROUP BY "tenantId","sku"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate product SKU exists within a tenant';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "products"
    WHERE "barcode" IS NOT NULL
    GROUP BY "tenantId","barcode"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate product barcode exists within a tenant';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "warehouses"
    WHERE "code" IS NOT NULL
    GROUP BY "tenantId","code"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate warehouse code exists within a tenant';
  END IF;
END
$$;

DROP INDEX IF EXISTS "products_sku_key";
DROP INDEX IF EXISTS "products_barcode_key";
DROP INDEX IF EXISTS "warehouses_code_key";

CREATE UNIQUE INDEX IF NOT EXISTS "products_tenantId_sku_key"
ON "products"("tenantId","sku");

CREATE UNIQUE INDEX IF NOT EXISTS "products_tenantId_barcode_key"
ON "products"("tenantId","barcode");

CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_tenantId_code_key"
ON "warehouses"("tenantId","code");
