-- Idempotent: production databases may already have these from manual_migration.sql.

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

ALTER TABLE "AnnouncementApproval" ADD COLUMN IF NOT EXISTS "approved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventApproval" ADD COLUMN IF NOT EXISTS "approved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlanApproval" ADD COLUMN IF NOT EXISTS "approved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectApproval" ADD COLUMN IF NOT EXISTS "approved" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Announcement" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED';
ALTER TABLE "Baptism" ALTER COLUMN "status" SET DEFAULT 'APPROVED';
ALTER TABLE "Event" ALTER COLUMN "approvalStatus" SET DEFAULT 'APPROVED';
ALTER TABLE "Meeting" ALTER COLUMN "meetingStatus" SET DEFAULT 'SCHEDULED';
ALTER TABLE "Project" ALTER COLUMN "approvalStatus" SET DEFAULT 'APPROVED';
ALTER TABLE "Transaction" ALTER COLUMN "status" SET DEFAULT 'APPROVED';

ALTER TABLE "DepartmentReport" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PastorModuleAccess" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "TechnicalRepair" ALTER COLUMN "updatedAt" DROP DEFAULT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Event_createdById_fkey') THEN
        ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_createdById_fkey') THEN
        ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Plan_createdById_fkey') THEN
        ALTER TABLE "Plan" ADD CONSTRAINT "Plan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
