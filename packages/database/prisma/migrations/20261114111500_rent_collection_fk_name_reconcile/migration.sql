-- Align existing tenant-consistent rent collection FK name with Prisma conventions.
-- Naming-only change; no table rewrites, data updates, or FK recreation.
-- Production deployment remains gated on independent read-only schema inventory.
DO $rename_fk$
BEGIN
  IF to_regclass('public.rent_collections') IS NULL THEN
    RAISE EXCEPTION 'rent_collections missing: reconciliation required before FK rename';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.rent_collections'::regclass
      AND conname = 'rent_collections_rentPaymentId_tenantId_fkey'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.rent_collections'::regclass
        AND conname = 'rent_collections_rentPaymentId_fkey'
    ) THEN
      RAISE EXCEPTION 'Both rent collection FK names exist: manual reconciliation required';
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.rent_collections'::regclass
      AND conname = 'rent_collections_rentPaymentId_fkey'
      AND contype = 'f'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.rent_collections'::regclass AND attname = 'rentPaymentId'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.rent_collections'::regclass AND attname = 'tenantId')
      ]::smallint[]
  ) THEN
    ALTER TABLE public.rent_collections
      RENAME CONSTRAINT "rent_collections_rentPaymentId_fkey"
      TO "rent_collections_rentPaymentId_tenantId_fkey";
  ELSE
    RAISE EXCEPTION 'Expected tenant-consistent rent FK not found: reconciliation required';
  END IF;
END $rename_fk$;
