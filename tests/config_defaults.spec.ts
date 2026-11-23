import {expect, test} from '@playwright/test';
import {setupGedcomRoute} from './helpers';

test.describe('Settings', () => {
  test.beforeEach(async ({context}) => {
    await setupGedcomRoute(context);
  });

  test('can be changed back to their default value', async ({page}) => {
    await page.goto('/#/view?url=https://example.org/family.ged&indi=I1');
    const chart = page.getByTestId('chart');
    await expect(chart).toContainText('McKean');

    await page.getByText('Settings', {exact: true}).click();
    const places = page
      .locator('form.details .item')
      .filter({hasText: 'Places'});

    await places.getByText('short', {exact: true}).click();
    await expect(chart).not.toContainText('McKean');
    await expect(page).toHaveURL(/[?&]p=s(&|$)/);

    await places.getByText('full', {exact: true}).click();
    await expect(chart).toContainText('McKean');
    await expect(page).not.toHaveURL(/[?&]p=/);
  });
});
