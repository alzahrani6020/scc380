ALTER TABLE "payrolls"
ADD COLUMN "loanDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "payroll_run_items"
ADD COLUMN "loanDeductionsTotal" DECIMAL(18,2) NOT NULL DEFAULT 0;

CREATE TABLE "employee_loans" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'LOAN',
  "principal" DECIMAL(18,2) NOT NULL,
  "installmentAmount" DECIMAL(18,2) NOT NULL,
  "balance" DECIMAL(18,2) NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_loans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_loan_payments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "loanId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "source" TEXT NOT NULL,
  "payrollRunId" TEXT,
  "settlementId" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_loan_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_run_loan_deductions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "payrollRunItemId" TEXT NOT NULL,
  "loanId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_run_loan_deductions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "end_service_settlements" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "initiatedBy" TEXT NOT NULL,
  "lastWorkingDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "hireDateSnapshot" TIMESTAMP(3) NOT NULL,
  "serviceDays" INTEGER NOT NULL,
  "lastWage" DECIMAL(18,2) NOT NULL,
  "baseAward" DECIMAL(18,2) NOT NULL,
  "awardFactor" DECIMAL(8,6) NOT NULL,
  "eosAward" DECIMAL(18,2) NOT NULL,
  "leaveEncashment" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "unpaidSalary" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "otherEntitlements" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "compensation" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "outstandingLoanBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "loanDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "otherDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "netSettlement" DECIMAL(18,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "end_service_settlements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_loans_tenantId_idx" ON "employee_loans"("tenantId");
CREATE INDEX "employee_loans_tenantId_employeeId_idx" ON "employee_loans"("tenantId","employeeId");
CREATE INDEX "employee_loans_tenantId_status_idx" ON "employee_loans"("tenantId","status");
CREATE INDEX "employee_loan_payments_tenantId_idx" ON "employee_loan_payments"("tenantId");
CREATE INDEX "employee_loan_payments_loanId_idx" ON "employee_loan_payments"("loanId");
CREATE INDEX "employee_loan_payments_payrollRunId_idx" ON "employee_loan_payments"("payrollRunId");
CREATE INDEX "employee_loan_payments_settlementId_idx" ON "employee_loan_payments"("settlementId");
CREATE UNIQUE INDEX "payroll_run_loan_deductions_payrollRunItemId_loanId_key" ON "payroll_run_loan_deductions"("payrollRunItemId","loanId");
CREATE INDEX "payroll_run_loan_deductions_tenantId_idx" ON "payroll_run_loan_deductions"("tenantId");
CREATE INDEX "payroll_run_loan_deductions_loanId_idx" ON "payroll_run_loan_deductions"("loanId");
CREATE INDEX "end_service_settlements_tenantId_idx" ON "end_service_settlements"("tenantId");
CREATE INDEX "end_service_settlements_tenantId_employeeId_idx" ON "end_service_settlements"("tenantId","employeeId");
CREATE INDEX "end_service_settlements_tenantId_status_idx" ON "end_service_settlements"("tenantId","status");
CREATE INDEX "end_service_settlements_dueDate_idx" ON "end_service_settlements"("dueDate");

ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_loan_payments" ADD CONSTRAINT "employee_loan_payments_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_loan_payments" ADD CONSTRAINT "employee_loan_payments_loanId_fkey"
FOREIGN KEY ("loanId") REFERENCES "employee_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_loan_payments" ADD CONSTRAINT "employee_loan_payments_payrollRunId_fkey"
FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_run_loan_deductions" ADD CONSTRAINT "payroll_run_loan_deductions_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_run_loan_deductions" ADD CONSTRAINT "payroll_run_loan_deductions_payrollRunItemId_fkey"
FOREIGN KEY ("payrollRunItemId") REFERENCES "payroll_run_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_run_loan_deductions" ADD CONSTRAINT "payroll_run_loan_deductions_loanId_fkey"
FOREIGN KEY ("loanId") REFERENCES "employee_loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "end_service_settlements" ADD CONSTRAINT "end_service_settlements_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "end_service_settlements" ADD CONSTRAINT "end_service_settlements_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_loans"
ADD CONSTRAINT "employee_loans_amounts_check"
CHECK ("principal" > 0 AND "installmentAmount" > 0 AND "balance" >= 0 AND "balance" <= "principal");

ALTER TABLE "employee_loan_payments"
ADD CONSTRAINT "employee_loan_payments_amount_check" CHECK ("amount" > 0);

ALTER TABLE "payroll_run_loan_deductions"
ADD CONSTRAINT "payroll_run_loan_deductions_amount_check" CHECK ("amount" > 0);

ALTER TABLE "end_service_settlements"
ADD CONSTRAINT "end_service_settlements_amounts_check"
CHECK ("lastWage" >= 0 AND "baseAward" >= 0 AND "awardFactor" >= 0 AND "awardFactor" <= 1 AND "eosAward" >= 0
AND "leaveEncashment" >= 0 AND "unpaidSalary" >= 0 AND "otherEntitlements" >= 0 AND "compensation" >= 0
AND "outstandingLoanBalance" >= 0 AND "loanDeduction" >= 0 AND "otherDeductions" >= 0);
