-- Additional camera incident workflow. Additive; does not modify existing customers or media.
CREATE TABLE "surveillance_incidents" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "cameraId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "assignedToId" TEXT,
  "resolution" TEXT,
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "surveillance_incidents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "surveillance_incidents_tenantId_status_occurredAt_idx"
  ON "surveillance_incidents"("tenantId", "status", "occurredAt");
CREATE INDEX "surveillance_incidents_tenantId_cameraId_idx"
  ON "surveillance_incidents"("tenantId", "cameraId");
ALTER TABLE "surveillance_incidents" ADD CONSTRAINT "surveillance_incidents_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surveillance_incidents" ADD CONSTRAINT "surveillance_incidents_cameraId_tenantId_fkey"
  FOREIGN KEY ("cameraId", "tenantId") REFERENCES "surveillance_cameras"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
