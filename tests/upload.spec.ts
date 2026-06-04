import {expect, test} from '@playwright/test';
import {setupHermeticEnvironment} from './helpers';

test.describe('File upload', () => {
  test.beforeEach(async ({page, context}) => {
    await setupHermeticEnvironment(context);
    await page.goto('/');
  });

  test('uploads a GEDCOM file and displays the tree', async ({page}) => {
    // Set the test GEDCOM file to the hidden file input.
    await page.setInputFiles('#fileInput', 'src/datasource/testdata/test.ged');

    // Assert that we navigated to the view page.
    await expect(page).toHaveURL(/.*\/view.*/);

    // Verify that the chart content loads properly (e.g. contains the name 'Bonifacy').
    await expect(page.locator('#content')).toContainText('Bonifacy');
  });
});
