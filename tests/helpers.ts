import {BrowserContext} from '@playwright/test';
import * as fs from 'fs';

/**
 * Sets up a hermetic test environment by blocking external tracking services
 * and intercepting index.html to serve static embedded fonts locally.
 */
export async function setupHermeticEnvironment(
  context: BrowserContext,
): Promise<void> {
  await context.route('**/*google-analytics.com/**', (route) => route.abort());
  await context.route('**/*googletagmanager.com/**', (route) => route.abort());

  // Intercept index.html to serve preloaded local fonts deterministically.
  await context.route(
    (url) => url.pathname === '/',
    async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      body = body.replace(
        /^.*Montserrat.*$/m,
        `    <link rel="preload" href="Montserrat-Regular.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="Montserrat-Bold.woff2" as="font" type="font/woff2" crossorigin>
    <style>
      @font-face {
        font-family: 'Montserrat';
        font-style: normal;
        font-weight: 400;
        src: url('Montserrat-Regular.woff2') format('woff2');
      }
      @font-face {
        font-family: 'Montserrat';
        font-style: normal;
        font-weight: 700;
        src: url('Montserrat-Bold.woff2') format('woff2');
      }
      text {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: geometricPrecision;
      }
    </style>`,
      );
      await route.fulfill({
        response,
        body,
      });
    },
  );

  // Intercept requests for the locally embedded test fonts and serve the static binaries.
  await context.route('**/Montserrat-Regular.woff2', async (route) => {
    const fontBuffer = fs.readFileSync(
      'tests/fixtures/Montserrat-Regular.woff2',
    );
    await route.fulfill({
      status: 200,
      contentType: 'font/woff2',
      headers: {'Access-Control-Allow-Origin': '*'},
      body: fontBuffer,
    });
  });

  await context.route('**/Montserrat-Bold.woff2', async (route) => {
    const fontBuffer = fs.readFileSync('tests/fixtures/Montserrat-Bold.woff2');
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
}
