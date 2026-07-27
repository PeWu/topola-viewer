import {expect, test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {setupGedcomRoute} from './helpers';

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
