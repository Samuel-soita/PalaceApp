-- CreateTable
CREATE TABLE "MinistrySettings" (
    "id" TEXT NOT NULL DEFAULT 'GLOBAL',
    "themeOfYear" TEXT NOT NULL DEFAULT 'YEAR OF DIVINE ESTABLISHMENT',
    "themeOfMonth" TEXT NOT NULL DEFAULT 'MONTH OF NEW BEGINNINGS',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinistrySettings_pkey" PRIMARY KEY ("id")
);
