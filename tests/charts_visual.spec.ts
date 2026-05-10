import {expect, test} from '@playwright/test';
import {setupGedcomRoute} from './helpers';

test.describe('Core SVG Canvas Layouts @visual', () => {
  test.beforeEach(async ({context}) => {
    await setupGedcomRoute(context);
  });

  const layouts = [
    {view: 'hourglass', selector: '#svgContainer', waitTime: 500},
    {view: 'relatives', selector: '#svgContainer', waitTime: 500},
    {view: 'donatso', selector: '#dotatsoSvgContainer', waitTime: 1500},
  ];

  for (const layout of layouts) {
    test(`chart-${layout.view}`, async ({page}) => {
      await page.goto(
        `/#/view?url=https://example.org/family.ged&view=${layout.view}`,
      );
      const container = page.locator(layout.selector);
      await container.waitFor({state: 'visible'});
      // Wait for D3 rendering and layout stabilization.
      await page.waitForTimeout(layout.waitTime);
      await expect(container).toHaveScreenshot(`chart-${layout.view}.png`);
    });
  }
});
