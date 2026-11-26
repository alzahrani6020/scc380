-- Additive site-scoped outbound gateway identity and camera last-seen metadata.
ALTER TABLE "surveillance_cameras" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
CREATE TABLE "surveillance_gateways" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenPrefix" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "surveillance_gateways_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "surveillance_gateways_tokenHash_key" ON "surveillance_gateways"("tokenHash");
CREATE INDEX "surveillance_gateways_tenantId_siteId_idx" ON "surveillance_gateways"("tenantId", "siteId");
ALTER TABLE "surveillance_gateways" ADD CONSTRAINT "surveillance_gateways_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "surveillance_gateways" ADD CONSTRAINT "surveillance_gateways_siteId_tenantId_fkey"
  FOREIGN KEY ("siteId", "tenantId") REFERENCES "surveillance_sites"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
