-- AlterTable
ALTER TABLE "Baptism" ADD COLUMN     "baptismCardNumber" TEXT,
ADD COLUMN     "plannedDate" TIMESTAMP(3),
ADD COLUMN     "plannedTime" TEXT;

-- AlterTable
ALTER TABLE "Child" ADD COLUMN     "plannedDate" TIMESTAMP(3),
ADD COLUMN     "plannedTime" TEXT;

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "targetId" TEXT,
    "targetRole" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "preferredDate" TIMESTAMP(3) NOT NULL,
    "preferredTime" TEXT NOT NULL,
    "approvedDate" TIMESTAMP(3),
    "approvedTime" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_memberId_idx" ON "Appointment"("memberId");

-- CreateIndex
CREATE INDEX "Appointment_targetId_idx" ON "Appointment"("targetId");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
