import {expect, test} from '@playwright/test';
import {setupGedcomRoute} from './helpers';

test.describe('Chart view', () => {
  test.beforeEach(async ({page, context}) => {
    await setupGedcomRoute(context);
    await page.goto('/#/view?url=https%3A%2F%2Fexample.org%2Ffamily.ged');
  });

  test('loads data from URL', async ({page}) => {
    await expect(page.locator('#content')).toContainText('Bonifacy');
  });

  test('Animates chart', async ({page}) => {
    await expect(page.locator('#content')).not.toContainText('Chike');

    // Click Radobod's node. force: true is required because D3 wraps the text in a border <rect>
    // that intercepts pointer events, which is expected SVG chart layout behavior.
    await page.getByText('Radobod').click({force: true});
    await expect(page.locator('#content')).toContainText('Chike');
  });

  test('shows the right panel', async ({page}) => {
    await expect(page.locator('#content')).toContainText('a random note');
  });
});
