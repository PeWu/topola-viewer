import {expect, Page, test} from '@playwright/test';
import * as fs from 'fs';
import {mockGedcomResponse} from './helpers';

// The standard test file, with occupations and a title added to Bonifacy Gibbs.
const GEDCOM = fs
  .readFileSync('src/datasource/testdata/test.ged', 'utf-8')
  .replace(
    /^1 NAME Bonifacy \/Gibbs\/\r?\n/m,
    (line) =>
      `${line}1 OCCU Blacksmith\n1 OCCU Farmer\n1 TITL Duke of Wellington\n`,
  );

const URL = '/#/view?url=https://example.org/family.ged';

test.describe('Occupations and titles settings', () => {
  test.beforeEach(async ({context}) => {
    expect(GEDCOM).toContain('1 OCCU Blacksmith');
    await mockGedcomResponse(context, GEDCOM);
  });

  async function chooseSetting(page: Page, section: string, value: string) {
    await page.getByText('Settings', {exact: true}).click();
    await page
      .locator('form.details .item')
      .filter({hasText: section})
      .getByText(value, {exact: true})
      .click();
  }

  test('hides occupations and titles by default', async ({page}) => {
    await page.goto(URL);
    const chart = page.getByTestId('chart');
    await expect(chart).toContainText('Bonifacy');
    await expect(chart).not.toContainText('Blacksmith');
    await expect(chart).not.toContainText('Duke of Wellington');
  });

  test('shows occupations when enabled in settings', async ({page}) => {
    await page.goto(URL);
    const chart = page.getByTestId('chart');
    await expect(chart).toContainText('Bonifacy');

    await chooseSetting(page, 'Occupations', 'show');

    await expect(chart).toContainText('Blacksmith');
    await expect(chart).toContainText('Farmer');
    await expect(chart).not.toContainText('Duke of Wellington');
    await expect(page).toHaveURL(/[?&]o=s(&|$)/);
  });

  test('shows titles when enabled in settings', async ({page}) => {
    await page.goto(URL);
    const chart = page.getByTestId('chart');
    await expect(chart).toContainText('Bonifacy');

    await chooseSetting(page, 'Titles', 'show');

    await expect(chart).toContainText('Duke of Wellington');
    await expect(chart).not.toContainText('Blacksmith');
    await expect(page).toHaveURL(/[?&]t=s(&|$)/);
  });

  test('reads the settings from the URL', async ({page}) => {
    await page.goto(`${URL}&o=s&t=s`);
    const chart = page.getByTestId('chart');
    await expect(chart).toContainText('Blacksmith');
    await expect(chart).toContainText('Duke of Wellington');
  });
});
