-- Scope cost-center codes per tenant instead of globally.
-- Data-safe schema change: no business rows are modified or deleted.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "cost_centers"
    WHERE "code" IS NOT NULL
    GROUP BY "tenantId", "code"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate cost center code exists within a tenant';
  END IF;
END
$$;

DROP INDEX IF EXISTS "cost_centers_code_key";

CREATE UNIQUE INDEX IF NOT EXISTS "cost_centers_tenantId_code_key"
ON "cost_centers"("tenantId","code");
