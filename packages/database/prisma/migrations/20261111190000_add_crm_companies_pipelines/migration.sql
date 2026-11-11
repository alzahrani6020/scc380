-- Additive CRM expansion: companies and dynamic pipelines.
-- Safe for existing data: new foreign-key columns are nullable and no existing rows are rewritten.

CREATE TABLE IF NOT EXISTS "companies" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "crNumber" TEXT,
  "vatNumber" TEXT,
  "website" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "city" TEXT,
  "country" TEXT DEFAULT 'SA',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "customFields" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "companies_tenantId_name_key" ON "companies"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "companies_tenantId_idx" ON "companies"("tenantId");
CREATE INDEX IF NOT EXISTS "companies_crNumber_idx" ON "companies"("crNumber");
CREATE INDEX IF NOT EXISTS "companies_vatNumber_idx" ON "companies"("vatNumber");

CREATE TABLE IF NOT EXISTS "pipelines" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pipelines_tenantId_name_key" ON "pipelines"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "pipelines_tenantId_idx" ON "pipelines"("tenantId");
CREATE INDEX IF NOT EXISTS "pipelines_isActive_idx" ON "pipelines"("isActive");

CREATE TABLE IF NOT EXISTS "pipeline_stages" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "pipelineId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "probability" INTEGER NOT NULL DEFAULT 0,
  "color" TEXT,
  "isWon" BOOLEAN NOT NULL DEFAULT false,
  "isLost" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pipeline_stages_pipelineId_code_key" ON "pipeline_stages"("pipelineId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "pipeline_stages_pipelineId_order_key" ON "pipeline_stages"("pipelineId", "order");
CREATE INDEX IF NOT EXISTS "pipeline_stages_tenantId_idx" ON "pipeline_stages"("tenantId");
CREATE INDEX IF NOT EXISTS "pipeline_stages_pipelineId_idx" ON "pipeline_stages"("pipelineId");

ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "pipelineStageId" TEXT;

CREATE INDEX IF NOT EXISTS "contacts_companyId_idx" ON "contacts"("companyId");
CREATE INDEX IF NOT EXISTS "deals_companyId_idx" ON "deals"("companyId");
CREATE INDEX IF NOT EXISTS "deals_pipelineId_idx" ON "deals"("pipelineId");
CREATE INDEX IF NOT EXISTS "deals_pipelineStageId_idx" ON "deals"("pipelineStageId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_tenantId_fkey') THEN
    ALTER TABLE "companies" ADD CONSTRAINT "companies_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipelines_tenantId_fkey') THEN
    ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_stages_tenantId_fkey') THEN
    ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_stages_pipelineId_fkey') THEN
    ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipelineId_fkey"
      FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_companyId_fkey') THEN
    ALTER TABLE "contacts" ADD CONSTRAINT "contacts_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_companyId_fkey') THEN
    ALTER TABLE "deals" ADD CONSTRAINT "deals_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_pipelineId_fkey') THEN
    ALTER TABLE "deals" ADD CONSTRAINT "deals_pipelineId_fkey"
      FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deals_pipelineStageId_fkey') THEN
    ALTER TABLE "deals" ADD CONSTRAINT "deals_pipelineStageId_fkey"
      FOREIGN KEY ("pipelineStageId") REFERENCES "pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
