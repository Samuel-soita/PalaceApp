-- Edits and deletes must reach other devices through delta sync, which filters on updatedAt.
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Message" SET "updatedAt" = "createdAt";
CREATE INDEX IF NOT EXISTS "Message_updatedAt_idx" ON "Message"("updatedAt");
