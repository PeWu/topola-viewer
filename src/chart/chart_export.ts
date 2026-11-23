import {select} from 'd3-selection';
import 'd3-transition';
import {zoomTransform} from 'd3-zoom';
import {saveAs} from 'file-saver';
import type {jsPDF} from 'jspdf';
import dejaVuSymbolsUrl from './fonts/DejaVuSans-Symbols.ttf?url';
import montserratBoldUrl from './fonts/Montserrat-Bold.ttf?url';
import montserratItalicUrl from './fonts/Montserrat-Italic.ttf?url';
import montserratRegularUrl from './fonts/Montserrat-Regular.ttf?url';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Cache of fetched font URLs mapped to `data:font/woff2;base64,...` data URLs. */
const fontDataUrlCache = new Map<string, Promise<string | null>>();

/** Loads blob as data URL. */
function loadAsDataUrl(blob: Blob): Promise<string> {
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  return new Promise<string>((resolve, _reject) => {
    reader.onload = (e) => resolve((e.target as FileReader).result as string);
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function inferFontMimeType(url: string, contentType: string | null): string {
  const cleanUrl = url.split(/[?#]/)[0].toLowerCase();
  if (cleanUrl.endsWith('.woff2') || contentType?.includes('woff2')) {
    return 'font/woff2';
  }
  if (cleanUrl.endsWith('.woff') || contentType?.includes('woff')) {
    return 'font/woff';
  }
  if (cleanUrl.endsWith('.ttf') || contentType?.includes('ttf')) {
    return 'font/ttf';
  }
  return 'font/woff2';
}

function fetchFontAsDataUrl(resolvedUrl: string): Promise<string | null> {
  const cached = fontDataUrlCache.get(resolvedUrl);
  if (cached) {
    return cached;
  }
  const pending = (async () => {
    try {
      const response = await fetch(resolvedUrl);
      if (!response.ok) {
        return null;
      }
      const buffer = await response.arrayBuffer();
      const mime = inferFontMimeType(
        resolvedUrl,
        response.headers.get('content-type'),
      );
      return `data:${mime};base64,${arrayBufferToBase64(buffer)}`;
    } catch (e) {
      console.warn('Failed to load font:', e);
      return null;
    }
  })();
  fontDataUrlCache.set(resolvedUrl, pending);
  return pending;
}

interface CollectedFontFaceRule {
  cssText: string;
  baseUrl: string;
}

async function collectDocumentFontFaceRules(): Promise<
  CollectedFontFaceRule[]
> {
  if (typeof document === 'undefined' || !document.styleSheets) {
    return [];
  }
  const collected: CollectedFontFaceRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    const baseUrl = sheet.href || document.baseURI;
    try {
      const rules = sheet.cssRules;
      for (const rule of Array.from(rules)) {
        if (rule.type === CSSRule.FONT_FACE_RULE) {
          collected.push({cssText: rule.cssText, baseUrl});
        }
      }
    } catch (_e) {
      if (sheet.href) {
        try {
          const resp = await fetch(sheet.href);
          if (resp.ok) {
            const css = await resp.text();
            const matches = css.match(/@font-face\s*\{[^}]*\}/gi) ?? [];
            for (const block of matches) {
              collected.push({cssText: block, baseUrl: sheet.href});
            }
          }
        } catch (_fetchErr) {
          // Ignore inaccessible cross-origin stylesheet.
        }
      }
    }
  }
  return collected;
}

function extractRuleFontFamily(ruleCss: string): string | null {
  const match = /font-family\s*:\s*([^;}]+)/i.exec(ruleCss);
  if (!match) {
    return null;
  }
  return match[1]
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase();
}

/**
 * Inspects active `@font-face` rules in `document.styleSheets` matching the
 * chart's font stack, fetches `.woff2` font files, and embeds them as
 * `data:font/woff2;base64,...` rules inside the SVG's `<style>` element so
 * standalone `.svg` files and `<img src="blob:...svg">` PNG exports preserve
 * exact web font metrics.
 */
export async function inlineFonts(svg: Element): Promise<void> {
  const styleElements = Array.from(svg.querySelectorAll('style'));
  const svgStyleText = styleElements
    .map((el) => el.textContent ?? '')
    .join('\n')
    .toLowerCase();

  const rules = await collectDocumentFontFaceRules();
  if (rules.length === 0) {
    return;
  }

  const matchingRules = rules.filter((r) => {
    if (!/src\s*:/i.test(r.cssText)) {
      return false;
    }
    const family = extractRuleFontFamily(r.cssText);
    if (!family) {
      return false;
    }
    return !svgStyleText || svgStyleText.includes(family);
  });

  if (matchingRules.length === 0) {
    return;
  }

  const inlinedBlocks = await Promise.all(
    matchingRules.map(async ({cssText, baseUrl}) => {
      const urlRegex = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)\s]+))\s*\)/gi;
      const replacements = new Map<string, string>();
      let match: RegExpExecArray | null;
      while ((match = urlRegex.exec(cssText)) !== null) {
        const fullMatch = match[0];
        const rawUrl = match[1] ?? match[2] ?? match[3] ?? '';
        if (!rawUrl || /^data:/i.test(rawUrl)) {
          continue;
        }
        try {
          const resolvedUrl = new URL(rawUrl, baseUrl).href;
          const dataUrl = await fetchFontAsDataUrl(resolvedUrl);
          if (dataUrl) {
            replacements.set(fullMatch, `url("${dataUrl}")`);
          }
        } catch (_e) {
          // Leave malformed URL unchanged.
        }
      }
      if (replacements.size === 0 && !/url\(\s*["']?data:/i.test(cssText)) {
        return null;
      }
      let updated = cssText;
      replacements.forEach((replacement, original) => {
        updated = updated.split(original).join(replacement);
      });
      return updated;
    }),
  );

  const validBlocks = inlinedBlocks.filter(
    (block): block is string => block !== null,
  );
  if (validBlocks.length === 0) {
    return;
  }

  const targetStyle = styleElements[0];
  if (targetStyle) {
    targetStyle.textContent = `${validBlocks.join('\n')}\n${
      targetStyle.textContent ?? ''
    }`;
  } else {
    const newStyle = document.createElementNS(SVG_NS, 'style');
    newStyle.textContent = validBlocks.join('\n');
    svg.prepend(newStyle);
  }
}

async function inlineImage(image: SVGImageElement) {
  const href = image.href.baseVal;
  if (!href || /^data:/i.test(href)) {
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
  const objectUrl = URL.createObjectURL(blob);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.addEventListener('load', () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    });
    image.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load the chart as an image'));
    });
    image.src = objectUrl;
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
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'dominant-baseline',
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

/**
 * Returns the cloned chart SVG with a white background and all images (and, for
 * non-PDF exports, active web fonts) inlined as data URLs, together with the
 * chart's true (unscaled) width and height in pixels.
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
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', 'white');
  svg.prepend(rect);

  if (forPdf) {
    await inlineImages(svg);
  } else {
    await Promise.all([inlineImages(svg), inlineFonts(svg)]);
  }
  return {svg, width, height};
}

/** Same as getSvgWithInlinedImages(), with the SVG serialized. */
export async function getSvgContentsWithInlinedImages(): Promise<{
  contents: string;
  width: number;
  height: number;
}> {
  const {svg, width, height} = await getSvgWithInlinedImages(false);
  const contents = new XMLSerializer().serializeToString(svg);
  return {contents, width, height};
}

/** Shows the print dialog to print the currently displayed chart. */
export async function printChart() {
  const {contents} = await getSvgContentsWithInlinedImages();
  const printWindow = document.createElement('iframe');
  printWindow.style.position = 'absolute';
  printWindow.style.top = '-1000px';
  printWindow.style.left = '-1000px';
  printWindow.onload = () => {
    printWindow.contentDocument?.open();
    printWindow.contentDocument?.write(contents);
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
    if (isFinite(scale) && Math.abs(scale - 1) > 0.002) {
      const transform = text.getAttribute('transform') ?? '';
      const x = parseFloat(text.getAttribute('x') ?? '');
      // Built-in presets position texts via transform="translate(x, y)", while
      // custom looks such as Transit may use a non-zero `x` attribute.
      const scaleTransform =
        Number.isFinite(x) && x !== 0
          ? `translate(${x}, 0) scale(${scale}, 1) translate(${-x}, 0)`
          : `scale(${scale}, 1)`;
      text.setAttribute(
        'transform',
        transform ? `${transform} ${scaleTransform}` : scaleTransform,
      );
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
