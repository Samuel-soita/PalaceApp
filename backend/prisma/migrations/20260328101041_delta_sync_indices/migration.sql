/*
  Warnings:

  - You are about to drop the column `approvedById` on the `Transaction` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `PartnershipLedger` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_approvedById_fkey";

-- AlterTable
ALTER TABLE "Baptism" ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentReference" TEXT;

-- AlterTable
ALTER TABLE "Child" ADD COLUMN     "dedicationPaymentReference" TEXT,
ADD COLUMN     "isDedicationPaid" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PartnershipLedger" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "approvedById",
ALTER COLUMN "status" SET DEFAULT 'PENDING_LEADER_APPROVAL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cardStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "isCardReplacementRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "membershipExpiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TransactionApproval" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionApproval_transactionId_userId_key" ON "TransactionApproval"("transactionId", "userId");

-- CreateIndex
CREATE INDEX "Announcement_updatedAt_idx" ON "Announcement"("updatedAt");

-- CreateIndex
CREATE INDEX "AuditLog_actionType_idx" ON "AuditLog"("actionType");

-- CreateIndex
CREATE INDEX "Child_updatedAt_idx" ON "Child"("updatedAt");

-- CreateIndex
CREATE INDEX "Department_updatedAt_idx" ON "Department"("updatedAt");

-- CreateIndex
CREATE INDEX "Event_updatedAt_idx" ON "Event"("updatedAt");

-- CreateIndex
CREATE INDEX "Meeting_updatedAt_idx" ON "Meeting"("updatedAt");

-- CreateIndex
CREATE INDEX "Partnership_updatedAt_idx" ON "Partnership"("updatedAt");

-- CreateIndex
CREATE INDEX "PartnershipLedger_updatedAt_idx" ON "PartnershipLedger"("updatedAt");

-- CreateIndex
CREATE INDEX "Plan_updatedAt_idx" ON "Plan"("updatedAt");

-- CreateIndex
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");

-- CreateIndex
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_updatedAt_idx" ON "Transaction"("updatedAt");

-- CreateIndex
CREATE INDEX "User_updatedAt_idx" ON "User"("updatedAt");

-- AddForeignKey
ALTER TABLE "TransactionApproval" ADD CONSTRAINT "TransactionApproval_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionApproval" ADD CONSTRAINT "TransactionApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
