describe('App shell', () => {
    it('redirects unauthenticated visitors to the login page', () => {
        cy.clearLocalStorage();
        cy.visit('/');
        cy.location('pathname').should('eq', '/login');
        cy.contains('Welcome Back').should('be.visible');
    });
});
