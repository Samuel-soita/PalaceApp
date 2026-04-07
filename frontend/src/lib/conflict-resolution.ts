/**
 * 2.4.0 Kernel: Authority-Weighted Conflict Resolution Engine
 * Mission: Ensure hierarchical data integrity when 600+ devices sync simultaneously.
 */

export type Role = 
    | 'SUPER_ADMIN' 
    | 'WATUA' 
    | 'SYSTEM_ADMIN' 
    | 'PASTOR' 
    | 'ASSOCIATE_PASTOR' 
    | 'DEPARTMENT_LEADER' 
    | 'SECRETARY' 
    | 'MEMBER' 
    | 'USER';

export const ROLE_AUTHORITY: Record<Role, number> = {
    'SUPER_ADMIN': 100,      // Bishop: Universal Override
    'WATUA': 90,             // Watua: Universal Operations
    'SYSTEM_ADMIN': 80,      // Exec IT
    'PASTOR': 70,            // Clergy Override
    'ASSOCIATE_PASTOR': 60,  // Branch/Youth Clergy
    'DEPARTMENT_LEADER': 50, // Sectoral Commander
    'SECRETARY': 40,         // Operations Exec
    'MEMBER': 10,            // Layman
    'USER': 1                // Pending/Guest
};

export interface SyncPayload {
    id: string;
    version: number;
    updatedAt: string; // ISO string
    actorRole: Role;
    actorId: string;
    deviceId: string;
    data: any;
}

export interface LocalState {
    id: string;
    version: number;
    updatedAt: string; // ISO string
    lastActorRole: Role;
    deviceId: string;
    data: any;
    hasPendingOfflineEdit: boolean;
}

export interface ResolutionResult {
    winner: 'LOCAL' | 'SERVER';
    reason: string;
    mergedData?: any;
}

/**
 * Executes a deterministic conflict resolution based on:
 * 1. Semantic Versioning (LWW)
 * 2. Strict Authority (Hierarchy)
 * 3. Chronological (Timestamp)
 */
export function resolveConflict(
    localState: LocalState | null,
    serverPayload: SyncPayload
): ResolutionResult {

    // 1. If no local state exists, Server wins immediately
    if (!localState) {
        return { winner: 'SERVER', reason: 'Identity vacuum: No local state. Ingesting server record.' };
    }

    // 2. Semantic Versioning Tie-Breaker (Primary)
    if (serverPayload.version > localState.version) {
        return { 
            winner: 'SERVER', 
            reason: `Version Superiority: Server [v${serverPayload.version}] > Local [v${localState.version}]` 
        };
    }

    if (localState.version > serverPayload.version) {
        return { 
            winner: 'LOCAL', 
            reason: `Version Superiority: Local [v${localState.version}] > Server [v${serverPayload.version}]` 
        };
    }

    // 3. Authority-Weighted Tie-Breaker (Secondary)
    const localAuthority = ROLE_AUTHORITY[localState.lastActorRole] || 0;
    const serverAuthority = ROLE_AUTHORITY[serverPayload.actorRole] || 0;

    if (serverAuthority > localAuthority) {
        return { 
            winner: 'SERVER', 
            reason: `Authority Override: Server [${serverPayload.actorRole}] > Local [${localState.lastActorRole}]` 
        };
    }

    if (localAuthority > serverAuthority) {
        return { 
            winner: 'LOCAL', 
            reason: `Authority Override: Local [${localState.lastActorRole}] > Server [${serverPayload.actorRole}]` 
        };
    }

    // 4. Chronological Tie-Breaker (Tertiary)
    const serverTime = new Date(serverPayload.updatedAt).getTime();
    const localTime = new Date(localState.updatedAt).getTime();

    if (serverTime > localTime) {
        return { 
            winner: 'SERVER', 
            reason: `Chronological Tie-Breaker: Server record is more recent (${serverPayload.updatedAt})` 
        };
    }

    return { 
        winner: 'LOCAL', 
        reason: `Preserving local state: Most recent or identical.` 
    };
}
