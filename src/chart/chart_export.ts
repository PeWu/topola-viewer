import {select} from 'd3-selection';
import 'd3-transition';
import {zoomTransform} from 'd3-zoom';
import {saveAs} from 'file-saver';
import type {jsPDF} from 'jspdf';
import dejaVuSymbolsUrl from './fonts/DejaVuSans-Symbols.ttf?url';
import montserratBoldUrl from './fonts/Montserrat-Bold.ttf?url';
import montserratItalicUrl from './fonts/Montserrat-Italic.ttf?url';
import montserratRegularUrl from './fonts/Montserrat-Regular.ttf?url';

/** Loads blob as data URL. */
function loadAsDataUrl(blob: Blob): Promise<string> {
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  return new Promise<string>((resolve, _reject) => {
    reader.onload = (e) => resolve((e.target as FileReader).result as string);
  });
}

async function inlineImage(image: SVGImageElement) {
  const href = image.href.baseVal;
  if (!href) {
    return;
  }
  try {
    const response = await fetch(href);
    const blob = await response.blob();
    const dataUrl = await loadAsDataUrl(blob);
    image.href.baseVal = dataUrl;
  } catch (e) {
    console.warn('Failed to load image:', e);
  }
}

/**
 * Fetches all images in the SVG and replaces them with inlined images as data
 * URLs. Images are replaced in place. The replacement is done, the returned
 * promise is resolved.
 */
async function inlineImages(svg: Element): Promise<void> {
  const images = Array.from(svg.getElementsByTagName('image'));
  await Promise.all(images.map(inlineImage));
}

/** Loads a blob into an image object. */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const image = new Image();
  const url = URL.createObjectURL(blob);
  image.src = url;
  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.addEventListener('load', () => {
      URL.revokeObjectURL(url);
      resolve(image);
    });
    image.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load the chart as an image'));
    });
  });
}

/** Largest canvas width or height supported by the major browsers. */
const MAX_CANVAS_SIDE = 32767;
/** Largest canvas area supported by Chrome, in pixels. */
const MAX_CANVAS_AREA = 268_435_456;

/** Draw image on a new canvas and return the canvas. */
function drawImageOnCanvas(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  // Scale image for better quality, as long as the canvas is not too large
  // for the browser. Large charts are scaled down instead of failing.
  const scale = Math.min(
    2,
    MAX_CANVAS_SIDE / image.width,
    MAX_CANVAS_SIDE / image.height,
    Math.sqrt(MAX_CANVAS_AREA / (image.width * image.height)),
  );
  canvas.width = Math.floor(image.width * scale);
  canvas.height = Math.floor(image.height * scale);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const ctx = canvas.getContext('2d')!;
  const oldFill = ctx.fillStyle;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = oldFill;

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject();
      }
    }, type);
  });
}

/** Styles of the chart copied to the elements of PDF files. */
const PDF_STYLES = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'opacity',
  'font-size',
  'font-weight',
  'font-style',
];

/** Attribute with the width of a text in the browser, for PDF files. */
const TEXT_WIDTH_ATTRIBUTE = 'data-text-width';

/**
 * Copies the styles computed by the browser to the attributes of the copy of
 * the chart, and removes the style sheets. svg2pdf.js applies style sheets to
 * each element, which is several times slower. Also keeps the width of each
 * text in the browser, to draw texts at the same width in the PDF file.
 */
function copyComputedStyles(live: Element, copy: Element) {
  const liveElements = live.querySelectorAll('*');
  const copyElements = copy.querySelectorAll('*');
  liveElements.forEach((element, i) => {
    const style = getComputedStyle(element);
    for (const name of PDF_STYLES) {
      copyElements[i].setAttribute(name, style.getPropertyValue(name));
    }
    if (element instanceof SVGTextElement) {
      copyElements[i].setAttribute(
        TEXT_WIDTH_ATTRIBUTE,
        String(element.getComputedTextLength()),
      );
    }
  });
  copy.querySelectorAll('style').forEach((style) => style.remove());
}

/**
 * Return a copy of the SVG chart but without scaling and positioning.
 *
 * @param forPdf copy the computed styles to the elements (see
 *   copyComputedStyles())
 */
function getStrippedSvg(forPdf = false) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const live = document.getElementById('chartSvg')!;
  const svg = live.cloneNode(true) as Element;
  if (forPdf) {
    copyComputedStyles(live, svg);
  }

  svg.removeAttribute('transform');
  const parent = select('#svgContainer').node() as Element;
  const scale = zoomTransform(parent).k;
  svg.setAttribute('width', String(Number(svg.getAttribute('width')) / scale));
  svg.setAttribute(
    'height',
    String(Number(svg.getAttribute('height')) / scale),
  );
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  svg.querySelector('#chart')!.removeAttribute('transform');

  return svg;
}

function getSvgContents() {
  return new XMLSerializer().serializeToString(getStrippedSvg());
}

/**
 * Returns the serialized chart SVG with a white background and all images
 * inlined as data URLs, together with the chart's true (unscaled) width and
 * height in pixels.
 *
 * The dimensions are read from the stripped SVG (i.e. with the d3-zoom scale
 * divided out), NOT from the live `#chartSvg` element, whose `width`/`height`
 * attributes carry the zoom-scaled values. Callers that need the real page
 * size (e.g. PDF export) must use these returned dimensions rather than
 * reading the live element, otherwise the output is sized to the on-screen
 * zoomed viewport and ends up truncated.
 */
async function getSvgWithInlinedImages(forPdf = false): Promise<{
  svg: Element;
  width: number;
  height: number;
}> {
  const svg = getStrippedSvg(forPdf);
  const width = Number(svg.getAttribute('width'));
  const height = Number(svg.getAttribute('height'));

  // Set white background because the default background of the SVG
  // is transparent, which causes issues when printing or exporting to PDF.
  const svgNs = 'http://www.w3.org/2000/svg';
  const rect = document.createElementNS(svgNs, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', 'white');
  svg.prepend(rect);

  await inlineImages(svg);
  return {svg, width, height};
}

/** Same as getSvgWithInlinedImages(), with the SVG serialized. */
async function getSvgContentsWithInlinedImages(): Promise<{
  contents: string;
  width: number;
  height: number;
}> {
  const {svg, width, height} = await getSvgWithInlinedImages();
  const contents = new XMLSerializer().serializeToString(svg);
  return {contents, width, height};
}

/** Shows the print dialog to print the currently displayed chart. */
export function printChart() {
  const printWindow = document.createElement('iframe');
  printWindow.style.position = 'absolute';
  printWindow.style.top = '-1000px';
  printWindow.style.left = '-1000px';
  printWindow.onload = () => {
    printWindow.contentDocument?.open();
    printWindow.contentDocument?.write(getSvgContents());
    printWindow.contentDocument?.close();
    // Doesn't work on Firefox without the setTimeout.
    setTimeout(() => {
      printWindow.contentWindow?.focus();
      printWindow.contentWindow?.print();
      printWindow.parentNode?.removeChild(printWindow);
    }, 500);
  };
  document.body.appendChild(printWindow);
}

export async function downloadSvg() {
  const {contents} = await getSvgContentsWithInlinedImages();
  const blob = new Blob([contents], {type: 'image/svg+xml'});
  saveAs(blob, 'topola.svg');
}

async function drawOnCanvas(): Promise<HTMLCanvasElement> {
  const {contents} = await getSvgContentsWithInlinedImages();
  const blob = new Blob([contents], {type: 'image/svg+xml'});
  return drawImageOnCanvas(await loadImage(blob));
}

export async function downloadPng() {
  const canvas = await drawOnCanvas();
  const blob = await canvasToBlob(canvas, 'image/png');
  saveAs(blob, 'topola.png');
}

/** Largest page width or height allowed in a PDF file, in points. */
const MAX_PDF_SIDE = 14400;
/** JPEG quality of the chart in PDF files drawn as an image. */
const PDF_JPEG_QUALITY = 0.9;

/** Name of the chart font in PDF files. */
const PDF_FONT = 'Montserrat';
/** Name of the font for the symbols missing in the chart font. */
const PDF_SYMBOL_FONT = 'Symbols';

/** Fonts embedded in PDF files. */
const PDF_FONTS: Array<{url: string; name: string; styles: string[]}> = [
  {url: montserratRegularUrl, name: PDF_FONT, styles: ['normal']},
  {url: montserratBoldUrl, name: PDF_FONT, styles: ['bold', 'bolditalic']},
  {url: montserratItalicUrl, name: PDF_FONT, styles: ['italic']},
  {url: dejaVuSymbolsUrl, name: PDF_SYMBOL_FONT, styles: ['normal']},
];

/** Font files as base64 strings, loaded once. */
const fontFiles = new Map<string, Promise<string>>();

/** Loads a font file as a base64 string. */
function loadFontFile(url: string): Promise<string> {
  let file = fontFiles.get(url);
  if (!file) {
    file = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load font ${url}: ${response.status}`);
        }
        return response.blob();
      })
      .then(loadAsDataUrl)
      .then((dataUrl) => dataUrl.substring(dataUrl.indexOf(',') + 1));
    fontFiles.set(url, file);
    file.catch(() => fontFiles.delete(url));
  }
  return file;
}

/** Adds the fonts used in the chart to the PDF document. */
async function addPdfFonts(doc: jsPDF) {
  const files = await Promise.all(PDF_FONTS.map(({url}) => loadFontFile(url)));
  PDF_FONTS.forEach(({url, name, styles}, i) => {
    const fileName = url.substring(url.lastIndexOf('/') + 1);
    doc.addFileToVFS(fileName, files[i]);
    styles.forEach((style) => doc.addFont(fileName, name, style));
  });
}

/** Returns whether the chart font has a glyph for each character of the text. */
function hasGlyphs(doc: jsPDF, text: string): boolean {
  doc.setFont(PDF_FONT, 'normal');
  const metadata = (
    doc.getFont() as unknown as {
      metadata?: {characterToGlyph?: (code: number) => number};
    }
  ).metadata;
  if (!metadata?.characterToGlyph) {
    return !/[\u2190-\u2bff]/.test(text);
  }
  return Array.from(text).every(
    (char) =>
      /\s/.test(char) ||
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      metadata.characterToGlyph!(char.codePointAt(0)!) !== 0,
  );
}

/**
 * Sets the fonts of the texts, and scales each text horizontally so that it
 * has the same width as in the browser. Texts would be slightly wider in the
 * PDF file because jsPDF doesn't use kerning, or wider or narrower if the
 * browser used another font, e.g. when Montserrat could not be loaded.
 */
function prepareTexts(svg: Element, doc: jsPDF) {
  svg.querySelectorAll('text').forEach((text) => {
    // White space is collapsed like in the browser.
    const content = (text.textContent ?? '').replace(/\s+/g, ' ').trim();
    const bold = Number(text.getAttribute('font-weight')) >= 600;
    const italic = text.getAttribute('font-style') === 'italic';
    const symbols = !hasGlyphs(doc, content);
    text.setAttribute('font-family', symbols ? PDF_SYMBOL_FONT : PDF_FONT);
    if (symbols) {
      text.setAttribute('font-weight', 'normal');
      text.setAttribute('font-style', 'normal');
    } else {
      text.setAttribute('font-weight', bold ? 'bold' : 'normal');
    }
    const width = Number(text.getAttribute(TEXT_WIDTH_ATTRIBUTE));
    text.removeAttribute(TEXT_WIDTH_ATTRIBUTE);
    const fontSize = parseFloat(text.getAttribute('font-size') ?? '');
    if (!content || !(width > 0) || !(fontSize > 0)) {
      return;
    }
    const style = symbols
      ? 'normal'
      : `${bold ? 'bold' : ''}${italic ? 'italic' : ''}` || 'normal';
    doc.setFont(symbols ? PDF_SYMBOL_FONT : PDF_FONT, style);
    const pdfWidth = doc.getStringUnitWidth(content) * fontSize;
    const scale = width / pdfWidth;
    // Texts are positioned with a transform, at their anchor point.
    if (isFinite(scale) && Math.abs(scale - 1) > 0.002) {
      const transform = text.getAttribute('transform') ?? '';
      text.setAttribute('transform', `${transform} scale(${scale}, 1)`);
    }
  });
}

/**
 * Creates the PDF document as vectors, with svg2pdf.js. Texts stay sharp at
 * any zoom level and can be selected, and the file is much smaller than an
 * image of the chart.
 */
async function createVectorPdf(): Promise<jsPDF> {
  // Lazy load jspdf and svg2pdf.js.
  const [{default: jspdf}, {svg2pdf}] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
  ]);
  // Use the chart's true (unscaled) dimensions, returned by the same call that
  // copies the SVG, so the PDF page and the drawn SVG always match. Reading
  // the live `#chartSvg` attributes here would pick up d3-zoom's scaled values
  // and produce a page sized to the on-screen viewport instead of the full tree.
  const {svg, width, height} = await getSvgWithInlinedImages(true);
  // Large charts are scaled down to fit in a PDF page, instead of being cut.
  const scale = Math.min(1, MAX_PDF_SIDE / width, MAX_PDF_SIDE / height);
  const doc = new jspdf({
    orientation: width > height ? 'l' : 'p',
    unit: 'pt',
    format: [width * scale, height * scale],
    compress: true,
  });
  await addPdfFonts(doc);
  prepareTexts(svg, doc);
  // Without a viewBox, svg2pdf.js would draw the chart at its true size, and
  // cut it at the page size instead of scaling it down.
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  await svg2pdf(svg, doc, {
    x: 0,
    y: 0,
    width: width * scale,
    height: height * scale,
  });
  return doc;
}

/** Creates the PDF document as an image of the chart. */
async function createImagePdf(): Promise<jsPDF> {
  // Lazy load jspdf.
  const {default: jspdf} = await import('jspdf');
  const {contents, width, height} = await getSvgContentsWithInlinedImages();
  // The chart is drawn by the browser, like for PNG files. This is much faster
  // than jsPDF's addSvgAsImage(), which draws it with canvg at its true size.
  const blob = new Blob([contents], {type: 'image/svg+xml'});
  const canvas = drawImageOnCanvas(await loadImage(blob));
  const scale = Math.min(1, MAX_PDF_SIDE / width, MAX_PDF_SIDE / height);
  const doc = new jspdf({
    orientation: width > height ? 'l' : 'p',
    unit: 'pt',
    format: [width * scale, height * scale],
  });
  doc.addImage(
    canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY),
    'JPEG',
    0,
    0,
    width * scale,
    height * scale,
  );
  return doc;
}

export async function downloadPdf() {
  let doc: jsPDF;
  try {
    doc = await createVectorPdf();
  } catch (e) {
    // E.g. the fonts could not be loaded.
    console.warn('Failed to create a vector PDF file, using an image:', e);
    doc = await createImagePdf();
  }
  doc.save('topola.pdf');
}
