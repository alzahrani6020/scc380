-- Read-only production inventory. Execute ONLY using approved least-privilege access.
-- No tenant data is selected. Missing _prisma_migrations deliberately fails closed.
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS database_name,
       current_setting('server_version') AS postgres_version;
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
('properties','units','lease_contracts','rent_payments','rent_collections',
 'contract_documents','property_expenses','_prisma_migrations')
ORDER BY table_name;
SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN
('properties','units','lease_contracts','rent_payments','rent_collections',
 'contract_documents','property_expenses')
ORDER BY table_name,ordinal_position;
SELECT rel.relname AS table_name, con.conname AS constraint_name,
       con.contype AS constraint_type, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid=con.conrelid
JOIN pg_namespace ns ON ns.oid=rel.relnamespace
WHERE ns.nspname='public' AND rel.relname IN
('properties','units','lease_contracts','rent_payments','rent_collections',
 'contract_documents','property_expenses')
ORDER BY rel.relname,con.conname;
SELECT tablename,indexname,indexdef
FROM pg_indexes WHERE schemaname='public'
AND tablename IN ('properties','units','lease_contracts','rent_payments',
 'rent_collections','contract_documents','property_expenses')
ORDER BY tablename,indexname;
SELECT migration_name,finished_at,rolled_back_at,applied_steps_count,
CASE WHEN finished_at IS NOT NULL AND rolled_back_at IS NULL THEN 'applied'
WHEN rolled_back_at IS NOT NULL THEN 'rolled_back' ELSE 'incomplete' END AS migration_state
FROM public._prisma_migrations ORDER BY started_at;
ROLLBACK;
