describe('Chart view', () => {
  beforeEach(() => {
    cy.visit('/view?handleCors=false&url=https%3A%2F%2Fraw.githubusercontent.com%2FPeWu%2Ftopola%2Fmaster%2Fdemo%2Fdata%2Ffamily.ged');
  });

  it('loads data from URL', () => {
    cy.contains('Bonifacy');
  });

  it('Animates chart', () => {
    cy.contains('Chike').should('not.exist');
    cy.contains('Radobod').click({force: true});
    cy.contains('Chike');
  });

  it('shows the right panel', () => {
    cy.contains('a random note');
  });
});
