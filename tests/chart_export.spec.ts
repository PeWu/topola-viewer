import {expect, test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {setupGedcomRoute, setupHermeticEnvironment} from './helpers';

/**
 * Reads the chart's live (zoom-scaled) and true (unscaled) dimensions from the
 * rendered page. Mirrors what `getStrippedSvg()` does in chart_export.ts: the
 * live `#chartSvg` width/height carry the on-screen zoomed size, so the true
 * size is recovered by dividing by the d3-zoom scale stored on `#svgContainer`.
 */
async function getChartDimensions(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const svg = document.getElementById('chartSvg');
    const container = document.getElementById('svgContainer');
    const k = (container as unknown as {__zoom?: {k: number}}).__zoom?.k ?? 1;
    const liveW = Number(svg?.getAttribute('width') ?? 0);
    const liveH = Number(svg?.getAttribute('height') ?? 0);
    return {liveW, liveH, scale: k, trueW: liveW / k, trueH: liveH / k};
  });
}

/** Parses the page size (in PDF user units / points) from a generated PDF. */
async function getPdfPageSize(pdfPath: string): Promise<[number, number]> {
  const buf = await readFile(pdfPath);
  // jsPDF writes a single MediaBox entry as [0 0 W H]. PDF numbers are the part
  // between the brackets; the last two whitespace-separated tokens are W and H.
  const mediaBox = /\/MediaBox\s*\[\s*([0-9.\s-]+)\s*\]/.exec(
    buf.toString('latin1'),
  );
  if (!mediaBox) {
    throw new Error('MediaBox not found in generated PDF');
  }
  const nums = mediaBox[1].trim().split(/\s+/).map(Number);
  return [nums[nums.length - 2], nums[nums.length - 1]];
}

test.describe('Chart export and Topola 4 lifecycle', () => {
  test.beforeEach(async ({page, context}) => {
    await setupHermeticEnvironment(context);
    await setupGedcomRoute(context);
    // Block external Google Font stylesheet fetches during hermetic tests so
    // switching to Lora stays offline and deterministic.
    await context.route('**/*fonts.googleapis.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/css',
        headers: {'Access-Control-Allow-Origin': '*'},
        body: '',
      }),
    );
    await page.goto('/#/view?url=https://example.org/family.ged');
  });

  test('PDF page size matches the chart size regardless of zoom', async ({
    page,
  }) => {
    await expect(page.locator('#content')).toContainText('Bonifacy');

    // Zoom in so the live #chartSvg width/height are scaled and no longer equal
    // to the true chart size. Without this step the bug would be masked.
    for (let i = 0; i < 3; i++) {
      await page.locator('.zoom-in').click();
    }
    await page.waitForTimeout(300);

    const dims = await getChartDimensions(page);
    // Sanity: the zoom actually applied, otherwise the test below is vacuous.
    expect(dims.scale).toBeGreaterThan(1);
    expect(dims.liveW).not.toEqual(dims.trueW);
    expect(dims.liveH).not.toEqual(dims.trueH);

    // Open the Download dropdown and choose "PDF file".
    await page.getByText('Download', {exact: true}).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByText('PDF file', {exact: true}).click();
    const download = await downloadPromise;
    const pdfPath = await download.path();
    expect(pdfPath).toBeTruthy();

    const [pdfW, pdfH] = await getPdfPageSize(pdfPath ?? '');

    // The PDF page must be sized to the TRUE (unscaled) chart, not to the
    // on-screen zoomed viewport.
    expect(pdfW).toBeCloseTo(dims.trueW, 0);
    expect(pdfH).toBeCloseTo(dims.trueH, 0);
    expect(pdfW).not.toBeCloseTo(dims.liveW, 0);
    expect(pdfH).not.toBeCloseTo(dims.liveH, 0);
  });

  test('SVG export embeds active @font-face .woff2 rules as data:font/woff2;base64 and unscaled dimensions', async ({
    page,
  }) => {
    await expect(page.locator('#content')).toContainText('Bonifacy');

    await page.locator('.zoom-in').click();
    await page.waitForTimeout(200);
    const dims = await getChartDimensions(page);

    await page.getByText('Download', {exact: true}).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByText('SVG file', {exact: true}).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('topola.svg');
    const svgPath = await download.path();
    expect(svgPath).toBeTruthy();

    const svgText = await readFile(svgPath ?? '', 'utf8');
    expect(svgText).toContain('@font-face');
    expect(svgText).toContain('data:font/woff2;base64,');
    expect(svgText).toContain('Montserrat');

    const widthMatch = /<svg[^>]*\bwidth="([0-9.]+)"/.exec(svgText);
    const heightMatch = /<svg[^>]*\bheight="([0-9.]+)"/.exec(svgText);
    expect(Number(widthMatch?.[1])).toBeCloseTo(dims.trueW, 1);
    expect(Number(heightMatch?.[1])).toBeCloseTo(dims.trueH, 1);
  });

  test('PNG export renders valid 2x-scaled PNG from serialized SVG with inlined fonts', async ({
    page,
  }) => {
    await expect(page.locator('#content')).toContainText('Bonifacy');

    const dims = await getChartDimensions(page);

    await page.getByText('Download', {exact: true}).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByText('PNG file', {exact: true}).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('topola.png');
    const pngPath = await download.path();
    expect(pngPath).toBeTruthy();

    const pngBuf = await readFile(pngPath ?? '');
    // Verify PNG magic signature: 89 50 4E 47 0D 0A 1A 0A
    expect(pngBuf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    // Read IHDR width and height (big-endian uint32 at offsets 16 and 20)
    const pngWidth = pngBuf.readUInt32BE(16);
    const pngHeight = pngBuf.readUInt32BE(20);
    expect(pngWidth).toBe(Math.round(dims.trueW * 2));
    expect(pngHeight).toBe(Math.round(dims.trueH * 2));
    expect(pngBuf.length).toBeGreaterThan(2000);
  });

  test('Print export writes self-contained SVG with inlined fonts into print iframe and invokes print()', async ({
    page,
  }) => {
    await expect(page.locator('#content')).toContainText('Bonifacy');

    await page.evaluate(() => {
      const win = window as unknown as {
        __printCapturedHtml?: string;
        __printCalled?: boolean;
      };
      win.__printCalled = false;
      const origAppend = document.body.appendChild.bind(document.body);
      document.body.appendChild = function <T extends Node>(node: T): T {
        const appended = origAppend(node);
        if (node instanceof HTMLIFrameElement && node.contentWindow) {
          node.contentWindow.print = () => {
            win.__printCalled = true;
            win.__printCapturedHtml =
              node.contentDocument?.documentElement?.innerHTML ?? '';
          };
        }
        return appended;
      };
    });

    await page.getByText('Print', {exact: true}).click();

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as {__printCalled?: boolean}).__printCalled,
        ),
      )
      .toBe(true);

    const printedHtml = await page.evaluate(
      () =>
        (window as unknown as {__printCapturedHtml?: string})
          .__printCapturedHtml ?? '',
    );
    expect(printedHtml).toContain('data:font/woff2;base64,');
    expect(printedHtml).toContain('Bonifacy');
  });

  test('Config toggles retain a single Chart instance, preserve #chart zoom scaling, and update colorTarget and fontFamily', async ({
    page,
  }) => {
    await expect(page.locator('#content')).toContainText('Bonifacy');

    // Zoom in and capture initial Topola 4 instance class and #chart transform
    await page.locator('.zoom-in').click();
    await page.waitForTimeout(200);

    const before = await page.evaluate(() => {
      const chartG = document.getElementById('chart');
      const rootScopeG = chartG?.querySelector('g[class^="topola-"]');
      return {
        chartTransform: chartG?.getAttribute('transform') ?? '',
        scopeClass: rootScopeG?.getAttribute('class') ?? '',
      };
    });
    expect(before.scopeClass).toMatch(/^topola-\d+$/);
    expect(before.chartTransform).toMatch(/^scale\(/);

    // Switch to Settings tab and toggle Colors -> by sex, Color style -> frame, Font -> Lora
    await page.getByText('Settings', {exact: true}).click();
    await page
      .locator('form.details .item')
      .filter({hasText: 'Colors'})
      .getByText('by sex')
      .click();
    await page
      .locator('form.details .item')
      .filter({hasText: 'Color style'})
      .getByText('frame')
      .click();
    await page.locator('select[aria-label="Font"]').selectOption('Lora');
    await expect(page.locator('#topola-google-font-lora')).toBeAttached();

    const after = await page.evaluate(() => {
      const chartG = document.getElementById('chart');
      const rootScopeG = chartG?.querySelector('g[class^="topola-"]');
      const styleEl = chartG?.querySelector('style');
      const loraLink = document.getElementById('topola-google-font-lora');
      return {
        url: window.location.hash,
        chartTransform: chartG?.getAttribute('transform') ?? '',
        scopeClass: rootScopeG?.getAttribute('class') ?? '',
        styleCss: styleEl?.textContent ?? '',
        hasLoraLink: Boolean(loraLink),
      };
    });

    // Exact same Chart instance retained & outer <g id="chart"> zoom scale preserved!
    expect(after.scopeClass).toBe(before.scopeClass);
    expect(after.chartTransform).toBe(before.chartTransform);
    expect(after.url).toContain('c=s');
    expect(after.url).toContain('ct=f');
    expect(after.url).toContain('ff=Lora');
    expect(after.hasLoraLink).toBe(true);
    expect(after.styleCss).toContain('.male .frame { stroke: #1565c0; }');
    expect(after.styleCss).toContain('font-family: Lora, Georgia, serif;');
  });
});
