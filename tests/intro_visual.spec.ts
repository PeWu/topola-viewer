import {expect, test} from '@playwright/test';
import {setupHermeticEnvironment} from './helpers';

test.describe('Intro page visual validation @visual', () => {
  test.beforeEach(async ({page, context}) => {
    await setupHermeticEnvironment(context);
    await page.goto('/');
  });

  test('intro-page', async ({page}) => {
    // Wait for the async changelog content to load so React doesn't
    // overwrite our placeholder after we inject it.
    await page.waitForFunction(() => {
      const headers = Array.from(document.querySelectorAll('h3'));
      const whatsNew = headers.find((h) =>
        h.textContent?.includes("What's new"),
      );
      const span = whatsNew?.nextElementSibling;
      return span && span.innerHTML.trim() !== '';
    });

    // Clean dynamic elements right before snapping the screenshot.
    await page.evaluate(() => {
      // 1. Overwrite dynamic footer versioning.
      const versionEl = document.querySelector('.version');
      if (versionEl) {
        (versionEl as HTMLElement).innerText =
          'version: 2026-01-01 00:00 (testcommit)';
      }

      // 2. Replace dynamic changelog block with static placeholder.
      const headers = Array.from(document.querySelectorAll('h3'));
      const whatsNewHeader = headers.find((h) =>
        h.textContent?.includes("What's new"),
      );
      if (whatsNewHeader) {
        const changelogSpan = whatsNewHeader.nextElementSibling;
        if (changelogSpan) {
          changelogSpan.innerHTML =
            '<h4>2026-01-01</h4><ul><li>Placeholder change entry</li></ul>';
        }
      }
    });

    // Snap the screenshot.
    await expect(page).toHaveScreenshot('intro-page.png');
  });
});
