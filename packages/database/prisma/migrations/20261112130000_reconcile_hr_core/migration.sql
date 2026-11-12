DO $$ BEGIN
  CREATE TYPE "LeaveType" AS ENUM ('ANNUAL','SICK','EMERGENCY','UNPAID','MATERNITY','PATERNITY','HAJJ','STUDY','COMPASSIONATE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeaveStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT','ABSENT','LATE','ON_LEAVE','HALF_DAY','REMOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT','APPROVED','PAID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "leaves" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "type" "LeaveType" NOT NULL DEFAULT 'ANNUAL',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "days" INTEGER NOT NULL,
  "reason" TEXT,
  "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendances" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkIn" TIMESTAMP(3),
  "checkOut" TIMESTAMP(3),
  "checkInLat" DECIMAL(10,8),
  "checkInLng" DECIMAL(11,8),
  "checkOutLat" DECIMAL(10,8),
  "checkOutLng" DECIMAL(11,8),
  "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "workHours" DECIMAL(5,2),
  "overtimeHours" DECIMAL(5,2),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payrolls" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "basicSalary" DECIMAL(18,2) NOT NULL,
  "housingAllowance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "transportAllowance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "otherAllowances" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "gosiDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "otherDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "netSalary" DECIMAL(18,2) NOT NULL,
  "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shifts" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3),
  "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  "recurrence" TEXT,
  "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leaves_tenantId_idx" ON "leaves"("tenantId");
CREATE INDEX "leaves_employeeId_idx" ON "leaves"("employeeId");
CREATE INDEX "attendances_tenantId_idx" ON "attendances"("tenantId");
CREATE INDEX "attendances_employeeId_idx" ON "attendances"("employeeId");
CREATE INDEX "attendances_date_idx" ON "attendances"("date");
CREATE INDEX "payrolls_tenantId_idx" ON "payrolls"("tenantId");
CREATE INDEX "payrolls_employeeId_idx" ON "payrolls"("employeeId");
CREATE INDEX "shifts_tenantId_idx" ON "shifts"("tenantId");
CREATE INDEX "shifts_employeeId_idx" ON "shifts"("employeeId");

ALTER TABLE "leaves" ADD CONSTRAINT "leaves_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
