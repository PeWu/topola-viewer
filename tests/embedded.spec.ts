import {expect, test} from '@playwright/test';
import * as fs from 'fs';
import {setupGedcomRoute} from './helpers';

test.describe('Embedded mode', () => {
  test('shows data', async ({page, context}) => {
    // Intercept family.ged requests coming from parent frame.
    await setupGedcomRoute(context);

    // Read the physical HTML wrapper template file.
    const wrapperHtml = fs.readFileSync(
      'tests/fixtures/embedded_frame.html',
      'utf-8',
    );

    // Route parent page wrapper virtually on the same origin/port dynamically.
    await context.route(`**/test-embedded-frame.html`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: wrapperHtml,
      });
    });

    // Load the virtual wrapper page.
    await page.goto(`/test-embedded-frame.html`);

    // Assert child iframe successfully loaded Bonifacy Gibbs.
    const iframe = page.frameLocator('#topolaFrame');

    await expect(iframe.locator('#root')).toContainText('Bonifacy');
  });
});
