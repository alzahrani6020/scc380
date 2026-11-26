-- Extend existing company-isolated cameras for vehicle dashcam enrollment.
-- No changes to employee, membership or workspace records.
ALTER TABLE "surveillance_cameras"
  ADD COLUMN "cameraType" TEXT NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "connectorType" TEXT NOT NULL DEFAULT 'UNCONFIGURED',
  ADD COLUMN "vehicleId" TEXT,
  ADD COLUMN "lastLatitude" DECIMAL(10,8),
  ADD COLUMN "lastLongitude" DECIMAL(11,8),
  ADD COLUMN "lastTelemetryAt" TIMESTAMP(3);
CREATE INDEX "surveillance_cameras_tenantId_vehicleId_idx"
  ON "surveillance_cameras" ("tenantId", "vehicleId");
