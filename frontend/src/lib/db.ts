import Dexie, { Table } from 'dexie';

export interface LocalEvent {
    id: string;
    title: string;
    description: string;
    date: Date | string;
    time: string;
    location: string;
    departmentId: string;
    budgetNeeded?: number;
    volunteersNeeded?: number;
    eventType: string;
    status: string;
    approvalStatus: string;
    attachmentUrl?: string | null;
    isMajor: boolean;
    pastorIds: string[];
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface LocalProject {
    id: string;
    title: string;
    description: string;
    departmentId: string;
    budget: number;
    deadline: Date | string;
    category: 'INFRASTRUCTURE' | 'OUTREACH' | 'TECH' | 'YOUTH' | 'GENERAL';
    pastorIds: string[];
    status: string;
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface LocalPlan {
    id: string;
    title: string;
    description: string;
    type: string;
    departmentId?: string;
    isMajor: boolean;
    pastorIds: string[];
    approvalStatus: string;
    department?: { name: string };
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface LocalAnnouncement {
    id: string;
    title: string;
    content: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';
    expiry?: Date | string | null;
    departmentId?: string | null;
    isGlobal: boolean;
    isMajor: boolean;
    pastorIds?: string[];
    status: string;
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface LocalMeeting {
    id: string;
    title: string;
    departmentId?: string | null;
    date: Date | string;
    time: string;
    venue: string;
    meetingType: 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
    agenda?: string;
    followUpPersonId?: string | null;
    followUpDeadline?: Date | string | null;
    isPartnerOnly: boolean;
    pastorIds?: string[];
    meetingStatus: string;
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface LocalDevotion {
    id: string;
    title: string;
    content: string;
    themeOfMonth?: string;
    themeOfYear?: string;
    date: Date | string;
    authorId: string;
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface LocalMessage {
    id: string;
    senderId: string;
    receiverId?: string;
    departmentId?: string;
    projectId?: string;
    eventId?: string;
    content: string;
    chatType: 'PRIVATE' | 'DEPARTMENT' | 'PROJECT' | 'EVENT' | 'GLOBAL';
    taggedUserIds?: string[];
    taggedDepartmentIds?: string[];
    timestamp: Date | string;
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    isEdited?: boolean;
    isDeleted?: boolean;
    sender?: { name: string; role: string; avatarUrl?: string | null };
    createdAt?: string | Date;
}

export interface SyncJob {
    id: string;
    timestamp: number;
    entity: 'EVENT' | 'USER' | 'DEPARTMENT' | 'PROJECT' | 'PLAN' | 'ANNOUNCEMENT' | 'MEETING' | 'DEVOTION' | 'MESSAGE';
    method: 'POST' | 'PATCH' | 'DELETE';
    url: string;
    payload: any;
    status: 'PENDING' | 'RETRYING' | 'FAILED';
    retryCount: number;
    errorLog: string[];
}

export interface LocalUser {
    id: string;
    name: string;
    role: string;
    departmentId?: string;
    syncStatus: string;
}

export interface LocalTransaction {
    id: string;
    amount: number;
    type: 'CONTRIBUTION' | 'WITHDRAWAL' | 'REPAIR' | 'PARTNERSHIP';
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    description: string;
    category: string;
    requestedById: string;
    approvedById?: string | null;
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface LocalAccount {
    id: string;
    balance: number;
    totalContributions: number;
    totalWithdrawals: number;
    updatedAt: Date | string;
}

export interface LocalRepair {
    id: string;
    instrumentName: string;
    problemDescription: string;
    estimatedCost: number;
    status: string;
    departmentId: string;
    requesterId: string;
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    createdAt?: Date | string;
    updatedAt?: Date | string;
    department?: any;
    requester?: any;
    approvals?: any[];
}

export interface LocalAppointment {
    id: string;
    memberId: string;
    targetId?: string | null;
    targetRole: string;
    type: string;
    reason: string;
    status: string;
    preferredDate: Date | string;
    preferredTime: string;
    approvedDate?: Date | string | null;
    approvedTime?: string | null;
    adminNotes?: string | null;
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    createdAt?: Date | string;
    updatedAt?: Date | string;
    member?: any;
    target?: any;
}

export interface LocalPartnership {
    id: string;
    userId: string;
    amount: number;
    frequency: string;
    status: string;
    balance: number;
    paidAmount: number;
    lastPaymentDate?: Date | string | null;
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    createdAt?: Date | string;
    updatedAt?: Date | string;
    user?: any;
    ledgers?: any[];
}

export interface LocalPartnershipLedger {
    id: string;
    partnershipId: string;
    amount: number;
    transactionType: string;
    paymentMethod: string;
    referenceCode: string;
    status: string;
    date: Date | string;
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface LocalBaptism {
    id: string;
    userId: string;
    status: string;
    isPaid: boolean;
    plannedDate?: Date | string | null;
    plannedTime?: string | null;
    baptismCardNumber?: string | null;
    paymentReference?: string | null;
    user?: any;
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface LocalChild {
    id: string;
    name: string;
    dob: Date | string;
    gender: string;
    dedicationNumber?: string | null;
    isDedicated: boolean;
    workflowStatus: string;
    parentId: string;
    departmentId?: string | null;
    isDedicationPaid: boolean;
    plannedDate?: Date | string | null;
    plannedTime?: string | null;
    dedicationCardNumber?: string | null;
    dedicationPaymentReference?: string | null;
    parent?: any;
    department?: any;
    version: number;
    syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

export interface LocalDepartment {
    id: string;
    name: string;
    syncStatus: string;
}

export class PalaceLocalDatabase extends Dexie {
    events!: Table<LocalEvent, string>;
    users!: Table<LocalUser, string>;
    departments!: Table<LocalDepartment, string>;
    projects!: Table<LocalProject, string>;
    plans!: Table<LocalPlan, string>;
    announcements!: Table<LocalAnnouncement, string>;
    meetings!: Table<LocalMeeting, string>;
    devotions!: Table<LocalDevotion, string>;
    messages!: Table<LocalMessage, string>;
    baptisms!: Table<LocalBaptism, string>;
    children!: Table<LocalChild, string>;
    transactions!: Table<LocalTransaction, string>;
    account!: Table<LocalAccount, string>;
    repairs!: Table<LocalRepair, string>;
    appointments!: Table<LocalAppointment, string>;
    partnerships!: Table<LocalPartnership, string>;
    partnershipLedgers!: Table<LocalPartnershipLedger, string>;
    syncQueue!: Table<SyncJob, string>;

    constructor() {
        super('palace-local-first-db');
        
        // Ensure version increases if you change stores
        this.version(8).stores({
            events: 'id, departmentId, date, syncStatus, createdAt',
            users: 'id, role, departmentId, syncStatus',
            departments: 'id, name, syncStatus',
            projects: 'id, departmentId, status, syncStatus',
            plans: 'id, departmentId, status, syncStatus',
            announcements: 'id, departmentId, date, syncStatus, createdAt',
            meetings: 'id, departmentId, date, syncStatus',
            devotions: 'id, authorId, date, syncStatus',
            messages: 'id, senderId, receiverId, timestamp, syncStatus',
            baptisms: 'id, userId, status, syncStatus',
            children: 'id, parentId, workflowStatus, syncStatus',
            transactions: 'id, requestedById, status, syncStatus',
            account: 'id',
            repairs: 'id, departmentId, status, syncStatus',
            appointments: 'id, memberId, targetId, status, syncStatus',
            partnerships: 'id, userId, status, syncStatus',
            partnershipLedgers: 'id, partnershipId, referenceCode, syncStatus',
            syncQueue: 'id, timestamp, status'
        });
    }
}

export const db = new PalaceLocalDatabase();
