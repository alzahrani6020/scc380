-- Company-owned field devices. New tables only; no destructive changes.
-- Do not apply to production before isolated restore test and Prisma validation.
CREATE TABLE "field_managed_devices" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "assetTag" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "managementState" TEXT NOT NULL DEFAULT 'UNCONFIGURED',
  "provider" TEXT NOT NULL DEFAULT 'UNCONFIGURED',
  "providerDeviceId" TEXT,
  "employeeId" TEXT,
  "branchId" TEXT,
  "noticeVersion" TEXT,
  "noticeAcknowledgedAt" TIMESTAMP(3),
  "assignedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "field_managed_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "field_managed_devices_tenantId_assetTag_key"
  ON "field_managed_devices" ("tenantId", "assetTag");
CREATE UNIQUE INDEX "field_managed_devices_id_tenantId_key"
  ON "field_managed_devices" ("id", "tenantId");
CREATE INDEX "field_managed_devices_tenantId_employeeId_idx"
  ON "field_managed_devices" ("tenantId", "employeeId");
CREATE INDEX "field_managed_devices_tenantId_managementState_idx"
  ON "field_managed_devices" ("tenantId", "managementState");
ALTER TABLE "field_managed_devices" ADD CONSTRAINT "field_managed_devices_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "field_device_shifts" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3), "startedById" TEXT NOT NULL, "endedById" TEXT,
  CONSTRAINT "field_device_shifts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "field_device_shifts_id_tenantId_key"
  ON "field_device_shifts" ("id", "tenantId");
CREATE INDEX "field_device_shifts_tenantId_deviceId_endedAt_idx"
  ON "field_device_shifts" ("tenantId", "deviceId", "endedAt");
ALTER TABLE "field_device_shifts" ADD CONSTRAINT "field_device_shifts_deviceId_tenantId_fkey"
  FOREIGN KEY ("deviceId", "tenantId") REFERENCES "field_managed_devices"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "field_device_locations" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL, "latitude" DECIMAL(10,8) NOT NULL,
  "longitude" DECIMAL(11,8) NOT NULL, "accuracyMeters" DOUBLE PRECISION NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL,
  CONSTRAINT "field_device_locations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "field_device_locations_tenantId_deviceId_recordedAt_idx"
  ON "field_device_locations" ("tenantId", "deviceId", "recordedAt");
CREATE INDEX "field_device_locations_tenantId_shiftId_recordedAt_idx"
  ON "field_device_locations" ("tenantId", "shiftId", "recordedAt");
ALTER TABLE "field_device_locations" ADD CONSTRAINT "field_device_locations_deviceId_tenantId_fkey"
  FOREIGN KEY ("deviceId", "tenantId") REFERENCES "field_managed_devices"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_device_locations" ADD CONSTRAINT "field_device_locations_shiftId_tenantId_fkey"
  FOREIGN KEY ("shiftId", "tenantId") REFERENCES "field_device_shifts"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "field_device_commands" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
  "action" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'NOT_DISPATCHED',
  "requestedById" TEXT NOT NULL, "approvedById" TEXT, "reason" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "providerReceipt" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "field_device_commands_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "field_device_commands_tenantId_idempotencyKey_key"
  ON "field_device_commands" ("tenantId", "idempotencyKey");
CREATE INDEX "field_device_commands_tenantId_deviceId_createdAt_idx"
  ON "field_device_commands" ("tenantId", "deviceId", "createdAt");
ALTER TABLE "field_device_commands" ADD CONSTRAINT "field_device_commands_deviceId_tenantId_fkey"
  FOREIGN KEY ("deviceId", "tenantId") REFERENCES "field_managed_devices"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "field_device_audit" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "deviceId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL, "action" TEXT NOT NULL, "decision" TEXT NOT NULL,
  "reason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_device_audit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "field_device_audit_tenantId_deviceId_createdAt_idx"
  ON "field_device_audit" ("tenantId", "deviceId", "createdAt");
ALTER TABLE "field_device_audit" ADD CONSTRAINT "field_device_audit_deviceId_tenantId_fkey"
  FOREIGN KEY ("deviceId", "tenantId") REFERENCES "field_managed_devices"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
