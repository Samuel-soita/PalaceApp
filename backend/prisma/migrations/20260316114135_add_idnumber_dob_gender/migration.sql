/*
  Warnings:

  - Added the required column `dob` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idNumber` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "dob" DATETIME NOT NULL,
    "gender" TEXT,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "membershipNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "departmentId" TEXT,
    "wrongdoingCount" INTEGER NOT NULL DEFAULT 0,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "lastSuspendedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "departmentId", "email", "id", "idNumber", "dob", "gender", "isSuspended", "lastSuspendedAt", "membershipNumber", "name", "password", "role", "status", "updatedAt", "wrongdoingCount") SELECT "avatarUrl", "createdAt", "departmentId", "email", "id", 'LEGACY-' || "id", '1990-01-01', NULL, "isSuspended", "lastSuspendedAt", "membershipNumber", "name", "password", "role", "status", "updatedAt", "wrongdoingCount" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_idNumber_key" ON "User"("idNumber");
CREATE UNIQUE INDEX "User_membershipNumber_key" ON "User"("membershipNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
