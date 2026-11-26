-- Additive auditable command envelope; no device execution or media access is enabled.
CREATE TABLE "surveillance_device_commands" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "cameraId" TEXT NOT NULL,
  "gatewayId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acknowledgedAt" TIMESTAMP(3),
  "resultCode" TEXT,
  CONSTRAINT "surveillance_device_commands_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "surveillance_device_commands_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "surveillance_device_commands_site_tenant_fk" FOREIGN KEY ("siteId", "tenantId") REFERENCES "surveillance_sites"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "surveillance_device_commands_camera_tenant_fk" FOREIGN KEY ("cameraId", "tenantId") REFERENCES "surveillance_cameras"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "surveillance_device_commands_gateway_fk" FOREIGN KEY ("gatewayId") REFERENCES "surveillance_gateways"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "surveillance_device_commands_gatewayId_status_expiresAt_idx" ON "surveillance_device_commands"("gatewayId","status","expiresAt");
CREATE INDEX "surveillance_device_commands_tenantId_cameraId_createdAt_idx" ON "surveillance_device_commands"("tenantId","cameraId","createdAt");
