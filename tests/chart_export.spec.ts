import {expect, Page, test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {
  mockGedcomResponse,
  setupGedcomRoute,
  setupHermeticEnvironment,
} from './helpers';

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

/** Returns the contents of the streams in a PDF file, decompressed. */
function getPdfContents(pdf: Buffer): string {
  const contents: string[] = [];
  const text = pdf.toString('latin1');
  const streams = /\/Length (\d+)[^>]*>>\s*stream\r?\n/g;
  for (const match of text.matchAll(streams)) {
    const start = (match.index ?? 0) + match[0].length;
    const data = pdf.subarray(start, start + Number(match[1]));
    try {
      contents.push(inflateSync(data).toString('latin1'));
    } catch {
      // Not compressed with Flate, e.g. an image.
    }
  }
  return contents.join('\n');
}

/** Returns the relative difference between two numbers. */
function relativeDifference(a: number, b: number): number {
  return Math.abs(a / b - 1);
}

/** Returns the width and height of a PNG image. */
function getPngSize(png: Buffer): [number, number] {
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

/** Downloads the chart in the given format and returns the file path. */
async function download(page: Page, menuItem: string): Promise<string> {
  await page.getByText('Download', {exact: true}).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByText(menuItem, {exact: true}).click();
  const path = await (await downloadPromise).path();
  expect(path).toBeTruthy();
  return path ?? '';
}

test.describe('PDF export', () => {
  test.beforeEach(async ({page, context}) => {
    await setupHermeticEnvironment(context);
    await setupGedcomRoute(context);
    await page.goto('/#/view?url=https://example.org/family.ged');
    await expect(page.locator('#content')).toContainText('Bonifacy');
  });

  test('draws the chart as vectors with the chart fonts', async ({page}) => {
    const pdf = (await readFile(await download(page, 'PDF file'))).toString(
      'latin1',
    );

    // The chart font, and the font of the ♂ and ♀ symbols, are embedded.
    expect(pdf).toMatch(/\/BaseFont \/Montserrat/);
    expect(pdf).toMatch(/\/BaseFont \/Symbols/);
    // No image of the chart: test.ged has no photos.
    expect(pdf).not.toContain('/Subtype /Image');
  });

  test('draws the chart as an image if the fonts cannot be loaded', async ({
    page,
  }) => {
    await page.route('**/*.ttf*', (route) => route.fulfill({status: 404}));

    const pdf = (await readFile(await download(page, 'PDF file'))).toString(
      'latin1',
    );

    expect(pdf).toContain('/Subtype /Image');
    expect(pdf).not.toMatch(/\/BaseFont \/Montserrat/);
  });
});

/** A family with 260 children, which makes a very wide chart. */
function createWideGedcom(): string {
  const children = Array.from({length: 260}, (_, i) => `C${i}`);
  return [
    '0 HEAD',
    '0 @P@ INDI',
    '1 NAME Parent /Wide/',
    '1 FAMS @F@',
    '0 @F@ FAM',
    '1 HUSB @P@',
    ...children.map((id) => `1 CHIL @${id}@`),
    ...children.flatMap((id, i) => [
      `0 @${id}@ INDI`,
      `1 NAME Child${i} /Wide/`,
      '1 FAMC @F@',
    ]),
    '0 TRLR',
  ].join('\n');
}

test.describe('Export of a very wide chart', () => {
  test.beforeEach(async ({page, context}) => {
    await setupHermeticEnvironment(context);
    await mockGedcomResponse(context, createWideGedcom());
    await page.goto('/#/view?url=https://example.org/family.ged&indi=P');
    await expect(page.locator('#content')).toContainText('Child259');
  });

  test('PNG file is scaled down to fit the canvas', async ({page}) => {
    const {trueW, trueH} = await getChartDimensions(page);
    // Wider than the largest canvas at twice the size of the chart.
    expect(2 * trueW).toBeGreaterThan(32767);

    const [width, height] = getPngSize(
      await readFile(await download(page, 'PNG file')),
    );

    expect(width).toBeLessThanOrEqual(32767);
    // Same proportions, up to the rounding to whole pixels.
    expect(relativeDifference(width / height, trueW / trueH)).toBeLessThan(
      0.01,
    );
  });

  test('PDF page shows the whole chart', async ({page}) => {
    const {trueW, trueH} = await getChartDimensions(page);
    // Wider than the largest PDF page.
    expect(trueW).toBeGreaterThan(14400);

    const pdfPath = await download(page, 'PDF file');
    const [pdfW, pdfH] = await getPdfPageSize(pdfPath);

    // The page is scaled down to fit in a PDF file, instead of being cut.
    expect(pdfW).toBeLessThanOrEqual(14400);
    expect(relativeDifference(pdfW / pdfH, trueW / trueH)).toBeLessThan(0.01);
    // And so is the chart in it: the drawing is scaled by the same factor.
    const scale = pdfW / trueW;
    const matrices = getPdfContents(await readFile(pdfPath)).matchAll(
      /^([\d.]+) 0\. 0\. ([\d.]+) \S+ \S+ cm$/gm,
    );
    expect(
      Array.from(matrices).some(
        ([, a, d]) => a === d && relativeDifference(Number(a), scale) < 0.01,
      ),
    ).toBe(true);
  });
});
