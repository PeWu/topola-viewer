import {expect, test} from '@playwright/test';
import {setupHermeticEnvironment} from './helpers';

test.describe('Intro page', () => {
  test.beforeEach(async ({page, context}) => {
    await setupHermeticEnvironment(context);
    await page.goto('/');
  });

  test('displays intro text', async ({page}) => {
    await expect(page.getByText('Examples')).toBeVisible();
  });

  test('displays menu', async ({page}) => {
    await expect(page.getByText('Open file', {exact: true})).toBeVisible();
    await expect(page.getByText('Load from URL', {exact: true})).toBeVisible();
  });
});
