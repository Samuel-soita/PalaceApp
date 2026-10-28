-- Approval rows now distinguish "assigned" (approved = false) from "signed" (approved = true).
-- Before this, event approval rows were only written when someone signed.
UPDATE "EventApproval" SET "approved" = true WHERE "approved" = false;

-- Plan/project/announcement rows were pre-created for the assigned approvers in the same
-- transaction as the parent; rows written later came from an actual sign-off.
UPDATE "PlanApproval" a SET "approved" = true
FROM "Plan" p
WHERE a."planId" = p."id" AND a."approved" = false
  AND a."createdAt" > p."createdAt" + INTERVAL '5 seconds';

UPDATE "ProjectApproval" a SET "approved" = true
FROM "Project" p
WHERE a."projectId" = p."id" AND a."approved" = false
  AND a."createdAt" > p."createdAt" + INTERVAL '5 seconds';

UPDATE "AnnouncementApproval" a SET "approved" = true
FROM "Announcement" p
WHERE a."announcementId" = p."id" AND a."approved" = false
  AND a."createdAt" > p."createdAt" + INTERVAL '5 seconds';
