import {expect, test} from '@playwright/test';
import {setupGedcomRoute} from './helpers';

// In test.ged, Bonifacy Gibbs (I1) has parents (Mervyn), grandparents
// (Radobod), children (Marie) and a grandchild (Gandalf).
const URL = '/#/view?url=https://example.org/family.ged&indi=I1';

test.describe('Generation limits', () => {
  test.beforeEach(async ({context}) => {
    await setupGedcomRoute(context);
  });

  test('shows all generations by default', async ({page}) => {
    await page.goto(URL);
    const chart = page.getByTestId('chart');
    await expect(chart).toContainText('Bonifacy');
    await expect(chart).toContainText('Radobod');
    await expect(chart).toContainText('Gandalf');
  });

  test('reads the limits from the URL', async ({page}) => {
    await page.goto(`${URL}&gu=1&gd=1`);
    const chart = page.getByTestId('chart');
    await expect(chart).toContainText('Mervyn');
    await expect(chart).toContainText('Marie');
    await expect(chart).not.toContainText('Radobod');
    await expect(chart).not.toContainText('Gandalf');
  });

  test('applies the limits around the newly selected person', async ({
    page,
  }) => {
    await page.goto(`${URL}&gu=1&gd=1`);
    const chart = page.getByTestId('chart');
    await expect(chart).not.toContainText('Radobod');

    // Selecting the father moves the limits one generation up. force: true is
    // needed because D3 wraps the text in a <rect> that intercepts clicks.
    await chart.getByText('Mervyn').click({force: true});

    await expect(chart).toContainText('Radobod');
    await expect(chart).not.toContainText('Marie');
  });

  test('limits generations from the settings', async ({page}) => {
    await page.goto(URL);
    const chart = page.getByTestId('chart');
    await expect(chart).toContainText('Radobod');

    await page.getByText('Settings', {exact: true}).click();
    const above = page
      .locator('form.details .item')
      .filter({hasText: 'Generations above'});
    await above.getByText('limit to', {exact: true}).click();
    await above.locator('input[type="number"]').fill('1');

    await expect(chart).not.toContainText('Radobod');
    await expect(chart).toContainText('Mervyn');
    await expect(chart).toContainText('Gandalf');
    await expect(page).toHaveURL(/[?&]gu=1(&|$)/);

    // Back to all generations.
    await above.getByText('all', {exact: true}).click();
    await expect(chart).toContainText('Radobod');
    await expect(page).not.toHaveURL(/[?&]gu=/);
  });
});
