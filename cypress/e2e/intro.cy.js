describe('Intro page', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('displays intro text', () => {
    cy.contains('Examples');
  });
  it('displays menu', () => {
    cy.contains('Open file');
    cy.contains('Load from URL');
  });
});
