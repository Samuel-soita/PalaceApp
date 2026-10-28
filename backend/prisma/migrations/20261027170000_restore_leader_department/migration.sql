-- The dashboard used to remap every user (not only members) into an age/gender fellowship,
-- which moved department leaders out of the department they lead. Point each leader back to
-- the single live department they lead (Department.leaderId), else the single one they manage.

UPDATE "User" u
SET "departmentId" = d."id"
FROM "Department" d
WHERE u."role" = 'DEPARTMENT_LEADER'
  AND u."deletedAt" IS NULL
  AND d."leaderId" = u."id"
  AND d."deletedAt" IS NULL
  AND u."departmentId" IS DISTINCT FROM d."id"
  AND (SELECT COUNT(*) FROM "Department" d2 WHERE d2."leaderId" = u."id" AND d2."deletedAt" IS NULL) = 1;

UPDATE "User" u
SET "departmentId" = m."A"
FROM "_DeptManagers" m
JOIN "Department" d ON d."id" = m."A" AND d."deletedAt" IS NULL
WHERE m."B" = u."id"
  AND u."role" = 'DEPARTMENT_LEADER'
  AND u."deletedAt" IS NULL
  AND u."departmentId" IS DISTINCT FROM m."A"
  AND NOT EXISTS (SELECT 1 FROM "Department" d3 WHERE d3."leaderId" = u."id" AND d3."deletedAt" IS NULL)
  AND (SELECT COUNT(*) FROM "_DeptManagers" m2 JOIN "Department" d4 ON d4."id" = m2."A" AND d4."deletedAt" IS NULL WHERE m2."B" = u."id") = 1;
