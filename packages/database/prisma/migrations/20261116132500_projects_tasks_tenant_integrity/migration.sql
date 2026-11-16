-- Additive backfill for Prisma Project and Task tables absent after the
-- existing 34 migrations on a brand-new PostgreSQL 17 instance.
-- No data is deleted, no existing table is overwritten, and this change
-- must pass disposable DB E2E before a production migration is considered.
DO $$ BEGIN
  CREATE TYPE public."ProjectStatus" AS ENUM ('PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public."ProjectPriority" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public."TaskStatus" AS ENUM ('TODO','IN_PROGRESS','IN_REVIEW','DONE','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public."TaskPriority" AS ENUM ('LOW','MEDIUM','HIGH','URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public."projects" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" public."ProjectStatus" NOT NULL DEFAULT 'PLANNING',
  "priority" public."ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "budget" DECIMAL(18,2),
  "progress" INTEGER NOT NULL DEFAULT 0,
  "clientId" TEXT,
  "managerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "projects_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES public."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "projects_tenantId_idx" ON public."projects"("tenantId");
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON public."projects"("status");

CREATE TABLE IF NOT EXISTS public."tasks" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "projectId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" public."TaskStatus" NOT NULL DEFAULT 'TODO',
  "priority" public."TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "assignedToId" TEXT,
  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "estimatedHours" DECIMAL(5,2),
  "actualHours" DECIMAL(5,2),
  "parentId" TEXT,
  "boardColumn" TEXT DEFAULT 'TODO',
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tasks_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES public."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId")
    REFERENCES public."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "tasks_tenantId_idx" ON public."tasks"("tenantId");
CREATE INDEX IF NOT EXISTS "tasks_projectId_idx" ON public."tasks"("projectId");
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON public."tasks"("status");
CREATE INDEX IF NOT EXISTS "tasks_assignedToId_idx" ON public."tasks"("assignedToId");
