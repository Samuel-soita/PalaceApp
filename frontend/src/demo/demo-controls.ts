import { db } from '../lib/db';
import { queryClient } from '../lib/query-client';
import { homePathFor } from '../lib/route-access';
import { createDemoToken, DEMO_STORE_KEY, isDemoSession, type DemoPersona } from './demo-session';

type LoginFn = (data: { user: any; token: string }) => Promise<void>;

/** Unsynced offline changes from a real account would be cleared by switching to the demo account. */
export async function hasUnsyncedRealChanges(): Promise<boolean> {
    if (isDemoSession()) return false;
    const pending = await db.syncQueue.where('status').anyOf('PENDING', 'RETRYING').count();
    return pending > 0;
}

/** Signs in as a demo persona with fresh sample data and returns the page to open. */
export async function startDemo(persona: DemoPersona, login: LoginFn): Promise<string> {
    const backend = await import('./demo-backend');
    queryClient.clear();
    backend.resetDemoStore();
    const user = backend.demoLoginPayload(persona.userId);
    await login({ user, token: createDemoToken(user.id, user.role) });
    return homePathFor(user.role, user.departmentId);
}

export function endDemo(logout: () => void) {
    logout();
    queryClient.clear();
    sessionStorage.removeItem(DEMO_STORE_KEY);
}
