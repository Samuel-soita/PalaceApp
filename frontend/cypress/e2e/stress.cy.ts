import { stubApi } from '../support/session';

describe('PWA sync queue under load', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        stubApi();
        cy.intercept('POST', '/api/test-stress', { statusCode: 200, body: { success: true } });
    });

    it('queues 1200 offline actions without freezing the page', () => {
        cy.visit('/login');
        cy.window().its('runStressTest', { timeout: 15000 }).should('be.a', 'function');

        cy.window().then({ timeout: 60000 }, (win: any) => win.runStressTest());

        cy.contains('button', 'Sign In').should('be.visible').and('not.be.disabled');
    });
});
