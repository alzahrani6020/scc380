ALTER TABLE "employees"
ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");
CREATE INDEX "employees_userId_idx" ON "employees"("userId");

ALTER TABLE "employees"
ADD CONSTRAINT "employees_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "hr_requests" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "details" JSONB DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "resolution" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hr_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hr_lifecycle_cases" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "targetDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hr_lifecycle_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hr_lifecycle_tasks" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'TODO',
  "order" INTEGER NOT NULL DEFAULT 0,
  "assignedToId" TEXT,
  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hr_lifecycle_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hr_requests_tenantId_idx" ON "hr_requests"("tenantId");
CREATE INDEX "hr_requests_tenantId_employeeId_idx" ON "hr_requests"("tenantId","employeeId");
CREATE INDEX "hr_requests_tenantId_status_idx" ON "hr_requests"("tenantId","status");
CREATE INDEX "hr_requests_type_idx" ON "hr_requests"("type");

CREATE INDEX "hr_lifecycle_cases_tenantId_idx" ON "hr_lifecycle_cases"("tenantId");
CREATE INDEX "hr_lifecycle_cases_tenantId_employeeId_idx" ON "hr_lifecycle_cases"("tenantId","employeeId");
CREATE INDEX "hr_lifecycle_cases_tenantId_type_status_idx" ON "hr_lifecycle_cases"("tenantId","type","status");

CREATE INDEX "hr_lifecycle_tasks_tenantId_idx" ON "hr_lifecycle_tasks"("tenantId");
CREATE INDEX "hr_lifecycle_tasks_caseId_idx" ON "hr_lifecycle_tasks"("caseId");
CREATE INDEX "hr_lifecycle_tasks_assignedToId_idx" ON "hr_lifecycle_tasks"("assignedToId");
CREATE INDEX "hr_lifecycle_tasks_status_idx" ON "hr_lifecycle_tasks"("status");

ALTER TABLE "hr_requests"
ADD CONSTRAINT "hr_requests_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_requests"
ADD CONSTRAINT "hr_requests_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr_lifecycle_cases"
ADD CONSTRAINT "hr_lifecycle_cases_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_lifecycle_cases"
ADD CONSTRAINT "hr_lifecycle_cases_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr_lifecycle_tasks"
ADD CONSTRAINT "hr_lifecycle_tasks_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hr_lifecycle_tasks"
ADD CONSTRAINT "hr_lifecycle_tasks_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "hr_lifecycle_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hr_requests"
ADD CONSTRAINT "hr_requests_status_check"
CHECK ("status" IN ('PENDING','APPROVED','REJECTED','CANCELLED'));

ALTER TABLE "hr_lifecycle_cases"
ADD CONSTRAINT "hr_lifecycle_cases_type_check"
CHECK ("type" IN ('ONBOARDING','OFFBOARDING'));
ALTER TABLE "hr_lifecycle_cases"
ADD CONSTRAINT "hr_lifecycle_cases_status_check"
CHECK ("status" IN ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED'));

ALTER TABLE "hr_lifecycle_tasks"
ADD CONSTRAINT "hr_lifecycle_tasks_status_check"
CHECK ("status" IN ('TODO','IN_PROGRESS','DONE','SKIPPED'));
