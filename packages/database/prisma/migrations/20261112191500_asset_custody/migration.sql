CREATE TABLE "asset_custody_assignments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedReturnAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "conditionOut" TEXT,
  "conditionIn" TEXT,
  "assignedById" TEXT,
  "returnedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_custody_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "asset_custody_assignments_tenantId_idx" ON "asset_custody_assignments"("tenantId");
CREATE INDEX "asset_custody_assignments_tenantId_employeeId_idx" ON "asset_custody_assignments"("tenantId","employeeId");
CREATE INDEX "asset_custody_assignments_tenantId_assetId_idx" ON "asset_custody_assignments"("tenantId","assetId");
CREATE INDEX "asset_custody_assignments_status_idx" ON "asset_custody_assignments"("status");

-- Database-level concurrency guard: one ACTIVE custody assignment per asset.
CREATE UNIQUE INDEX "asset_custody_one_active_asset_key"
ON "asset_custody_assignments"("assetId")
WHERE "status" = 'ACTIVE';

ALTER TABLE "asset_custody_assignments"
ADD CONSTRAINT "asset_custody_assignments_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_custody_assignments"
ADD CONSTRAINT "asset_custody_assignments_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "fixed_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_custody_assignments"
ADD CONSTRAINT "asset_custody_assignments_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_custody_assignments"
ADD CONSTRAINT "asset_custody_status_check"
CHECK ("status" IN ('ACTIVE','RETURNED','LOST','DAMAGED'));
