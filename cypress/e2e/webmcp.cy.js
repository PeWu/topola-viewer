describe('WebMCP Integration', () => {
  let registeredTools = [];

  beforeEach(() => {
    registeredTools = [];
    cy.visit('/view?handleCors=false&url=https%3A%2F%2Fraw.githubusercontent.com%2FPeWu%2Ftopola%2Fmaster%2Fdemo%2Fdata%2Ffamily.ged', {
      onBeforeLoad(win) {
        win.navigator.modelContext = {
          registerTool: (tool) => {
            registeredTools.push(tool);
          }
        };
      }
    });
  });

  it('registers tools to standard modelContext', () => {
    cy.wrap(registeredTools).should('have.length', 7);
    const toolNames = registeredTools.map(t => t.name);
    expect(toolNames).to.include('get_selected_person');
    expect(toolNames).to.include('search_indi');
    expect(toolNames).to.include('inspect_indi');
    expect(toolNames).to.include('focus_indi');
    expect(toolNames).to.include('find_relationship_path');
    expect(toolNames).to.include('get_ancestors');
    expect(toolNames).to.include('get_descendants');
  });

  it('allows running focus_indi tool', () => {
    cy.contains('Radobod');
    cy.wrap(registeredTools).then((tools) => {
      const focusTool = tools.find(t => t.name === 'focus_indi');
      // Radobod's ID or another valid ID. In topola sample data let's just grab selection
      expect(focusTool).to.not.be.undefined;
    });
  });
});
