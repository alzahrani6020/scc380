-- Data-preserving reconciliation: an existing complete POS schema is accepted ONLY
-- after exact metadata validation; partial or incompatible schemas fail closed.
-- The migration never drops, truncates, renames or rewrites business tables.
DO $pos_reconcile$
DECLARE
  pos_tables integer;
  mismatch integer;
BEGIN
  SELECT count(*) INTO pos_tables FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND c.relname IN ('pos_sessions','pos_orders','pos_order_items','pos_payments');
  IF pos_tables NOT IN (0,4) THEN
    RAISE EXCEPTION 'POS_SCHEMA_PREFLIGHT_BLOCKED: partial existing POS schema';
  END IF;
  IF pos_tables = 4 THEN
    -- 46 columns, including type, nullability and presence of defaults.
    WITH expected(tab,col,typ,nn,def) AS (VALUES
      ('pos_sessions','id','text',true,false),
      ('pos_sessions','tenantId','text',true,false),
      ('pos_sessions','userId','text',true,false),
      ('pos_sessions','openingCash','numeric(18,2)',true,true),
      ('pos_sessions','closingCash','numeric(18,2)',false,false),
      ('pos_sessions','expectedCash','numeric(18,2)',false,false),
      ('pos_sessions','openedAt','timestamp(3) without time zone',true,true),
      ('pos_sessions','closedAt','timestamp(3) without time zone',false,false),
      ('pos_sessions','status','"SessionStatus"',true,true),
      ('pos_sessions','posTerminal','text',false,false),
      ('pos_sessions','notes','text',false,false),
      ('pos_sessions','branchId','text',false,false),
      ('pos_orders','id','text',true,false),
      ('pos_orders','tenantId','text',true,false),
      ('pos_orders','orderNumber','text',true,false),
      ('pos_orders','sessionId','text',true,false),
      ('pos_orders','customerId','text',false,false),
      ('pos_orders','customerName','text',false,false),
      ('pos_orders','customerPhone','text',false,false),
      ('pos_orders','subtotal','numeric(18,2)',true,false),
      ('pos_orders','discount','numeric(18,2)',true,true),
      ('pos_orders','taxRate','numeric(5,2)',true,true),
      ('pos_orders','taxAmount','numeric(18,2)',true,false),
      ('pos_orders','total','numeric(18,2)',true,false),
      ('pos_orders','status','"PosOrderStatus"',true,true),
      ('pos_orders','branchId','text',false,false),
      ('pos_orders','createdAt','timestamp(3) without time zone',true,true),
      ('pos_orders','updatedAt','timestamp(3) without time zone',true,false),
      ('pos_order_items','id','text',true,false),
      ('pos_order_items','tenantId','text',true,false),
      ('pos_order_items','orderId','text',true,false),
      ('pos_order_items','productId','text',false,false),
      ('pos_order_items','productName','text',true,false),
      ('pos_order_items','quantity','integer',true,false),
      ('pos_order_items','unitPrice','numeric(18,4)',true,false),
      ('pos_order_items','discount','numeric(18,2)',true,true),
      ('pos_order_items','taxRate','numeric(5,2)',true,true),
      ('pos_order_items','total','numeric(18,2)',true,false),
      ('pos_order_items','createdAt','timestamp(3) without time zone',true,true),
      ('pos_payments','id','text',true,false),
      ('pos_payments','tenantId','text',true,false),
      ('pos_payments','orderId','text',true,false),
      ('pos_payments','method','"PosPaymentMethod"',true,false),
      ('pos_payments','amount','numeric(18,2)',true,false),
      ('pos_payments','reference','text',false,false),
      ('pos_payments','createdAt','timestamp(3) without time zone',true,true)
    ), actual AS (
      SELECT c.relname::text tab,a.attname::text col,
        pg_catalog.format_type(a.atttypid,a.atttypmod) typ,
        a.attnotnull nn,a.atthasdef def
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN
        ('pos_sessions','pos_orders','pos_order_items','pos_payments')
        AND a.attnum>0 AND NOT a.attisdropped
    )
    SELECT count(*) INTO mismatch FROM (
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
      UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    ) delta;
    IF mismatch <> 0 THEN
      RAISE EXCEPTION 'POS_SCHEMA_PREFLIGHT_BLOCKED: column definitions differ';
    END IF;
    -- Exact ordered enum labels.
    WITH expected(name,labels) AS (VALUES
      ('SessionStatus',ARRAY['OPEN','CLOSED','FORCE_CLOSED']::text[]),
      ('PosOrderStatus',ARRAY['PENDING','COMPLETED','CANCELLED','REFUNDED']::text[]),
      ('PosPaymentMethod',ARRAY['CASH','CARD','MADA','APPLE_PAY','STC_PAY','SADAD','WALLET','BANK_TRANSFER']::text[])
    ), actual AS (
      SELECT t.typname::text name,array_agg(e.enumlabel::text ORDER BY e.enumsortorder) labels
      FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
      JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid
      WHERE n.nspname='public' AND t.typname IN ('SessionStatus','PosOrderStatus','PosPaymentMethod')
      GROUP BY t.typname
    )
    SELECT count(*) INTO mismatch FROM (
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
      UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    ) delta;
    IF mismatch <> 0 THEN
      RAISE EXCEPTION 'POS_SCHEMA_PREFLIGHT_BLOCKED: enum definitions differ';
    END IF;
    -- No missing, invalid or altered named indexes, including non-unique indexes.
    WITH expected(name,tab,col,uniq) AS (VALUES
      ('pos_orders_orderNumber_key','pos_orders','orderNumber',true),
      ('pos_sessions_tenantId_idx','pos_sessions','tenantId',false),
      ('pos_sessions_userId_idx','pos_sessions','userId',false),
      ('pos_sessions_status_idx','pos_sessions','status',false),
      ('pos_sessions_branchId_idx','pos_sessions','branchId',false),
      ('pos_orders_tenantId_idx','pos_orders','tenantId',false),
      ('pos_orders_sessionId_idx','pos_orders','sessionId',false),
      ('pos_orders_status_idx','pos_orders','status',false),
      ('pos_orders_branchId_idx','pos_orders','branchId',false),
      ('pos_order_items_tenantId_idx','pos_order_items','tenantId',false),
      ('pos_order_items_orderId_idx','pos_order_items','orderId',false),
      ('pos_order_items_productId_idx','pos_order_items','productId',false),
      ('pos_payments_tenantId_idx','pos_payments','tenantId',false),
      ('pos_payments_orderId_idx','pos_payments','orderId',false)
    ), actual AS (
      SELECT ic.relname::text name,c.relname::text tab,
        a.attname::text col,i.indisunique uniq
      FROM pg_catalog.pg_index i
      JOIN pg_catalog.pg_class c ON c.oid=i.indrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_class ic ON ic.oid=i.indexrelid
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=i.indkey[0]
      WHERE n.nspname='public' AND c.relname IN
        ('pos_sessions','pos_orders','pos_order_items','pos_payments')
        AND i.indisvalid AND i.indisready AND i.indislive
        AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts=1
        AND NOT i.indisprimary
    )
    SELECT count(*) INTO mismatch FROM
      (SELECT * FROM expected EXCEPT SELECT * FROM actual) missing;
    IF mismatch <> 0 THEN
      RAISE EXCEPTION 'POS_SCHEMA_PREFLIGHT_BLOCKED: required indexes missing or different';
    END IF;
    -- The mandatory FK and PK constraints must exist, be validated and not deferrable.
    WITH expected(tab,name) AS (VALUES
      ('pos_sessions','pos_sessions_tenantId_fkey'),
      ('pos_orders','pos_orders_tenantId_fkey'),
      ('pos_orders','pos_orders_sessionId_fkey'),
      ('pos_order_items','pos_order_items_tenantId_fkey'),
      ('pos_order_items','pos_order_items_orderId_fkey'),
      ('pos_order_items','pos_order_items_productId_fkey'),
      ('pos_payments','pos_payments_tenantId_fkey'),
      ('pos_payments','pos_payments_orderId_fkey'),
      ('pos_sessions','pos_sessions_pkey'),
      ('pos_orders','pos_orders_pkey'),
      ('pos_order_items','pos_order_items_pkey'),
      ('pos_payments','pos_payments_pkey')
    ), conditional_branch(tab,name) AS (
      SELECT 'pos_sessions'::text, 'pos_sessions_branchId_fkey'::text
      WHERE to_regclass('public.branches') IS NOT NULL
      UNION ALL
      SELECT 'pos_orders'::text, 'pos_orders_branchId_fkey'::text
      WHERE to_regclass('public.branches') IS NOT NULL
    ), required AS (
      SELECT * FROM expected UNION ALL SELECT * FROM conditional_branch
    ), actual AS (
      SELECT c.relname::text tab,k.conname::text name
      FROM pg_catalog.pg_constraint k
      JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND k.convalidated AND NOT k.condeferrable
    )
    SELECT count(*) INTO mismatch FROM
      (SELECT * FROM required EXCEPT SELECT * FROM actual) missing;
    IF mismatch <> 0 THEN
      RAISE EXCEPTION 'POS_SCHEMA_PREFLIGHT_BLOCKED: required constraints missing';
    END IF;
    -- Verify defaults, not merely the existence of a default.
    WITH expected(tab,col,expression) AS (VALUES
      ('pos_sessions','openingCash','0'),
      ('pos_sessions','openedAt','CURRENT_TIMESTAMP'),
      ('pos_sessions','status','''OPEN''::"SessionStatus"'),
      ('pos_orders','discount','0'),
      ('pos_orders','taxRate','15'),
      ('pos_orders','createdAt','CURRENT_TIMESTAMP'),
      ('pos_orders','status','''COMPLETED''::"PosOrderStatus"'),
      ('pos_order_items','discount','0'),
      ('pos_order_items','taxRate','15'),
      ('pos_order_items','createdAt','CURRENT_TIMESTAMP'),
      ('pos_payments','createdAt','CURRENT_TIMESTAMP')
    ), actual AS (
      SELECT c.relname::text tab,a.attname::text col,
        pg_catalog.pg_get_expr(d.adbin,d.adrelid)::text expression
      FROM pg_catalog.pg_attrdef d
      JOIN pg_catalog.pg_class c ON c.oid=d.adrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
      WHERE n.nspname='public' AND c.relname IN
        ('pos_sessions','pos_orders','pos_order_items','pos_payments')
    )
    SELECT count(*) INTO mismatch FROM (
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
      UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    ) delta;
    IF mismatch <> 0 THEN
      RAISE EXCEPTION 'POS_SCHEMA_PREFLIGHT_BLOCKED: defaults differ';
    END IF;
    RETURN;
  END IF;

  -- All POS tables absent: construct the canonical schema once, atomically.
  EXECUTE $posddl0$CREATE TYPE "SessionStatus" AS ENUM ('OPEN','CLOSED','FORCE_CLOSED')$posddl0$;
  EXECUTE $posddl1$CREATE TYPE "PosOrderStatus" AS ENUM ('PENDING','COMPLETED','CANCELLED','REFUNDED')$posddl1$;
  EXECUTE $posddl2$CREATE TYPE "PosPaymentMethod" AS ENUM ('CASH','CARD','MADA','APPLE_PAY','STC_PAY','SADAD','WALLET','BANK_TRANSFER')$posddl2$;
  EXECUTE $posddl3$CREATE TABLE "pos_sessions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "openingCash" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "closingCash" DECIMAL(18,2),
  "expectedCash" DECIMAL(18,2),
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
  "posTerminal" TEXT,
  "notes" TEXT,
  "branchId" TEXT,
  CONSTRAINT "pos_sessions_pkey" PRIMARY KEY ("id")
)$posddl3$;
  EXECUTE $posddl4$CREATE TABLE "pos_orders" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "customerId" TEXT,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "subtotal" DECIMAL(18,2) NOT NULL,
  "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
  "taxAmount" DECIMAL(18,2) NOT NULL,
  "total" DECIMAL(18,2) NOT NULL,
  "status" "PosOrderStatus" NOT NULL DEFAULT 'COMPLETED',
  "branchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pos_orders_pkey" PRIMARY KEY ("id")
)$posddl4$;
  EXECUTE $posddl5$CREATE TABLE "pos_order_items" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT,
  "productName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(18,4) NOT NULL,
  "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
  "total" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_order_items_pkey" PRIMARY KEY ("id")
)$posddl5$;
  EXECUTE $posddl6$CREATE TABLE "pos_payments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "method" "PosPaymentMethod" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "reference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_payments_pkey" PRIMARY KEY ("id")
)$posddl6$;
  EXECUTE $posddl7$CREATE UNIQUE INDEX "pos_orders_orderNumber_key" ON "pos_orders"("orderNumber")$posddl7$;
  EXECUTE $posddl8$CREATE INDEX "pos_sessions_tenantId_idx" ON "pos_sessions"("tenantId")$posddl8$;
  EXECUTE $posddl9$CREATE INDEX "pos_sessions_userId_idx" ON "pos_sessions"("userId")$posddl9$;
  EXECUTE $posddl10$CREATE INDEX "pos_sessions_status_idx" ON "pos_sessions"("status")$posddl10$;
  EXECUTE $posddl11$CREATE INDEX "pos_sessions_branchId_idx" ON "pos_sessions"("branchId")$posddl11$;
  EXECUTE $posddl12$CREATE INDEX "pos_orders_tenantId_idx" ON "pos_orders"("tenantId")$posddl12$;
  EXECUTE $posddl13$CREATE INDEX "pos_orders_sessionId_idx" ON "pos_orders"("sessionId")$posddl13$;
  EXECUTE $posddl14$CREATE INDEX "pos_orders_status_idx" ON "pos_orders"("status")$posddl14$;
  EXECUTE $posddl15$CREATE INDEX "pos_orders_branchId_idx" ON "pos_orders"("branchId")$posddl15$;
  EXECUTE $posddl16$CREATE INDEX "pos_order_items_tenantId_idx" ON "pos_order_items"("tenantId")$posddl16$;
  EXECUTE $posddl17$CREATE INDEX "pos_order_items_orderId_idx" ON "pos_order_items"("orderId")$posddl17$;
  EXECUTE $posddl18$CREATE INDEX "pos_order_items_productId_idx" ON "pos_order_items"("productId")$posddl18$;
  EXECUTE $posddl19$CREATE INDEX "pos_payments_tenantId_idx" ON "pos_payments"("tenantId")$posddl19$;
  EXECUTE $posddl20$CREATE INDEX "pos_payments_orderId_idx" ON "pos_payments"("orderId")$posddl20$;
  EXECUTE $posddl21$ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE$posddl21$;
  EXECUTE $posddl22$ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE$posddl22$;
  EXECUTE $posddl23$ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "pos_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE$posddl23$;
  EXECUTE $posddl24$ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE$posddl24$;
  EXECUTE $posddl25$ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "pos_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE$posddl25$;
  EXECUTE $posddl26$ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE$posddl26$;
  EXECUTE $posddl27$ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE$posddl27$;
  EXECUTE $posddl28$ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "pos_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE$posddl28$;
  IF to_regclass('public.branches') IS NOT NULL THEN
    EXECUTE $branch1$ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE$branch1$;
    EXECUTE $branch2$ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE$branch2$;
  END IF;
END $pos_reconcile$;
