CREATE TYPE "ContractType" AS ENUM ('FIXED_TERM','INDEFINITE','TEMPORARY','TRAINING');
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT','ACTIVE','EXPIRED','TERMINATED','RENEWED');

CREATE TABLE "employee_contracts" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "contractNumber" TEXT NOT NULL,
  "type" "ContractType" NOT NULL DEFAULT 'FIXED_TERM',
  "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "probationEndDate" TIMESTAMP(3),
  "jobTitle" TEXT,
  "basicSalary" DECIMAL(18,2),
  "housingAllowance" DECIMAL(18,2),
  "transportAllowance" DECIMAL(18,2),
  "otherAllowances" DECIMAL(18,2),
  "workingHoursPerWeek" INTEGER,
  "signedAt" TIMESTAMP(3),
  "terminatedAt" TIMESTAMP(3),
  "terminationReason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leave_policies" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" "LeaveType" NOT NULL,
  "name" TEXT NOT NULL,
  "annualEntitlement" INTEGER NOT NULL,
  "maxCarryForward" INTEGER NOT NULL DEFAULT 0,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leave_balances" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "type" "LeaveType" NOT NULL,
  "year" INTEGER NOT NULL,
  "entitlement" INTEGER NOT NULL,
  "carriedForward" INTEGER NOT NULL DEFAULT 0,
  "used" INTEGER NOT NULL DEFAULT 0,
  "pending" INTEGER NOT NULL DEFAULT 0,
  "adjustment" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leave_balance_adjustments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "balanceId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_balance_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_contracts_tenantId_contractNumber_key"
  ON "employee_contracts"("tenantId","contractNumber");
CREATE INDEX "employee_contracts_tenantId_idx" ON "employee_contracts"("tenantId");
CREATE INDEX "employee_contracts_employeeId_idx" ON "employee_contracts"("employeeId");
CREATE INDEX "employee_contracts_status_idx" ON "employee_contracts"("status");

CREATE UNIQUE INDEX "leave_policies_tenantId_type_key"
  ON "leave_policies"("tenantId","type");
CREATE INDEX "leave_policies_tenantId_idx" ON "leave_policies"("tenantId");
CREATE INDEX "leave_policies_isActive_idx" ON "leave_policies"("isActive");

CREATE UNIQUE INDEX "leave_balances_tenantId_employeeId_type_year_key"
  ON "leave_balances"("tenantId","employeeId","type","year");
CREATE INDEX "leave_balances_tenantId_idx" ON "leave_balances"("tenantId");
CREATE INDEX "leave_balances_employeeId_idx" ON "leave_balances"("employeeId");
CREATE INDEX "leave_balances_year_idx" ON "leave_balances"("year");

CREATE INDEX "leave_balance_adjustments_tenantId_idx" ON "leave_balance_adjustments"("tenantId");
CREATE INDEX "leave_balance_adjustments_balanceId_idx" ON "leave_balance_adjustments"("balanceId");

ALTER TABLE "employee_contracts"
  ADD CONSTRAINT "employee_contracts_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_contracts"
  ADD CONSTRAINT "employee_contracts_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_policies"
  ADD CONSTRAINT "leave_policies_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_balances"
  ADD CONSTRAINT "leave_balances_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_balances"
  ADD CONSTRAINT "leave_balances_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_balance_adjustments"
  ADD CONSTRAINT "leave_balance_adjustments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_balance_adjustments"
  ADD CONSTRAINT "leave_balance_adjustments_balanceId_fkey"
  FOREIGN KEY ("balanceId") REFERENCES "leave_balances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
