-- Additive-only. No changes to existing payroll, employment, or asset records.
CREATE TABLE "hr_governance_cases" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "contractId" TEXT,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "createdById" TEXT NOT NULL,
  "assignedToId" TEXT,
  "resolution" TEXT,
  "closedById" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hr_governance_cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hr_governance_case_status_check" CHECK ("status" IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED')),
  CONSTRAINT "hr_governance_case_priority_check" CHECK ("priority" IN ('NORMAL', 'HIGH', 'CRITICAL'))
);
CREATE INDEX "hr_governance_cases_tenantId_status_createdAt_idx" ON "hr_governance_cases"("tenantId","status","createdAt");
CREATE INDEX "hr_governance_cases_tenantId_employeeId_idx" ON "hr_governance_cases"("tenantId","employeeId");
CREATE INDEX "hr_governance_cases_tenantId_category_idx" ON "hr_governance_cases"("tenantId","category");
ALTER TABLE "hr_governance_cases" ADD CONSTRAINT "hr_governance_cases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hr_governance_cases" ADD CONSTRAINT "hr_governance_cases_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "hr_governance_events" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hr_governance_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hr_governance_events_tenantId_caseId_createdAt_idx" ON "hr_governance_events"("tenantId","caseId","createdAt");
ALTER TABLE "hr_governance_events" ADD CONSTRAINT "hr_governance_events_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "hr_governance_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
