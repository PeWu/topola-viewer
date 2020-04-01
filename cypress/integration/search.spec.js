describe('Chart view', () => {
  beforeEach(() => {
    cy.visit('/view?handleCors=false&url=https%3A%2F%2Fraw.githubusercontent.com%2FPeWu%2Ftopola%2Fmaster%2Fdemo%2Fdata%2Ffamily.ged');
  });
  it('Search works', () => {
    cy.contains('Chike').should('not.exist');
    cy.get('#search').type('chik');
    cy.contains('Chike');
    cy.get('#search').type('{enter}');
    cy.get('#content').contains('Chike');
  });
});
