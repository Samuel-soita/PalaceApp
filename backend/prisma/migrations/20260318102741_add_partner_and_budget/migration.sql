-- AlterTable
ALTER TABLE "MinistrySettings" ADD COLUMN     "churchBudget" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPartner" BOOLEAN NOT NULL DEFAULT false;
