export type TestRole = 'MEMBER' | 'DEPARTMENT_LEADER' | 'PASTOR' | 'SUPER_ADMIN' | 'SYSTEM_ADMIN' | 'SECRETARY' | 'WATUA';

/** Unsigned token with a valid structure and future expiry so the client treats the session as active. */
export function fakeJwt(claims: Record<string, unknown>): string {
    const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
    const exp = Math.floor(Date.now() / 1000) + 60 * 60;
    return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ ...claims, exp })}.cypress`;
}

export function testUser(role: TestRole) {
    return {
        id: `cy-${role.toLowerCase()}`,
        name: `Cypress ${role.replace(/_/g, ' ')}`,
        role,
        status: 'ACTIVE',
        membershipNumber: '101/001/2026',
        departmentId: null,
    };
}

export function authResponse(role: TestRole) {
    const user = testUser(role);
    return { token: fakeJwt({ id: user.id, role }), user };
}

/**
 * The CI backend runs without a real database and rejects unsigned tokens, so every API call is answered
 * here. Specs register narrower intercepts afterwards; Cypress gives the most recently defined match priority.
 */
export function stubApi() {
    cy.intercept({ url: '/api/**' }, (req) => {
        req.reply({ statusCode: 200, body: req.method === 'GET' ? [] : { success: true } });
    }).as('api');
    cy.intercept({ url: '/socket.io/**' }, { statusCode: 200, body: '' });
}

/** Seeds an authenticated session before the app boots. */
export function visitAs(role: TestRole, path: string) {
    const session = authResponse(role);
    cy.visit(path, {
        onBeforeLoad(win) {
            win.localStorage.setItem('token', session.token);
            win.localStorage.setItem('user', JSON.stringify(session.user));
        },
    });
}
