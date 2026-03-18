-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "Child_departmentId_idx" ON "Child"("departmentId");

-- CreateIndex
CREATE INDEX "Child_branch_idx" ON "Child"("branch");

-- CreateIndex
CREATE INDEX "Child_dob_idx" ON "Child"("dob");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_approvalStatus_idx" ON "Event"("approvalStatus");

-- CreateIndex
CREATE INDEX "Event_departmentId_idx" ON "Event"("departmentId");

-- CreateIndex
CREATE INDEX "Plan_approvalStatus_idx" ON "Plan"("approvalStatus");

-- CreateIndex
CREATE INDEX "Plan_departmentId_idx" ON "Plan"("departmentId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_approvalStatus_idx" ON "Project"("approvalStatus");

-- CreateIndex
CREATE INDEX "Project_departmentId_idx" ON "Project"("departmentId");

-- CreateIndex
CREATE INDEX "User_dob_idx" ON "User"("dob");

-- CreateIndex
CREATE INDEX "User_gender_idx" ON "User"("gender");
