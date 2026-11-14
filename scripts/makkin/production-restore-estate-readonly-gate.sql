-- Makkin SCC380: READ-ONLY estate migration preflight for an OFFLINE restore.
-- Never run on production for migration execution. No DDL, no DML.
\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS reviewed_database, current_user AS reviewed_user,
       current_setting('server_version') AS postgres_version;
SELECT required.name AS object_name,
       to_regclass('public.' || required.name) IS NOT NULL AS exists_in_restored_schema
FROM (VALUES ('properties'),('units'),('lease_contracts'),('rent_payments'),
             ('rent_collections'),('contract_documents'),('property_expenses'),
             ('tenants')) AS required(name)
ORDER BY required.name;
SELECT migration_name,
       CASE WHEN finished_at IS NOT NULL THEN 'applied'
            WHEN rolled_back_at IS NOT NULL THEN 'rolled_back'
            ELSE 'unfinished' END AS migration_state
FROM public._prisma_migrations
WHERE migration_name LIKE '%real_estate%'
   OR migration_name LIKE '%rent_collection%'
ORDER BY started_at;
SELECT tablename,indexname,indexdef
FROM pg_indexes
WHERE schemaname='public'
  AND indexname IN (
    'invoices_tenantId_currency_idx',
    'journal_entry_headers_transactionCurrency_idx',
    'payments_tenantId_currency_idx',
    'supplier_invoices_tenantId_currency_idx',
    'supplier_payments_tenantId_currency_idx',
    'rent_payments_id_tenantId_key',
    'rent_collections_tenantId_idempotencyKey_key',
    'rent_collections_tenantId_rentPaymentId_idx',
    'rent_collections_tenantId_collectedAt_idx')
ORDER BY tablename,indexname;
SELECT table_name,column_name,column_default
FROM information_schema.columns
WHERE table_schema='public' AND column_name='updatedAt'
  AND table_name IN ('accounting_schedules','budget_lines','budget_plans',
                     'exchange_rates','vat_returns')
ORDER BY table_name;
SELECT c.conrelid::regclass::text AS table_name, c.conname,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.conrelid IN (
    SELECT oid FROM pg_class
    WHERE oid=to_regclass('public.rent_collections')
       OR oid=to_regclass('public.rent_payments'))
ORDER BY 1,2;
SELECT t.typname AS enum_name, e.enumlabel AS enum_value
FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
JOIN pg_namespace n ON n.oid=t.typnamespace
WHERE n.nspname='public' AND t.typname IN ('PaymentStatus','LeaseStatus')
ORDER BY t.typname,e.enumsortorder;
ROLLBACK;
