DROP INDEX IF EXISTS "employees_employeeCode_key";
DROP INDEX IF EXISTS "departments_code_key";

CREATE UNIQUE INDEX "employees_tenantId_employeeCode_key"
  ON "employees"("tenantId", "employeeCode");

CREATE UNIQUE INDEX "departments_tenantId_code_key"
  ON "departments"("tenantId", "code");

CREATE UNIQUE INDEX "payrolls_tenantId_employeeId_year_month_key"
  ON "payrolls"("tenantId", "employeeId", "year", "month");
