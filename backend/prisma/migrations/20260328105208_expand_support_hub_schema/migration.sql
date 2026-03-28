-- DropForeignKey
ALTER TABLE "SupportRequest" DROP CONSTRAINT "SupportRequest_eventId_fkey";

-- AlterTable
ALTER TABLE "SupportRequest" ADD COLUMN     "adminReply" TEXT,
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'EVENT_FUNDING',
ALTER COLUMN "eventId" DROP NOT NULL,
ALTER COLUMN "amountRequired" SET DEFAULT 0;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
