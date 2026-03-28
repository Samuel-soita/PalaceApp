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
    model: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    data: any;
    updatedAt: number;
    actorRole: Role;
    actorId: string;
}

export interface LocalState {
    id: string;
    data: any;
    lastUpdated: number;
    lastActorRole: Role;
    hasPendingOfflineEdit: boolean;
}

export interface ResolutionResult {
    winner: 'LOCAL' | 'SERVER';
    reason: string;
    mergedData?: any;
}

/**
 * Executes a deterministic conflict resolution based on strict hierarchy.
 * SUPER_ADMIN > WATUA > SYSTEM_ADMIN > PASTOR > LEADER > MEMBER
 */
export function resolveConflict(
    localState: LocalState | null,
    serverPayload: SyncPayload,
    isOffline: boolean = false
): ResolutionResult {

    // 1. If no local state exists, Server wins immediately
    if (!localState) {
        return { winner: 'SERVER', reason: 'No local state. Ingesting server payload.' };
    }

    const localAuthority = ROLE_AUTHORITY[localState.lastActorRole] || 0;
    const serverAuthority = ROLE_AUTHORITY[serverPayload.actorRole] || 0;

    // 2. Strict Authority Override
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

    // 3. Same Authority Tie-Breaker (Timestamp / Delta Sync)
    // If we are currently offline and have a pending edit, we protect our local edit 
    // until we reconnect and the server processes it.
    if (localState.hasPendingOfflineEdit && isOffline) {
        return { 
            winner: 'LOCAL', 
            reason: `Tie-Breaker: Preserving pending local edit during offline isolation.` 
        };
    }

    // Default to the most recent timestamp if no pending local edit protects it
    if (serverPayload.updatedAt > localState.lastUpdated) {
        return { 
            winner: 'SERVER', 
            reason: `Chronological Tie-Breaker: Server is more recent.` 
        };
    }

    return { 
        winner: 'LOCAL', 
        reason: `Chronological Tie-Breaker: Local is more recent or identical.` 
    };
}
