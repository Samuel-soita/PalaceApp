import { authResponse, stubApi, visitAs } from '../support/session';

describe('Authentication and role routing', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        cy.clearCookies();
        stubApi();
    });

    it('signs a member in with card number and ID, then lands on the member portal', () => {
        cy.intercept('POST', '/api/auth/login', { statusCode: 200, body: authResponse('MEMBER') }).as('login');

        cy.visit('/login');
        cy.contains('label', 'Membership Card Number').parent().find('input').type('101/001/2026');
        cy.contains('label', 'National ID Number').parent().find('input').type('12345678');
        cy.contains('button', 'Sign In').click();

        cy.wait('@login').its('request.body').should('deep.equal', {
            membershipNumber: '101/001/2026',
            idNumber: '12345678',
        });
        cy.location('pathname').should('eq', '/');
        cy.contains('WELCOME,').should('be.visible');
    });

    it('shows the server error when credentials are rejected', () => {
        cy.intercept('POST', '/api/auth/login', { statusCode: 401, body: { error: 'Invalid membership number or ID.' } }).as('login');

        cy.visit('/login');
        cy.contains('label', 'Membership Card Number').parent().find('input').type('999/001/2026');
        cy.contains('label', 'National ID Number').parent().find('input').type('00000000');
        cy.contains('button', 'Sign In').click();

        cy.wait('@login');
        cy.contains('Invalid membership number or ID.').should('be.visible');
        cy.location('pathname').should('eq', '/login');
    });

    it('keeps a member out of Bishop-only routes', () => {
        visitAs('MEMBER', '/departments');
        cy.location('pathname').should('eq', '/');
    });

    it('requires the system access key for the WATUA sequence', () => {
        cy.intercept('POST', '/api/auth/watua-access', { statusCode: 200, body: authResponse('WATUA') }).as('watuaAccess');

        cy.visit('/login');
        cy.window().then((win) => {
            cy.stub(win, 'prompt').returns('cypress-access-key').as('accessPrompt');
        });
        cy.contains('Welcome Back').should('be.visible');
        cy.get('body').type('watua');

        cy.get('@accessPrompt').should('have.been.calledOnce');
        cy.wait('@watuaAccess').its('request.body').should('deep.equal', { accessKey: 'cypress-access-key' });
        cy.location('pathname').should('eq', '/watua');
    });

    it('does not call the server when the access key prompt is cancelled', () => {
        cy.intercept('POST', '/api/auth/watua-access', cy.spy().as('watuaAccess'));

        cy.visit('/login');
        cy.window().then((win) => {
            cy.stub(win, 'prompt').returns(null).as('accessPrompt');
        });
        cy.contains('Welcome Back').should('be.visible');
        cy.get('body').type('watua');

        cy.get('@accessPrompt').should('have.been.calledOnce');
        cy.get('@watuaAccess').should('not.have.been.called');
        cy.location('pathname').should('eq', '/login');
    });
});

describe('Resilience', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        stubApi();
    });

    it('keeps the member portal usable when the dashboard API fails', () => {
        cy.intercept('GET', '/api/dashboard/**', { statusCode: 500, body: { error: 'Internal Server Error' } }).as('dashboard');

        visitAs('MEMBER', '/');
        cy.wait('@dashboard');
        cy.contains('WELCOME,').should('be.visible');
        cy.location('pathname').should('eq', '/');
    });
});
