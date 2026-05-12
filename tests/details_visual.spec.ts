import {expect, test} from '@playwright/test';
import dedent from 'dedent';
import * as fs from 'fs';
import {mockGedcomResponse, setupHermeticEnvironment} from './helpers';

test.describe('Details panel visual validation @visual', () => {
  test.beforeEach(async ({context}) => {
    await setupHermeticEnvironment(context);
  });

  test('Complex Names Test', async ({page, context}) => {
    const complexNameGedcom = dedent`
      0 HEAD
      1 GEDC
      2 VERS 5.5.1
      2 FORM Lineage-Linked
      1 CHAR UTF-8
      0 @I1@ INDI
      1 NAME Dr. Bonifacy "Boni" /Gibbs/ III
      2 NPFX Dr.
      2 GIVN Bonifacy
      2 NICK Boni
      2 SURN Gibbs
      2 NSFX III
      2 _RUFNAME Bonifacy
      1 SEX M
      1 FAMS @F1@
      0 @F1@ FAM
      1 HUSB @I1@
      0 TRLR
    `;

    await mockGedcomResponse(context, complexNameGedcom);

    await page.goto('/#/view?url=https://example.org/family.ged');
    const sidebar = page.locator('#sidebar');
    await sidebar.waitFor();
    await expect(sidebar).toHaveScreenshot('details-complex-name.png');
  });

  test('Image / Photo Rendering Test', async ({page, context}) => {
    const photoGedcom = dedent`
      0 HEAD
      1 GEDC
      2 VERS 5.5.1
      2 FORM Lineage-Linked
      1 CHAR UTF-8
      0 @I1@ INDI
      1 NAME Bonifacy /Gibbs/
      1 SEX M
      1 FAMS @F1@
      1 OBJE @O1@
      0 @O1@ OBJE
      1 FILE http://example.org/photos/I1.jpg
      2 FORM jpeg
      0 @F1@ FAM
      1 HUSB @I1@
      0 TRLR
    `;

    await mockGedcomResponse(context, photoGedcom);

    await context.route('**/photos/I1.jpg', async (route) => {
      const imageBuffer = fs.readFileSync(
        'docker/examples/photos/photos/I1.jpg',
      );
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: imageBuffer,
      });
    });

    await page.goto('/#/view?url=https://example.org/family.ged');
    const sidebar = page.locator('#sidebar');
    await sidebar.waitFor();

    // Wait for image loading to complete
    const img = sidebar.locator('img').first();
    await img.waitFor({state: 'visible'});
    await img.evaluate((image) => {
      return new Promise((resolve, reject) => {
        if ((image as HTMLImageElement).complete) resolve(true);
        image.addEventListener('load', () => resolve(true));
        image.addEventListener('error', () =>
          reject(new Error('Image failed to load')),
        );
      });
    });

    await expect(sidebar).toHaveScreenshot('details-photo-render.png');
  });

  test('Custom Facts & Citations Test', async ({page, context}) => {
    const customFactsGedcom = dedent`
      0 HEAD
      1 GEDC
      2 VERS 5.5.1
      2 FORM Lineage-Linked
      1 CHAR UTF-8
      0 @I1@ INDI
      1 NAME Bonifacy /Gibbs/
      1 SEX M
      1 FAMS @F1@
      1 FACT Custom fact data
      2 TYPE Custom Fact Type
      2 SOUR @S1@
      3 PAGE 42
      3 DATA
      4 DATE 12 JAN 1850
      2 NOTE This is a note nested under a custom fact.
      1 BIRT
      2 DATE 1 JAN 1800
      2 PLAC Paris, France
      2 SOUR @S1@
      3 PAGE 10
      2 NOTE Birth event note.
      1 DEAT
      2 DATE 31 DEC 1880
      2 PLAC London, UK
      1 NOTE This is a top-level note for the individual.
      0 @S1@ SOUR
      1 TITL Great Genealogy Book
      1 AUTH John Doe
      1 PUBL London Publishing, 1890
      0 @F1@ FAM
      1 HUSB @I1@
      0 TRLR
    `;

    await mockGedcomResponse(context, customFactsGedcom);

    await page.goto('/#/view?url=https://example.org/family.ged');
    const sidebar = page.locator('#sidebar');
    await sidebar.waitFor();
    await expect(sidebar).toHaveScreenshot('details-events-sources.png');
  });
});
