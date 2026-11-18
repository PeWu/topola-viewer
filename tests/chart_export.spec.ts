import {expect, Page, test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {mockGedcomResponse, setupGedcomRoute} from './helpers';

/**
 * Reads the chart's live (zoom-scaled) and true (unscaled) dimensions from the
 * rendered page. Mirrors what `getStrippedSvg()` does in chart_export.ts: the
 * live `#chartSvg` width/height carry the on-screen zoomed size, so the true
 * size is recovered by dividing by the d3-zoom scale stored on `#svgContainer`.
 */
async function getChartDimensions(page: Page) {
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

test.describe('Chart export', () => {
  test.beforeEach(async ({page, context}) => {
    await setupGedcomRoute(context);
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
    // on-screen zoomed viewport. This is the regression check for the bug where
    // downloadPdf() read the live #chartSvg attributes.
    expect(pdfW).toBeCloseTo(dims.trueW, 0);
    expect(pdfH).toBeCloseTo(dims.trueH, 0);
    // And explicitly NOT the zoomed size.
    expect(pdfW).not.toBeCloseTo(dims.liveW, 0);
    expect(pdfH).not.toBeCloseTo(dims.liveH, 0);
  });
});

/** Returns the drawing operators of a PDF file, decompressed. */
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
