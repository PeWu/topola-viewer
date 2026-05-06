import {expect, test} from '@playwright/test';
import {setupGedcomRoute} from './helpers';

const EXPECTED_TOOL_NAMES = [
  'get_selected_person',
  'search_indi',
  'inspect_indi',
  'focus_indi',
  'find_relationship_path',
  'get_ancestors',
  'get_descendants',
];

test.describe('WebMCP Integration', () => {
  test.beforeEach(async ({page, context}) => {
    await setupGedcomRoute(context);

    // Add init script to expose modelContext mock BEFORE application boots.
    await page.addInitScript(() => {
      const registeredTools: any[] = [];
      window.__registeredTools = registeredTools;
      window.navigator.modelContext = {
        registerTool: (tool: any) => {
          registeredTools.push(tool);
        },
        unregisterTool: (name: string) => {
          const idx = registeredTools.findIndex((t) => t.name === name);
          if (idx !== -1) registeredTools.splice(idx, 1);
        },
      };
    });
  });

  test('registers tools to standard modelContext', async ({page}) => {
    await page.goto('/#/view?url=https%3A%2F%2Fexample.org%2Ffamily.ged');

    // Polling assertion to avoid React useEffect registration race condition.
    await page.waitForFunction(
      (expectedCount) => window.__registeredTools?.length === expectedCount,
      EXPECTED_TOOL_NAMES.length,
    );

    const toolNames = await page.evaluate(() =>
      window.__registeredTools
        ? window.__registeredTools.map((t: any) => t.name)
        : [],
    );
    expect(toolNames.sort()).toEqual([...EXPECTED_TOOL_NAMES].sort());
  });

  test('allows running focus_indi tool', async ({page}) => {
    await page.goto('/#/view?url=https%3A%2F%2Fexample.org%2Ffamily.ged');
    await page.waitForFunction(
      (expectedCount) => window.__registeredTools?.length === expectedCount,
      EXPECTED_TOOL_NAMES.length,
    );

    await expect(page.locator('#content')).toContainText('Radobod');
    await expect(page.locator('#content')).not.toContainText('Chike');

    // Execute the non-serializable callback inside the browser environment.
    await page.evaluate(async () => {
      const focusTool = window.__registeredTools
        ? window.__registeredTools.find((t: any) => t.name === 'focus_indi')
        : null;
      if (!focusTool) throw new Error('focus_indi tool not found');
      await focusTool.execute({id: 'I21'}); // Shifts view focus to Chike.
    });

    // Verify that the UI updated automatically in response to the tool action.
    await expect(page.locator('#content')).toContainText('Chike');
  });
});
