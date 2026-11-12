CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT','APPROVED','PAID','CANCELLED');

CREATE TABLE "payroll_runs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
  "employeeCount" INTEGER NOT NULL DEFAULT 0,
  "grossTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "deductionTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "netTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_run_items" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employeeCode" TEXT NOT NULL,
  "employeeName" TEXT NOT NULL,
  "basicSalary" DECIMAL(18,2) NOT NULL,
  "housingAllowance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "transportAllowance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "otherAllowances" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "gosiDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "otherDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "grossSalary" DECIMAL(18,2) NOT NULL,
  "totalDeductions" DECIMAL(18,2) NOT NULL,
  "netSalary" DECIMAL(18,2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_run_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payrolls" ADD COLUMN "payrollRunId" TEXT;

CREATE UNIQUE INDEX "payroll_runs_tenantId_year_month_key" ON "payroll_runs"("tenantId","year","month");
CREATE INDEX "payroll_runs_tenantId_idx" ON "payroll_runs"("tenantId");
CREATE INDEX "payroll_runs_status_idx" ON "payroll_runs"("status");

CREATE UNIQUE INDEX "payroll_run_items_payrollRunId_employeeId_key" ON "payroll_run_items"("payrollRunId","employeeId");
CREATE INDEX "payroll_run_items_tenantId_idx" ON "payroll_run_items"("tenantId");
CREATE INDEX "payroll_run_items_payrollRunId_idx" ON "payroll_run_items"("payrollRunId");
CREATE INDEX "payroll_run_items_employeeId_idx" ON "payroll_run_items"("employeeId");

CREATE INDEX "payrolls_payrollRunId_idx" ON "payrolls"("payrollRunId");

ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "payroll_runs_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_run_items"
  ADD CONSTRAINT "payroll_run_items_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_run_items"
  ADD CONSTRAINT "payroll_run_items_payrollRunId_fkey"
  FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_run_items"
  ADD CONSTRAINT "payroll_run_items_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payrolls"
  ADD CONSTRAINT "payrolls_payrollRunId_fkey"
  FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
