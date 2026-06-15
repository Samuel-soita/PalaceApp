-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Announcement_projectId_idx" ON "Announcement"("projectId");
CREATE INDEX IF NOT EXISTS "Announcement_eventId_idx" ON "Announcement"("eventId");
CREATE INDEX IF NOT EXISTS "Announcement_planId_idx" ON "Announcement"("planId");

DO $$ BEGIN
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
