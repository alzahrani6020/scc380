-- SCC380 surveillance metadata foundation only. No media, credentials or tenant permissions change.
CREATE TABLE "surveillance_sites" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT,
  "address" TEXT,
  "siteType" TEXT NOT NULL DEFAULT 'BRANCH',
  "branchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "surveillance_sites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "surveillance_cameras" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "manufacturer" TEXT,
  "model" TEXT,
  "serialNumber" TEXT,
  "location" TEXT,
  "isOutdoor" BOOLEAN NOT NULL DEFAULT false,
  "supportsAudio" BOOLEAN NOT NULL DEFAULT false,
  "supportsTalk" BOOLEAN NOT NULL DEFAULT false,
  "supportsPtz" BOOLEAN NOT NULL DEFAULT false,
  "supportsWiper" BOOLEAN NOT NULL DEFAULT false,
  "connectionStatus" TEXT NOT NULL DEFAULT 'UNCONFIGURED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "surveillance_cameras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "surveillance_maintenance" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "cameraId" TEXT NOT NULL,
  "taskType" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "surveillance_maintenance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "surveillance_sites_id_tenantId_key" ON "surveillance_sites"("id", "tenantId");
CREATE INDEX "surveillance_sites_tenantId_name_idx" ON "surveillance_sites"("tenantId", "name");
CREATE UNIQUE INDEX "surveillance_cameras_id_tenantId_key" ON "surveillance_cameras"("id", "tenantId");
CREATE INDEX "surveillance_cameras_tenantId_siteId_idx" ON "surveillance_cameras"("tenantId", "siteId");
CREATE INDEX "surveillance_maintenance_tenantId_status_dueAt_idx" ON "surveillance_maintenance"("tenantId", "status", "dueAt");
CREATE INDEX "surveillance_maintenance_tenantId_cameraId_idx" ON "surveillance_maintenance"("tenantId", "cameraId");

ALTER TABLE "surveillance_sites" ADD CONSTRAINT "surveillance_sites_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surveillance_cameras" ADD CONSTRAINT "surveillance_cameras_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surveillance_cameras" ADD CONSTRAINT "surveillance_cameras_siteId_tenantId_fkey"
  FOREIGN KEY ("siteId", "tenantId") REFERENCES "surveillance_sites"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surveillance_maintenance" ADD CONSTRAINT "surveillance_maintenance_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surveillance_maintenance" ADD CONSTRAINT "surveillance_maintenance_cameraId_tenantId_fkey"
  FOREIGN KEY ("cameraId", "tenantId") REFERENCES "surveillance_cameras"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
