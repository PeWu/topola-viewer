import {BrowserContext} from '@playwright/test';
import * as fs from 'fs';

/**
 * Blocks external tracking services (like Google Analytics and Google Tag Manager)
 * to guarantee a hermetic and fast test environment.
 */
export async function blockTracking(context: BrowserContext): Promise<void> {
  await context.route('**/*google-analytics.com/**', (route) => route.abort());
  await context.route('**/*googletagmanager.com/**', (route) => route.abort());
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

  await context.route('**/family.ged', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      headers: {'Access-Control-Allow-Origin': '*'},
      body: gedcomContent,
    });
  });

  await blockTracking(context);
}
