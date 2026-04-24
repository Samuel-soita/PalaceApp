-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "gender" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "membershipNumber" TEXT NOT NULL,
    "membershipNumberUpdatedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "departmentId" TEXT,
    "phoneNumber" TEXT,
    "profilePhoto" TEXT,
    "deletionRequested" BOOLEAN NOT NULL DEFAULT false,
    "authenticatedAt" TIMESTAMP(3),
    "authenticatedById" TEXT,
    "wrongdoingCount" INTEGER NOT NULL DEFAULT 0,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "lastSuspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isCardPaid" BOOLEAN NOT NULL DEFAULT false,
    "isPartner" BOOLEAN NOT NULL DEFAULT false,
    "canManagePartnerships" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "cardStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isCardReplacementRequested" BOOLEAN NOT NULL DEFAULT false,
    "membershipExpiry" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "dedicationNumber" TEXT,
    "parentId" TEXT NOT NULL,
    "departmentId" TEXT,
    "branch" TEXT NOT NULL DEFAULT 'HQ',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "workflowStatus" TEXT NOT NULL DEFAULT 'PENDING_DEDICATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dedicationCardNumber" TEXT,
    "isDedicated" BOOLEAN NOT NULL DEFAULT false,
    "plannedDate" TIMESTAMP(3),
    "plannedTime" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "dedicationPaymentReference" TEXT,
    "isDedicationPaid" BOOLEAN NOT NULL DEFAULT false,
    "assignedPastorId" TEXT,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devotion" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "themeOfMonth" TEXT NOT NULL,
    "themeOfYear" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,

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

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leaderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "budgetNeeded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budgetSource" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "volunteersNeeded" INTEGER NOT NULL DEFAULT 0,
    "eventType" TEXT NOT NULL DEFAULT 'DEPARTMENT_EVENT',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "isMajor" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "whatsappGroupLink" TEXT,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "targetPastorId" TEXT,
    "createdById" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "meetingType" TEXT NOT NULL,
    "agenda" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "followUpPersonId" TEXT,
    "followUpDeadline" TIMESTAMP(3),
    "followUpStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "meetingStatus" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "minutes" TEXT,
    "attendance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isPartnerOnly" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "targetPastorId" TEXT,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiry" TIMESTAMP(3),
    "eventDate" TIMESTAMP(3),
    "eventTime" TEXT,
    "location" TEXT,
    "authorId" TEXT NOT NULL,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isMajor" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "targetPastorId" TEXT,
    "projectId" TEXT,
    "eventId" TEXT,
    "planId" TEXT,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "departmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "category" TEXT NOT NULL DEFAULT 'NEW_PROJECT',
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budgetSource" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "whatsappGroupLink" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isMajor" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "targetPastorId" TEXT,
    "createdById" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "budgetSource" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isMajor" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "targetPastorId" TEXT,
    "createdById" TEXT,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT,
    "departmentId" TEXT,
    "projectId" TEXT,
    "eventId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "chatType" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "taggedDepartmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalExpenditure" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_LEADER_APPROVAL',
    "requestedById" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "deliveryChannel" TEXT NOT NULL DEFAULT 'IN_APP',
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingApproval" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementApproval" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "requesterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountRequired" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proofImageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adminReply" TEXT,
    "category" TEXT NOT NULL DEFAULT 'EVENT_FUNDING',

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventApproval" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectApproval" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanApproval" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityId" TEXT,
    "entityType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actionType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL DEFAULT 'MEMBER',
    "afterState" JSONB,
    "beforeState" JSONB,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "userAgent" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Baptism" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PASTOR_APPROVAL',
    "recordedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "baptismCardNumber" TEXT,
    "plannedDate" TIMESTAMP(3),
    "plannedTime" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paymentReference" TEXT,

    CONSTRAINT "Baptism_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partnership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastPaymentDate" TIMESTAMP(3),
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Partnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnershipLedger" (
    "id" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionType" TEXT NOT NULL DEFAULT 'CREDIT',
    "paymentMethod" TEXT NOT NULL DEFAULT 'MPESA',
    "referenceCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VERIFIED',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnershipLedger_pkey" PRIMARY KEY ("id")
);

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
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "PermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT,
    "creatorId" TEXT NOT NULL,

    CONSTRAINT "PermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobQueue" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "JobQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemMetric" (
    "id" TEXT NOT NULL,
    "latency" DOUBLE PRECISION NOT NULL,
    "activeUsers" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "failedJobs" INTEGER NOT NULL,
    "wsConnections" INTEGER NOT NULL,
    "pendingApproval" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failureRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "syncSuccessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "SystemMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastorModuleAccess" (
    "id" TEXT NOT NULL,
    "pastorId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PastorModuleAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "departmentId" TEXT NOT NULL,
    "linkedEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetContributor" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetContributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentReport" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "downloadedAt" TIMESTAMP(3),

    CONSTRAINT "DepartmentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalRepair" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "instrumentName" TEXT NOT NULL,
    "problemDescription" TEXT NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "budgetSource" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "status" TEXT NOT NULL DEFAULT 'PENDING_PASTOR_1',
    "requesterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TechnicalRepair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairApproval" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatuaActionLog" (
    "id" TEXT NOT NULL,
    "engineerId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "approvalChain" JSONB,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatuaActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistrySettings" (
    "id" TEXT NOT NULL DEFAULT 'GLOBAL',
    "themeOfYear" TEXT NOT NULL DEFAULT 'YEAR OF DIVINE ESTABLISHMENT',
    "themeOfMonth" TEXT NOT NULL DEFAULT 'MONTH OF NEW BEGINNINGS',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MinistrySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affirmation" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "devotionId" TEXT,

    CONSTRAINT "Affirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DeptManagers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_MessageTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_idNumber_key" ON "User"("idNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_membershipNumber_key" ON "User"("membershipNumber");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_dob_idx" ON "User"("dob");

-- CreateIndex
CREATE INDEX "User_gender_idx" ON "User"("gender");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "User_updatedAt_idx" ON "User"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Child_dedicationNumber_key" ON "Child"("dedicationNumber");

-- CreateIndex
CREATE INDEX "Child_name_idx" ON "Child"("name");

-- CreateIndex
CREATE INDEX "Child_workflowStatus_idx" ON "Child"("workflowStatus");

-- CreateIndex
CREATE INDEX "Child_parentId_idx" ON "Child"("parentId");

-- CreateIndex
CREATE INDEX "Child_departmentId_idx" ON "Child"("departmentId");

-- CreateIndex
CREATE INDEX "Child_branch_idx" ON "Child"("branch");

-- CreateIndex
CREATE INDEX "Child_dob_idx" ON "Child"("dob");

-- CreateIndex
CREATE INDEX "Child_deletedAt_idx" ON "Child"("deletedAt");

-- CreateIndex
CREATE INDEX "Child_updatedAt_idx" ON "Child"("updatedAt");

-- CreateIndex
CREATE INDEX "Child_assignedPastorId_idx" ON "Child"("assignedPastorId");

-- CreateIndex
CREATE UNIQUE INDEX "Child_name_dob_branch_key" ON "Child"("name", "dob", "branch");

-- CreateIndex
CREATE UNIQUE INDEX "Devotion_date_key" ON "Devotion"("date");

-- CreateIndex
CREATE INDEX "DevotionInteraction_devotionId_idx" ON "DevotionInteraction"("devotionId");

-- CreateIndex
CREATE INDEX "DevotionInteraction_userId_idx" ON "DevotionInteraction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "Department_deletedAt_idx" ON "Department"("deletedAt");

-- CreateIndex
CREATE INDEX "Department_updatedAt_idx" ON "Department"("updatedAt");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_approvalStatus_idx" ON "Event"("approvalStatus");

-- CreateIndex
CREATE INDEX "Event_departmentId_idx" ON "Event"("departmentId");

-- CreateIndex
CREATE INDEX "Event_deletedAt_idx" ON "Event"("deletedAt");

-- CreateIndex
CREATE INDEX "Event_updatedAt_idx" ON "Event"("updatedAt");

-- CreateIndex
CREATE INDEX "Meeting_deletedAt_idx" ON "Meeting"("deletedAt");

-- CreateIndex
CREATE INDEX "Meeting_updatedAt_idx" ON "Meeting"("updatedAt");

-- CreateIndex
CREATE INDEX "Announcement_status_idx" ON "Announcement"("status");

-- CreateIndex
CREATE INDEX "Announcement_departmentId_idx" ON "Announcement"("departmentId");

-- CreateIndex
CREATE INDEX "Announcement_isGlobal_idx" ON "Announcement"("isGlobal");

-- CreateIndex
CREATE INDEX "Announcement_isMajor_idx" ON "Announcement"("isMajor");

-- CreateIndex
CREATE INDEX "Announcement_deletedAt_idx" ON "Announcement"("deletedAt");

-- CreateIndex
CREATE INDEX "Announcement_updatedAt_idx" ON "Announcement"("updatedAt");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_approvalStatus_idx" ON "Project"("approvalStatus");

-- CreateIndex
CREATE INDEX "Project_departmentId_idx" ON "Project"("departmentId");

-- CreateIndex
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- CreateIndex
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");

-- CreateIndex
CREATE INDEX "Plan_approvalStatus_idx" ON "Plan"("approvalStatus");

-- CreateIndex
CREATE INDEX "Plan_departmentId_idx" ON "Plan"("departmentId");

-- CreateIndex
CREATE INDEX "Plan_deletedAt_idx" ON "Plan"("deletedAt");

-- CreateIndex
CREATE INDEX "Plan_updatedAt_idx" ON "Plan"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Account_departmentId_key" ON "Account"("departmentId");

-- CreateIndex
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_updatedAt_idx" ON "Transaction"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionApproval_transactionId_userId_key" ON "TransactionApproval"("transactionId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingApproval_meetingId_userId_key" ON "MeetingApproval"("meetingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementApproval_announcementId_userId_key" ON "AnnouncementApproval"("announcementId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventApproval_eventId_userId_key" ON "EventApproval"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectApproval_projectId_userId_key" ON "ProjectApproval"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanApproval_planId_userId_key" ON "PlanApproval"("planId", "userId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actionType_idx" ON "AuditLog"("actionType");

-- CreateIndex
CREATE INDEX "Baptism_deletedAt_idx" ON "Baptism"("deletedAt");

-- CreateIndex
CREATE INDEX "Partnership_userId_idx" ON "Partnership"("userId");

-- CreateIndex
CREATE INDEX "Partnership_deletedAt_idx" ON "Partnership"("deletedAt");

-- CreateIndex
CREATE INDEX "Partnership_updatedAt_idx" ON "Partnership"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnershipLedger_referenceCode_key" ON "PartnershipLedger"("referenceCode");

-- CreateIndex
CREATE INDEX "PartnershipLedger_partnershipId_idx" ON "PartnershipLedger"("partnershipId");

-- CreateIndex
CREATE INDEX "PartnershipLedger_deletedAt_idx" ON "PartnershipLedger"("deletedAt");

-- CreateIndex
CREATE INDEX "PartnershipLedger_updatedAt_idx" ON "PartnershipLedger"("updatedAt");

-- CreateIndex
CREATE INDEX "Appointment_memberId_idx" ON "Appointment"("memberId");

-- CreateIndex
CREATE INDEX "Appointment_targetId_idx" ON "Appointment"("targetId");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_deletedAt_idx" ON "Appointment"("deletedAt");

-- CreateIndex
CREATE INDEX "Appointment_updatedAt_idx" ON "Appointment"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionOverride_userId_permissionId_key" ON "PermissionOverride"("userId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_name_key" ON "FeatureFlag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PastorModuleAccess_pastorId_moduleKey_key" ON "PastorModuleAccess"("pastorId", "moduleKey");

-- CreateIndex
CREATE INDEX "Budget_departmentId_idx" ON "Budget"("departmentId");

-- CreateIndex
CREATE INDEX "Budget_deletedAt_idx" ON "Budget"("deletedAt");

-- CreateIndex
CREATE INDEX "BudgetContributor_budgetId_idx" ON "BudgetContributor"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetContributor_userId_idx" ON "BudgetContributor"("userId");

-- CreateIndex
CREATE INDEX "DepartmentReport_departmentId_idx" ON "DepartmentReport"("departmentId");

-- CreateIndex
CREATE INDEX "DepartmentReport_type_idx" ON "DepartmentReport"("type");

-- CreateIndex
CREATE INDEX "TechnicalRepair_departmentId_idx" ON "TechnicalRepair"("departmentId");

-- CreateIndex
CREATE INDEX "TechnicalRepair_status_idx" ON "TechnicalRepair"("status");

-- CreateIndex
CREATE INDEX "TechnicalRepair_deletedAt_idx" ON "TechnicalRepair"("deletedAt");

-- CreateIndex
CREATE INDEX "TechnicalRepair_updatedAt_idx" ON "TechnicalRepair"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RepairApproval_repairId_userId_key" ON "RepairApproval"("repairId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Affirmation_date_key" ON "Affirmation"("date");

-- CreateIndex
CREATE UNIQUE INDEX "_DeptManagers_AB_unique" ON "_DeptManagers"("A", "B");

-- CreateIndex
CREATE INDEX "_DeptManagers_B_index" ON "_DeptManagers"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_MessageTags_AB_unique" ON "_MessageTags"("A", "B");

-- CreateIndex
CREATE INDEX "_MessageTags_B_index" ON "_MessageTags"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_authenticatedById_fkey" FOREIGN KEY ("authenticatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_assignedPastorId_fkey" FOREIGN KEY ("assignedPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devotion" ADD CONSTRAINT "Devotion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevotionInteraction" ADD CONSTRAINT "DevotionInteraction_devotionId_fkey" FOREIGN KEY ("devotionId") REFERENCES "Devotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevotionInteraction" ADD CONSTRAINT "DevotionInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_targetPastorId_fkey" FOREIGN KEY ("targetPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_followUpPersonId_fkey" FOREIGN KEY ("followUpPersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_targetPastorId_fkey" FOREIGN KEY ("targetPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_targetPastorId_fkey" FOREIGN KEY ("targetPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_targetPastorId_fkey" FOREIGN KEY ("targetPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_targetPastorId_fkey" FOREIGN KEY ("targetPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionApproval" ADD CONSTRAINT "TransactionApproval_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionApproval" ADD CONSTRAINT "TransactionApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingApproval" ADD CONSTRAINT "MeetingApproval_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingApproval" ADD CONSTRAINT "MeetingApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementApproval" ADD CONSTRAINT "AnnouncementApproval_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementApproval" ADD CONSTRAINT "AnnouncementApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventApproval" ADD CONSTRAINT "EventApproval_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventApproval" ADD CONSTRAINT "EventApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectApproval" ADD CONSTRAINT "ProjectApproval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectApproval" ADD CONSTRAINT "ProjectApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanApproval" ADD CONSTRAINT "PlanApproval_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanApproval" ADD CONSTRAINT "PlanApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baptism" ADD CONSTRAINT "Baptism_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partnership" ADD CONSTRAINT "Partnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnershipLedger" ADD CONSTRAINT "PartnershipLedger_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "Partnership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionOverride" ADD CONSTRAINT "PermissionOverride_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionOverride" ADD CONSTRAINT "PermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastorModuleAccess" ADD CONSTRAINT "PastorModuleAccess_pastorId_fkey" FOREIGN KEY ("pastorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetContributor" ADD CONSTRAINT "BudgetContributor_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetContributor" ADD CONSTRAINT "BudgetContributor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentReport" ADD CONSTRAINT "DepartmentReport_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentReport" ADD CONSTRAINT "DepartmentReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalRepair" ADD CONSTRAINT "TechnicalRepair_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalRepair" ADD CONSTRAINT "TechnicalRepair_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairApproval" ADD CONSTRAINT "RepairApproval_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "TechnicalRepair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairApproval" ADD CONSTRAINT "RepairApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affirmation" ADD CONSTRAINT "Affirmation_devotionId_fkey" FOREIGN KEY ("devotionId") REFERENCES "Devotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeptManagers" ADD CONSTRAINT "_DeptManagers_A_fkey" FOREIGN KEY ("A") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeptManagers" ADD CONSTRAINT "_DeptManagers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageTags" ADD CONSTRAINT "_MessageTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageTags" ADD CONSTRAINT "_MessageTags_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

