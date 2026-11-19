import {expect, test} from '@playwright/test';
import {setupGedcomRoute} from './helpers';

test.describe('Chart view', () => {
  test.beforeEach(async ({page, context}) => {
    await setupGedcomRoute(context);
    await page.goto('/#/view?url=https://example.org/family.ged');
  });

  test('loads data from URL', async ({page}) => {
    await expect(page.locator('#content')).toContainText('Bonifacy');
  });

  test('Animates chart', async ({page}) => {
    await expect(page.locator('#content')).not.toContainText('Chike');

    // Click Radobod's node. force: true is required because D3 wraps the text in a border <rect>
    // that intercepts pointer events, which is expected SVG chart layout behavior.
    await page.getByText('Radobod').click({force: true});
    await expect(page.locator('#content')).toContainText('Chike');
  });

  test('does not redraw the chart when an unrelated font loads', async ({
    page,
  }) => {
    await page.locator('#chart .person-region').first().waitFor();

    // Fonts of the page (not of the chart) finish loading at any time, e.g.
    // when a name in the side panel needs a new subset of the UI font. Such a
    // load must not redraw the chart, as that would cut short its animation.
    const fontLoadRedraws = (family: string) =>
      page.evaluate((family) => {
        const box = document.querySelector('#chart .person-region');
        document.fonts.dispatchEvent(
          new FontFaceSetLoadEvent('loadingdone', {
            fontfaces: [new FontFace(family, 'url(font.woff2)')],
          }),
        );
        return !box?.isConnected;
      }, family);

    expect(await fontLoadRedraws('Lato')).toBe(false);
    // The font of the chart changes text sizes, so it does redraw.
    expect(await fontLoadRedraws('Montserrat')).toBe(true);
  });

  test('switching looks keeps one chart and leaves nothing of the old look', async ({
    page,
  }) => {
    const chartState = () =>
      page.evaluate(() => {
        const css = document.querySelector('#chart style')?.textContent ?? '';
        return {
          charts: Array.from(
            document.querySelectorAll('#chart g[class^="topola-"]'),
          ).map((g) => g.getAttribute('class')),
          transitLayers: document.querySelectorAll(
            '#chart [data-layer-id^="transit"]',
          ).length,
          transitCss: css.includes('transit'),
          defaultLinks: document.querySelectorAll('#chart .links > path.link')
            .length,
        };
      });
    await page.locator('#chart .person-region').first().waitFor();
    const hourglass = await chartState();
    expect(hourglass.charts.length).toBe(1);
    expect(hourglass.defaultLinks).toBeGreaterThan(0);

    await page.goto('/#/view?url=https://example.org/family.ged&view=transit');
    await page
      .locator('#chart [data-layer-id="transit-lines"] path')
      .first()
      .waitFor();
    const transit = await chartState();
    expect(transit.charts).toEqual(hourglass.charts);
    expect(transit.transitLayers).toBe(3);
    expect(transit.transitCss).toBe(true);
    expect(transit.defaultLinks).toBe(0);

    await page.goto(
      '/#/view?url=https://example.org/family.ged&view=hourglass',
    );
    await page.locator('#chart .links > path.link').first().waitFor();
    expect(await chartState()).toEqual(hourglass);
  });

  test('shows the right panel', async ({page}) => {
    await expect(page.locator('#content')).toContainText('a random note');
  });
});
