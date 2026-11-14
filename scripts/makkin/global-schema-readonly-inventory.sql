-- SCC380 global schema migration inventory, metadata only.
-- Works on disposable or authorized private PostgreSQL; NEVER changes data.
-- No customer rows, secrets, or credentials are selected.
-- If public._prisma_migrations is missing, the statement FAILS CLOSED.
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS database_name,
       current_setting('server_version') AS postgres_version,
       current_schema() AS active_schema;
SELECT n.nspname AS schema_name, c.relname AS object_name,
       CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned_table'
         WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view'
         ELSE c.relkind::text END AS object_type
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')
ORDER BY c.relname;
SELECT c.table_name,c.ordinal_position,c.column_name,c.udt_name,
       c.is_nullable,c.column_default,c.data_type
FROM information_schema.columns c
WHERE c.table_schema='public'
ORDER BY c.table_name,c.ordinal_position;
SELECT t.typname AS enum_name, e.enumsortorder AS value_position,
       e.enumlabel AS enum_value
FROM pg_catalog.pg_type t
JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid
JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
WHERE n.nspname='public'
ORDER BY t.typname,e.enumsortorder;
SELECT cls.relname AS table_name, con.conname AS constraint_name,
       con.contype AS constraint_type, pg_get_constraintdef(con.oid) AS definition
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class cls ON cls.oid=con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid=cls.relnamespace
WHERE n.nspname='public'
ORDER BY cls.relname,con.conname;
SELECT tablename,indexname,indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname='public'
ORDER BY tablename,indexname;
SELECT migration_name, checksum, started_at, finished_at,
       rolled_back_at, applied_steps_count,
       CASE WHEN finished_at IS NOT NULL AND rolled_back_at IS NULL THEN 'applied'
            WHEN rolled_back_at IS NOT NULL THEN 'rolled_back'
            ELSE 'incomplete' END AS migration_state
FROM public._prisma_migrations
ORDER BY started_at, migration_name;
ROLLBACK;
