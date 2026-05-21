-- Create default tenant for existing data
INSERT INTO "tenants" ("id", "name", "slug", "type", "status", "plan", "createdAt", "updatedAt")
VALUES ('default-tenant', 'Default Tenant', 'default', 'SHARED', 'ACTIVE', 'BASIC', NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;

-- Add tenantId columns as nullable first
ALTER TABLE "activities" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "contacts" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "deals" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "departments" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "employees" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "fleet_trips" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "users" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "vehicles" ADD COLUMN "tenantId" TEXT;

-- Update existing rows to default tenant
UPDATE "activities" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
UPDATE "contacts" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
UPDATE "deals" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
UPDATE "departments" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
UPDATE "employees" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
UPDATE "fleet_trips" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
UPDATE "invoice_items" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
UPDATE "invoices" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
UPDATE "users" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
UPDATE "vehicles" SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;

-- Make tenantId NOT NULL where required
ALTER TABLE "activities" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "contacts" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "deals" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "departments" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "employees" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "fleet_trips" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "invoice_items" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "tenantId" SET NOT NULL;

-- Indexes
CREATE INDEX "activities_tenantId_idx" ON "activities"("tenantId");
CREATE INDEX "contacts_tenantId_idx" ON "contacts"("tenantId");
CREATE INDEX "deals_tenantId_idx" ON "deals"("tenantId");
CREATE INDEX "departments_tenantId_idx" ON "departments"("tenantId");
CREATE INDEX "employees_tenantId_idx" ON "employees"("tenantId");
CREATE INDEX "fleet_trips_tenantId_idx" ON "fleet_trips"("tenantId");
CREATE INDEX "invoice_items_tenantId_idx" ON "invoice_items"("tenantId");
CREATE INDEX "invoices_tenantId_idx" ON "invoices"("tenantId");
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");
CREATE INDEX "vehicles_tenantId_idx" ON "vehicles"("tenantId");

-- Foreign Keys
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fleet_trips" ADD CONSTRAINT "fleet_trips_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
