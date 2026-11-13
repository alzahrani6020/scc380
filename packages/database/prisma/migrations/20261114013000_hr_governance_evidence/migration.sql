-- Additive evidence vault; originals are not exposed to application update/delete routes.
CREATE TABLE "hr_governance_evidence" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "description" TEXT,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hr_governance_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hr_governance_evidence_size_check" CHECK ("sizeBytes" BETWEEN 1 AND 5242880)
);
CREATE INDEX "hr_governance_evidence_tenantId_caseId_createdAt_idx" ON "hr_governance_evidence"("tenantId","caseId","createdAt");
ALTER TABLE "hr_governance_evidence" ADD CONSTRAINT "hr_governance_evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "hr_governance_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
