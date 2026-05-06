import {expect, test} from '@playwright/test';
import {setupGedcomRoute} from './helpers';

test.describe('Search functionality', () => {
  test.beforeEach(async ({context}) => {
    await setupGedcomRoute(context);
  });

  test('Search works', async ({page}) => {
    await page.goto('/#/view?url=https%3A%2F%2Fexample.org%2Ffamily.ged');
    await expect(page.locator('#content')).not.toContainText('Chike');

    const searchInput = page.getByPlaceholder('Search for people');
    await searchInput.fill('chik');

    // Wait for the debounced suggestion panel to render.
    await expect(page.locator('.results')).toContainText('Chike');

    await searchInput.press('Enter');
    await expect(page.locator('#content')).toContainText('Chike');
  });
});
