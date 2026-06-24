import {expect, test} from '@playwright/test';
import {setupGedcomRoute, setupHermeticEnvironment} from './helpers';

test.describe('Configurations Integration @visual', () => {
  test.beforeEach(async ({page, context}) => {
    await setupHermeticEnvironment(context);
    await setupGedcomRoute(context);

    await page.goto('/#/view?url=https://example.org/family.ged');

    // Wait for the sidebar and the main content container to be visible.
    const sidebar = page.locator('#sidebar');
    const mainContent = page.locator('#content');
    await sidebar.waitFor();
    await mainContent.waitFor();

    // Switch to the Settings/Config tab in the side panel
    await page.getByText('Settings', {exact: true}).click();
  });

  test('Default Configuration (State 1)', async ({page}) => {
    // Assert the Default Configuration (State 1).
    await expect(page).toHaveScreenshot('config-state-default.png');
  });

  test('Sex Colors & No IDs Configuration (State 2)', async ({page}) => {
    // Locate the section containers inside form.details specifically to avoid Info tab ambiguity.
    const colorsSection = page
      .locator('form.details .item')
      .filter({hasText: 'Colors'});
    const idsSection = page
      .locator('form.details .item')
      .filter({hasText: 'IDs'});

    // Toggle "by sex" colors and "hide" IDs.
    await colorsSection.getByText('by sex').click();
    await idsSection.getByText('hide').click();

    // Wait a brief moment for SVG rendering to update.
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('config-state-gender-no-ids.png');
  });

  test('Minimalist Configuration (State 3)', async ({page}) => {
    // Locate the section containers inside form.details specifically to avoid Info tab ambiguity.
    const colorsSection = page
      .locator('form.details .item')
      .filter({hasText: 'Colors'});
    const sexSection = page
      .locator('form.details .item')
      .filter({hasText: 'Sex'});

    // Toggle "none" colors and "hide" sex labels.
    await colorsSection.getByText('none').click();
    await sexSection.getByText('hide').click();

    // Wait a brief moment for SVG rendering to update.
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('config-state-minimalist.png');
  });

  test('Places Configuration Options', async ({page}) => {
    // Locate the section container inside form.details specifically to avoid Info tab ambiguity.
    const placesSection = page
      .locator('form.details .item')
      .filter({hasText: 'Places'});

    // 1. Toggle "hide" places.
    await placesSection.getByText('hide').click();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('config-state-places-hide.png');

    // 2. Toggle "short" places (default count is 2).
    await placesSection.getByText('short').click();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(
      'config-state-places-short-default.png',
    );

    // 3. Change short place count to 1.
    const countInput = placesSection.locator('input[type="number"]');
    await countInput.fill('1');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('config-state-places-short-1.png');
  });
});
