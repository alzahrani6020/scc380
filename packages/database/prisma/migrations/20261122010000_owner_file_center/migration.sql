-- Additive owner file center schema. No existing file records are changed.
CREATE TABLE "owner_files" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "content" BYTEA NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "owner_files_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "owner_files_size_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 1048576)
);
CREATE UNIQUE INDEX "owner_files_id_tenantId_key" ON "owner_files"("id","tenantId");
CREATE INDEX "owner_files_tenantId_createdAt_idx" ON "owner_files"("tenantId","createdAt");
ALTER TABLE "owner_files" ADD CONSTRAINT "owner_files_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "owner_file_requests" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fileId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "startLine" INTEGER,
  "endLine" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "owner_file_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "owner_file_requests_scope_check" CHECK ("scope" IN ('FULL','PARTIAL')),
  CONSTRAINT "owner_file_requests_status_check" CHECK ("status" IN ('PENDING','APPROVED','REJECTED','REVOKED')),
  CONSTRAINT "owner_file_requests_range_check" CHECK (
    ("scope" = 'FULL' AND "startLine" IS NULL AND "endLine" IS NULL)
    OR ("scope" = 'PARTIAL' AND "startLine" > 0 AND "endLine" >= "startLine" AND "endLine" - "startLine" <= 499)
  )
);
CREATE INDEX "owner_file_requests_tenantId_requesterId_createdAt_idx" ON "owner_file_requests"("tenantId","requesterId","createdAt");
CREATE INDEX "owner_file_requests_status_createdAt_idx" ON "owner_file_requests"("status","createdAt");
ALTER TABLE "owner_file_requests" ADD CONSTRAINT "owner_file_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "owner_file_requests" ADD CONSTRAINT "owner_file_requests_fileId_tenantId_fkey" FOREIGN KEY ("fileId","tenantId") REFERENCES "owner_files"("id","tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
