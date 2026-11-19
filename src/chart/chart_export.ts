import {select} from 'd3-selection';
import 'd3-transition';
import {zoomTransform} from 'd3-zoom';
import {saveAs} from 'file-saver';

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
    image.addEventListener('error', (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    });
    image.src = objectUrl;
  });
}

/** Draw image on a new canvas and return the canvas. */
function drawImageOnCanvas(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  // Scale image for better quality.
  canvas.width = image.width * 2;
  canvas.height = image.height * 2;

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

/** Return a copy of the SVG chart but without scaling and positioning. */
function getStrippedSvg() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const svg = document.getElementById('chartSvg')!.cloneNode(true) as Element;

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
 * Returns the serialized chart SVG with a white background and all images and
 * active web fonts inlined as data URLs, together with the chart's true
 * (unscaled) width and height in pixels.
 *
 * The dimensions are read from the stripped SVG (i.e. with the d3-zoom scale
 * divided out), NOT from the live `#chartSvg` element, whose `width`/`height`
 * attributes carry the zoom-scaled values. Callers that need the real page
 * size (e.g. PDF export) must use these returned dimensions rather than
 * reading the live element, otherwise the output is sized to the on-screen
 * zoomed viewport and ends up truncated.
 */
export async function getSvgContentsWithInlinedImages(): Promise<{
  contents: string;
  width: number;
  height: number;
}> {
  const svg = getStrippedSvg();
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

  await Promise.all([inlineImages(svg), inlineFonts(svg)]);
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

export async function downloadPdf() {
  // Lazy load jspdf.
  const {default: jspdf} = await import('jspdf');

  // Use the chart's true (unscaled) dimensions, returned by the same call that
  // serializes the SVG, so the PDF page and the drawn SVG always match. Reading
  // the live `#chartSvg` attributes here would pick up d3-zoom's scaled values
  // and produce a page sized to the on-screen viewport instead of the full tree.
  const {contents, width, height} = await getSvgContentsWithInlinedImages();
  const doc = new jspdf({
    orientation: width > height ? 'l' : 'p',
    unit: 'pt',
    format: [width, height],
  });
  await doc.addSvgAsImage(contents, 0, 0, width, height);
  doc.save('topola.pdf');
}
