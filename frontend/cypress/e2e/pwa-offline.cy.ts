import { stubApi, visitAs } from '../support/session';

const LOCAL_DB = 'palace-local-first-db';

describe('PWA offline support', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        stubApi();
        cy.viewport(1280, 800);
    });

    it('creates the local-first database with the sync queue store', () => {
        visitAs('SYSTEM_ADMIN', '/executive');
        cy.contains('PALACE', { timeout: 15000 }).should('exist');

        cy.window().then({ timeout: 15000 }, (win) =>
            new Cypress.Promise<string[]>((resolve, reject) => {
                const request = win.indexedDB.open(LOCAL_DB);
                request.onsuccess = () => {
                    const names = Array.from(request.result.objectStoreNames);
                    request.result.close();
                    resolve(names);
                };
                request.onerror = () => reject(request.error);
            })
        ).should('include.members', ['syncQueue', 'users', 'announcements']);
    });

    it('shows offline mode when the connection drops and clears it when it returns', () => {
        visitAs('SYSTEM_ADMIN', '/executive');
        cy.contains('PALACE', { timeout: 15000 }).should('exist');

        cy.window().then((win) => {
            cy.stub(win.navigator, 'onLine').value(false);
            win.dispatchEvent(new win.Event('offline'));
        });
        cy.contains('OFFLINE MODE').should('exist');

        cy.window().then((win) => {
            cy.stub(win.navigator, 'onLine').value(true);
            win.dispatchEvent(new win.Event('online'));
        });
        cy.contains('OFFLINE MODE').should('not.exist');
    });
});
