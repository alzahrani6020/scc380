-- Greenfield real-estate baseline. Intentionally fail closed on existing estate tables.
-- Production must undergo a read-only schema reconciliation before deploying this migration.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.tables
   WHERE table_schema='public' AND table_name IN
   ('properties','units','lease_contracts','rent_payments','contract_documents','property_expenses')) THEN
  RAISE EXCEPTION 'Real-estate tables already exist: reconcile existing schema; do not apply greenfield baseline';
 END IF;
END $$;

CREATE TYPE "PropertyType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'MIXED_USE', 'LAND');
CREATE TYPE "PropertyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_CONSTRUCTION', 'SOLD');
CREATE TYPE "UnitType" AS ENUM ('APARTMENT', 'VILLA', 'OFFICE', 'SHOP', 'WAREHOUSE', 'LAND_PLOT', 'STUDIO', 'DUPLEX', 'PENTHOUSE');
CREATE TYPE "UnitStatus" AS ENUM ('VACANT', 'OCCUPIED', 'RESERVED', 'UNDER_MAINTENANCE', 'SOLD');
CREATE TYPE "LeaseType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL');
CREATE TYPE "PaymentFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'WEEKLY');
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED');
-- PaymentStatus is shared with pre-existing finance functionality.
-- Validate exact enum values instead of replacing an existing production type.
DO $
DECLARE actual TEXT[];
BEGIN
 SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
 INTO actual
 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
 JOIN pg_namespace n ON n.oid=t.typnamespace
 WHERE n.nspname='public' AND t.typname='PaymentStatus';
 IF actual IS NULL THEN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
 ELSIF actual <> ARRAY['PENDING','COMPLETED','FAILED','REFUNDED']::text[] THEN
  RAISE EXCEPTION 'Existing PaymentStatus enum differs from real-estate schema: %', actual;
 END IF;
END $;
CREATE TYPE "ContractDocumentType" AS ENUM ('DEED', 'ID_COPY', 'COMMERCIAL_REGISTER', 'POWER_OF_ATTORNEY', 'INSPECTION_REPORT', 'CONTRACT_COPY', 'OTHER');
CREATE TYPE "PropertyExpenseType" AS ENUM ('MAINTENANCE', 'INSURANCE', 'TAX', 'UTILITY', 'MANAGEMENT_FEE', 'RENOVATION', 'CLEANING', 'SECURITY', 'OTHER');

CREATE TABLE "properties" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "tenantId" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "description" TEXT,
 "propertyType" "PropertyType" NOT NULL DEFAULT 'RESIDENTIAL',
 "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE',
 "address" TEXT, "city" TEXT, "district" TEXT, "buildingNumber" TEXT,
 "latitude" DECIMAL(10,8), "longitude" DECIMAL(11,8),
 "deedNumber" TEXT, "deedFileUrl" TEXT, "ownerName" TEXT, "ownerIdNumber" TEXT, "ownerPhone" TEXT, "regaLicenseNumber" TEXT,
 "acquisitionDate" TIMESTAMP(3), "acquisitionCost" DECIMAL(18,2), "totalAreaSqm" DECIMAL(10,2),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "properties_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "units" (
 "id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "propertyId" TEXT NOT NULL,
 "unitNumber" TEXT NOT NULL, "floor" INTEGER,
 "unitType" "UnitType" NOT NULL DEFAULT 'APARTMENT',
 "status" "UnitStatus" NOT NULL DEFAULT 'VACANT',
 "areaSqm" DECIMAL(10,2), "bedrooms" INTEGER, "bathrooms" INTEGER,
 "rentAmountMonthly" DECIMAL(18,2), "currentLeaseId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "units_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "units_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "lease_contracts" (
 "id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "propertyId" TEXT NOT NULL, "unitId" TEXT NOT NULL,
 "ejarContractNumber" TEXT, "contractType" "LeaseType" NOT NULL DEFAULT 'RESIDENTIAL',
 "lessorId" TEXT, "lesseeId" TEXT,
 "lessorName" TEXT NOT NULL, "lessorIdNumber" TEXT NOT NULL, "lessorPhone" TEXT,
 "lesseeName" TEXT NOT NULL, "lesseeIdNumber" TEXT NOT NULL, "lesseePhone" TEXT,
 "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3) NOT NULL,
 "rentAmount" DECIMAL(18,2) NOT NULL, "paymentFrequency" "PaymentFrequency" NOT NULL DEFAULT 'MONTHLY',
 "securityDeposit" DECIMAL(18,2), "paymentMethod" TEXT DEFAULT 'BANK_TRANSFER', "bankAccount" TEXT,
 "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT', "ejarStatus" TEXT DEFAULT 'PENDING',
 "ejarSyncedAt" TIMESTAMP(3), "autoRenew" BOOLEAN NOT NULL DEFAULT false,
 "renewalNoticeDays" INTEGER NOT NULL DEFAULT 60,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "lease_contracts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "lease_contracts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "lease_contracts_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "rent_payments" (
 "id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "contractId" TEXT NOT NULL, "propertyId" TEXT NOT NULL, "unitId" TEXT NOT NULL,
 "dueDate" TIMESTAMP(3) NOT NULL, "paidDate" TIMESTAMP(3), "amount" DECIMAL(18,2) NOT NULL,
 "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
 "paymentMethod" TEXT, "transactionRef" TEXT, "bankReference" TEXT, "ejarPaymentRef" TEXT, "invoiceId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "rent_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "rent_payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "lease_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "contract_documents" (
 "id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "contractId" TEXT NOT NULL,
 "type" "ContractDocumentType" NOT NULL DEFAULT 'OTHER',
 "fileUrl" TEXT NOT NULL, "fileName" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "contract_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "contract_documents_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "lease_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "property_expenses" (
 "id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "propertyId" TEXT NOT NULL,
 "type" "PropertyExpenseType" NOT NULL DEFAULT 'OTHER',
 "amount" DECIMAL(18,2) NOT NULL, "paidDate" TIMESTAMP(3), "description" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "property_expenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "property_expenses_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "lease_contracts_ejarContractNumber_key" ON "lease_contracts"("ejarContractNumber");
CREATE INDEX "properties_tenantId_idx" ON "properties"("tenantId");
CREATE INDEX "properties_status_idx" ON "properties"("status");
CREATE INDEX "properties_propertyType_idx" ON "properties"("propertyType");
CREATE INDEX "properties_city_idx" ON "properties"("city");
CREATE INDEX "units_tenantId_idx" ON "units"("tenantId");
CREATE INDEX "units_propertyId_idx" ON "units"("propertyId");
CREATE INDEX "units_status_idx" ON "units"("status");
CREATE INDEX "lease_contracts_tenantId_idx" ON "lease_contracts"("tenantId");
CREATE INDEX "lease_contracts_propertyId_idx" ON "lease_contracts"("propertyId");
CREATE INDEX "lease_contracts_unitId_idx" ON "lease_contracts"("unitId");
CREATE INDEX "lease_contracts_status_idx" ON "lease_contracts"("status");
CREATE INDEX "lease_contracts_ejarStatus_idx" ON "lease_contracts"("ejarStatus");
CREATE INDEX "lease_contracts_endDate_idx" ON "lease_contracts"("endDate");
CREATE INDEX "rent_payments_tenantId_idx" ON "rent_payments"("tenantId");
CREATE INDEX "rent_payments_contractId_idx" ON "rent_payments"("contractId");
CREATE INDEX "rent_payments_status_idx" ON "rent_payments"("status");
CREATE INDEX "rent_payments_dueDate_idx" ON "rent_payments"("dueDate");
CREATE INDEX "contract_documents_tenantId_idx" ON "contract_documents"("tenantId");
CREATE INDEX "contract_documents_contractId_idx" ON "contract_documents"("contractId");
CREATE INDEX "property_expenses_tenantId_idx" ON "property_expenses"("tenantId");
CREATE INDEX "property_expenses_propertyId_idx" ON "property_expenses"("propertyId");
