-- Sync schema with Prisma models (events, plans, announcements, messages, repairs, etc.)

-- Drop legacy Volunteer table if it still exists (skip FK drop when table is already gone)
DROP TABLE IF EXISTS "Volunteer";
ALTER TABLE "Affirmation" ADD COLUMN IF NOT EXISTS "devotionId" TEXT;

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "eventDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "eventTime" TEXT,
ADD COLUMN IF NOT EXISTS "location" TEXT,
ADD COLUMN IF NOT EXISTS "targetPastorId" TEXT;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedBy" TEXT,
ADD COLUMN IF NOT EXISTS "deletedReason" TEXT;

-- AlterTable
ALTER TABLE "Child" ADD COLUMN IF NOT EXISTS "assignedPastorId" TEXT;

-- AlterTable
ALTER TABLE "Devotion" ADD COLUMN IF NOT EXISTS "authorId" TEXT,
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "budgetSource" TEXT NOT NULL DEFAULT 'DEPARTMENT',
ADD COLUMN IF NOT EXISTS "targetPastorId" TEXT;

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "targetPastorId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "taggedDepartmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "MinistrySettings" DROP COLUMN IF EXISTS "churchBudget";

-- AlterTable: Plan.description -> content (idempotent)
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "budgetSource" TEXT NOT NULL DEFAULT 'DEPARTMENT';
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "content" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PLANNED';
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "targetPastorId" TEXT;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Plan' AND column_name = 'description'
  ) THEN
    UPDATE "Plan" SET "content" = COALESCE("description", '') WHERE "content" IS NULL OR "content" = '';
    ALTER TABLE "Plan" DROP COLUMN "description";
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "budgetSource" TEXT NOT NULL DEFAULT 'DEPARTMENT',
ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'NEW_PROJECT',
ADD COLUMN IF NOT EXISTS "targetPastorId" TEXT;

-- AlterTable
ALTER TABLE "SystemMetric" ADD COLUMN IF NOT EXISTS "failureRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "syncSuccessRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PastorModuleAccess" (
    "id" TEXT NOT NULL,
    "pastorId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PastorModuleAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DepartmentReport" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadedAt" TIMESTAMP(3),
    CONSTRAINT "DepartmentReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TechnicalRepair" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "instrumentName" TEXT NOT NULL,
    "problemDescription" TEXT NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "budgetSource" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "status" TEXT NOT NULL DEFAULT 'PENDING_PASTOR_1',
    "requesterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TechnicalRepair_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RepairApproval" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RepairApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "_MessageTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "PastorModuleAccess_pastorId_moduleKey_key" ON "PastorModuleAccess"("pastorId", "moduleKey");
CREATE INDEX IF NOT EXISTS "DepartmentReport_departmentId_idx" ON "DepartmentReport"("departmentId");
CREATE INDEX IF NOT EXISTS "DepartmentReport_type_idx" ON "DepartmentReport"("type");
CREATE INDEX IF NOT EXISTS "TechnicalRepair_departmentId_idx" ON "TechnicalRepair"("departmentId");
CREATE INDEX IF NOT EXISTS "TechnicalRepair_status_idx" ON "TechnicalRepair"("status");
CREATE INDEX IF NOT EXISTS "TechnicalRepair_deletedAt_idx" ON "TechnicalRepair"("deletedAt");
CREATE INDEX IF NOT EXISTS "TechnicalRepair_updatedAt_idx" ON "TechnicalRepair"("updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "RepairApproval_repairId_userId_key" ON "RepairApproval"("repairId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "_MessageTags_AB_unique" ON "_MessageTags"("A", "B");
CREATE INDEX IF NOT EXISTS "_MessageTags_B_index" ON "_MessageTags"("B");
CREATE INDEX IF NOT EXISTS "Appointment_deletedAt_idx" ON "Appointment"("deletedAt");
CREATE INDEX IF NOT EXISTS "Appointment_updatedAt_idx" ON "Appointment"("updatedAt");
CREATE INDEX IF NOT EXISTS "Child_assignedPastorId_idx" ON "Child"("assignedPastorId");

DO $$ BEGIN
  ALTER TABLE "Child" ADD CONSTRAINT "Child_assignedPastorId_fkey" FOREIGN KEY ("assignedPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Devotion" ADD CONSTRAINT "Devotion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Event" ADD CONSTRAINT "Event_targetPastorId_fkey" FOREIGN KEY ("targetPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_targetPastorId_fkey" FOREIGN KEY ("targetPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_targetPastorId_fkey" FOREIGN KEY ("targetPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_targetPastorId_fkey" FOREIGN KEY ("targetPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Plan" ADD CONSTRAINT "Plan_targetPastorId_fkey" FOREIGN KEY ("targetPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PastorModuleAccess" ADD CONSTRAINT "PastorModuleAccess_pastorId_fkey" FOREIGN KEY ("pastorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DepartmentReport" ADD CONSTRAINT "DepartmentReport_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DepartmentReport" ADD CONSTRAINT "DepartmentReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TechnicalRepair" ADD CONSTRAINT "TechnicalRepair_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TechnicalRepair" ADD CONSTRAINT "TechnicalRepair_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RepairApproval" ADD CONSTRAINT "RepairApproval_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "TechnicalRepair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RepairApproval" ADD CONSTRAINT "RepairApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Affirmation" ADD CONSTRAINT "Affirmation_devotionId_fkey" FOREIGN KEY ("devotionId") REFERENCES "Devotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "_MessageTags" ADD CONSTRAINT "_MessageTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "_MessageTags" ADD CONSTRAINT "_MessageTags_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
