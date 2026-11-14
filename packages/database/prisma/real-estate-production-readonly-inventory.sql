-- SCC380 real estate schema inventory: read-only metadata, no tenant records.
-- Run only through an approved private connection with least-privilege read access.
-- Do not apply migrations or db push to production based on this report alone.
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS database_name,
       current_setting('server_version') AS postgres_version;
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN
 ('properties','units','lease_contracts','rent_payments','rent_collections','contract_documents','property_expenses','_prisma_migrations')
 ORDER BY table_name;
SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default
 FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN
 ('properties','units','lease_contracts','rent_payments','rent_collections','contract_documents','property_expenses')
 ORDER BY table_name,ordinal_position;
SELECT rel.relname AS table_name,c.conname AS constraint_name,
       c.contype AS constraint_type,pg_get_constraintdef(c.oid) AS definition
 FROM pg_constraint c
 JOIN pg_class rel ON rel.oid=c.conrelid
 JOIN pg_namespace n ON n.oid=rel.relnamespace
 WHERE n.nspname='public' AND rel.relname IN
 ('properties','units','lease_contracts','rent_payments','rent_collections','contract_documents','property_expenses')
 ORDER BY rel.relname,c.conname;
SELECT tablename,indexname,indexdef FROM pg_indexes
 WHERE schemaname='public' AND tablename IN
 ('properties','units','lease_contracts','rent_payments','rent_collections','contract_documents','property_expenses')
 ORDER BY tablename,indexname;
-- Requires _prisma_migrations to exist; failure means migration history is UNKNOWN, not safe.
SELECT migration_name,finished_at,rolled_back_at,applied_steps_count,
       CASE WHEN finished_at IS NOT NULL AND rolled_back_at IS NULL THEN 'applied'
            WHEN rolled_back_at IS NOT NULL THEN 'rolled_back'
            ELSE 'incomplete' END AS migration_state
 FROM public._prisma_migrations ORDER BY started_at;
ROLLBACK;
