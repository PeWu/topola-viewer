import {select} from 'd3-selection';
import 'd3-transition';
import {zoomTransform} from 'd3-zoom';
import {saveAs} from 'file-saver';

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
  image.src = URL.createObjectURL(blob);
  return new Promise<HTMLImageElement>((resolve, _reject) => {
    image.addEventListener('load', () => resolve(image));
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
async function getSvgContentsWithInlinedImages(): Promise<{
  contents: string;
  width: number;
  height: number;
}> {
  const svg = getStrippedSvg();
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
