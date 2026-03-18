/*
  Warnings:

  - You are about to drop the `Asset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Budget` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Contributor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Strategy` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "Budget" DROP CONSTRAINT "Budget_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "Contributor" DROP CONSTRAINT "Contributor_budgetId_fkey";

-- DropForeignKey
ALTER TABLE "Contributor" DROP CONSTRAINT "Contributor_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "Strategy" DROP CONSTRAINT "Strategy_departmentId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isCardPaid" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "Asset";

-- DropTable
DROP TABLE "Budget";

-- DropTable
DROP TABLE "Contributor";

-- DropTable
DROP TABLE "Strategy";
