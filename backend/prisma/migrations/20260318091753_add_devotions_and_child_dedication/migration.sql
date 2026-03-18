-- AlterTable
ALTER TABLE "Child" ADD COLUMN     "dedicationCardNumber" TEXT,
ADD COLUMN     "isDedicated" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "dedicationNumber" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Devotion" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "themeOfMonth" TEXT NOT NULL,
    "themeOfYear" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Devotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevotionInteraction" (
    "id" TEXT NOT NULL,
    "devotionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevotionInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Devotion_date_key" ON "Devotion"("date");

-- CreateIndex
CREATE INDEX "DevotionInteraction_devotionId_idx" ON "DevotionInteraction"("devotionId");

-- CreateIndex
CREATE INDEX "DevotionInteraction_userId_idx" ON "DevotionInteraction"("userId");

-- AddForeignKey
ALTER TABLE "DevotionInteraction" ADD CONSTRAINT "DevotionInteraction_devotionId_fkey" FOREIGN KEY ("devotionId") REFERENCES "Devotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevotionInteraction" ADD CONSTRAINT "DevotionInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
