import {BrowserContext, Page} from '@playwright/test';
import * as fs from 'fs';

/**
 * Sets up a hermetic test environment by blocking external tracking services
 * and intercepting Google Fonts to serve static embedded fonts locally.
 */
export async function setupHermeticEnvironment(context: BrowserContext): Promise<void> {
  await context.route('**/*google-analytics.com/**', (route) => route.abort());
  await context.route('**/*googletagmanager.com/**', (route) => route.abort());

  // Intercept Google Fonts stylesheet requests to serve a deterministically embedded local font.
  await context.route('**/fonts.googleapis.com/css2**', async (route) => {
    const cssContent = `
      @font-face {
        font-family: 'Montserrat';
        font-style: normal;
        font-weight: 100 900;
        font-display: block;
        src: url('http://localhost:3000/test-fonts/montserrat.woff2') format('woff2');
      }
      @font-face {
        font-family: 'Montserrat';
        font-style: italic;
        font-weight: 100 900;
        font-display: block;
        src: url('http://localhost:3000/test-fonts/montserrat.woff2') format('woff2');
      }
    `;
    await route.fulfill({
      status: 200,
      contentType: 'text/css',
      headers: {'Access-Control-Allow-Origin': '*'},
      body: cssContent,
    });
  });

  // Intercept requests for the locally embedded test font and serve the static binary.
  await context.route('**/test-fonts/montserrat.woff2', async (route) => {
    const fontBuffer = fs.readFileSync('tests/fixtures/montserrat.woff2');
    await route.fulfill({
      status: 200,
      contentType: 'font/woff2',
      headers: {'Access-Control-Allow-Origin': '*'},
      body: fontBuffer,
    });
  });
}

/**
 * Mocks the endpoint for GEDCOM file requests using the provided GEDCOM content string.
 */
export async function mockGedcomResponse(
  context: BrowserContext,
  gedcomContent: string,
): Promise<void> {
  await context.route('**/family.ged', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      headers: {'Access-Control-Allow-Origin': '*'},
      body: gedcomContent,
    });
  });
}

/**
 * Sets up interception for raw GEDCOM requests, fulfills them with cached test data
 * and sets up CORS proxy checks and analytics blocking.
 */
export async function setupGedcomRoute(context: BrowserContext): Promise<void> {
  const gedcomContent = fs.readFileSync(
    'src/datasource/testdata/test.ged',
    'utf-8',
  );

  await mockGedcomResponse(context, gedcomContent);
  await setupHermeticEnvironment(context);
}

/**
 * Ensures all custom web fonts are fully loaded and rendered.
 */
export async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
}
