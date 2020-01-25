import * as d3 from 'd3';
import * as React from 'react';
import jsPDF from 'jspdf';
import {intlShape} from 'react-intl';
import {saveAs} from 'file-saver';
import {
  JsonGedcomData,
  ChartHandle,
  IndiInfo,
  createChart,
  DetailedRenderer,
  HourglassChart,
  RelativesChart,
  FancyChart,
  CircleRenderer,
} from 'topola';

/** Called when the view is dragged with the mouse. */
function zoomed() {
  const svg = d3.select('#chart');
  const parent = (svg.node() as HTMLElement).parentElement!;
  parent.scrollLeft = -d3.event.transform.x;
  parent.scrollTop = -d3.event.transform.y;
}

/** Called when the scrollbars are used. */
function scrolled() {
  const svg = d3.select('#chart');
  const parent = (svg.node() as HTMLElement).parentElement as Element;
  const x = parent.scrollLeft + parent.clientWidth / 2;
  const y = parent.scrollTop + parent.clientHeight / 2;
  d3.select(parent).call(d3.zoom().translateTo, x, y);
}

/** Loads blob as data URL. */
function loadAsDataUrl(blob: Blob): Promise<string> {
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  return new Promise<string>((resolve, reject) => {
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
  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.addEventListener('load', () => resolve(image));
  });
}

/** Draw image on a new canvas and return the canvas. */
function drawOnCanvas(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  // Scale image for better quality.
  canvas.width = image.width * 2;
  canvas.height = image.height * 2;

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

/** Supported chart types. */
export enum ChartType {
  Hourglass,
  Relatives,
  Fancy,
}

export interface ChartProps {
  data: JsonGedcomData;
  selection: IndiInfo;
  chartType: ChartType;
  onSelection: (indiInfo: IndiInfo) => void;
}

/** Component showing the genealogy chart and handling transition animations. */
export class Chart extends React.PureComponent<ChartProps, {}> {
  private chart?: ChartHandle;

  private getChartType() {
    switch (this.props.chartType) {
      case ChartType.Hourglass:
        return HourglassChart;
      case ChartType.Relatives:
        return RelativesChart;
      case ChartType.Fancy:
        return FancyChart;
      default:
        // Fall back to hourglass chart.
        return HourglassChart;
    }
  }

  private getRendererType() {
    switch (this.props.chartType) {
      case ChartType.Fancy:
        return CircleRenderer;
      default:
        // Use DetailedRenderer by default.
        return DetailedRenderer;
    }
  }

  /**
   * Renders the chart or performs a transition animation to a new state.
   * If indiInfo is not given, it means that it is the initial render and no
   * animation is performed.
   */
  private renderChart(args: {initialRender: boolean} = {initialRender: false}) {
    if (args.initialRender) {
      (d3.select('#chart').node() as HTMLElement).innerHTML = '';
      this.chart = createChart({
        json: this.props.data,
        chartType: this.getChartType(),
        renderer: this.getRendererType(),
        svgSelector: '#chart',
        indiCallback: (info) => this.props.onSelection(info),
        animate: true,
        updateSvgSize: false,
        locale: this.context.intl.locale,
      });
    } else {
      this.chart!.setData(this.props.data);
    }
    const chartInfo = this.chart!.render({
      startIndi: this.props.selection.id,
      baseGeneration: this.props.selection.generation,
    });
    const svg = d3.select('#chart');
    const parent = (svg.node() as HTMLElement).parentElement as Element;

    d3.select(parent)
      .on('scroll', scrolled)
      .call(
        d3
          .zoom()
          .scaleExtent([1, 1])
          .translateExtent([[0, 0], chartInfo.size])
          .on('zoom', zoomed),
      );

    const scrollTopTween = (scrollTop: number) => {
      return () => {
        const i = d3.interpolateNumber(parent.scrollTop, scrollTop);
        return (t: number) => {
          parent.scrollTop = i(t);
        };
      };
    };
    const scrollLeftTween = (scrollLeft: number) => {
      return () => {
        const i = d3.interpolateNumber(parent.scrollLeft, scrollLeft);
        return (t: number) => {
          parent.scrollLeft = i(t);
        };
      };
    };

    const dx = parent.clientWidth / 2 - chartInfo.origin[0];
    const dy = parent.clientHeight / 2 - chartInfo.origin[1];
    const offsetX = d3.max([0, (parent.clientWidth - chartInfo.size[0]) / 2]);
    const offsetY = d3.max([0, (parent.clientHeight - chartInfo.size[1]) / 2]);
    const svgTransition = svg
      .transition()
      .delay(200)
      .duration(500);
    const transition = args.initialRender ? svg : svgTransition;
    transition
      .attr('transform', `translate(${offsetX}, ${offsetY})`)
      .attr('width', chartInfo.size[0])
      .attr('height', chartInfo.size[1]);
    if (args.initialRender) {
      parent.scrollLeft = -dx;
      parent.scrollTop = -dy;
    } else {
      svgTransition
        .tween('scrollLeft', scrollLeftTween(-dx))
        .tween('scrollTop', scrollTopTween(-dy));
    }
  }

  componentDidMount() {
    this.renderChart({initialRender: true});
  }

  componentDidUpdate(prevProps: ChartProps) {
    const initialRender = this.props.chartType !== prevProps.chartType;
    this.renderChart({initialRender});
  }

  /** Make intl appear in this.context. */
  static contextTypes = {
    intl: intlShape,
  };

  render() {
    return (
      <div id="svgContainer">
        <svg id="chart" />
      </div>
    );
  }

  private getSvgContents() {
    const svg = document.getElementById('chart')!.cloneNode(true) as Element;
    svg.removeAttribute('transform');
    return new XMLSerializer().serializeToString(svg);
  }

  private async getSvgContentsWithInlinedImages() {
    const svg = document.getElementById('chart')!.cloneNode(true) as Element;
    svg.removeAttribute('transform');
    await inlineImages(svg);
    return new XMLSerializer().serializeToString(svg);
  }

  /** Shows the print dialog to print the currently displayed chart. */
  print() {
    const printWindow = document.createElement('iframe');
    printWindow.style.position = 'absolute';
    printWindow.style.top = '-1000px';
    printWindow.style.left = '-1000px';
    printWindow.onload = () => {
      printWindow.contentDocument!.open();
      printWindow.contentDocument!.write(this.getSvgContents());
      printWindow.contentDocument!.close();
      // Doesn't work on Firefox without the setTimeout.
      setTimeout(() => {
        printWindow.contentWindow!.focus();
        printWindow.contentWindow!.print();
        printWindow.parentNode!.removeChild(printWindow);
      }, 500);
    };
    document.body.appendChild(printWindow);
  }

  async downloadSvg() {
    const contents = await this.getSvgContentsWithInlinedImages();
    const blob = new Blob([contents], {type: 'image/svg+xml'});
    saveAs(blob, 'topola.svg');
  }

  private async drawOnCanvas(): Promise<HTMLCanvasElement> {
    const contents = await this.getSvgContentsWithInlinedImages();
    const blob = new Blob([contents], {type: 'image/svg+xml'});
    return await drawOnCanvas(await loadImage(blob));
  }

  async downloadPng() {
    const canvas = await this.drawOnCanvas();
    const blob = await canvasToBlob(canvas, 'image/png');
    saveAs(blob, 'topola.png');
  }

  async downloadPdf() {
    const canvas = await this.drawOnCanvas();
    const doc = new jsPDF({
      orientation: canvas.width > canvas.height ? 'l' : 'p',
      unit: 'pt',
      format: [canvas.width, canvas.height],
    });
    doc.addImage(canvas, 'PNG', 0, 0, canvas.width, canvas.height, 'NONE');
    doc.save('topola.pdf');
  }
}
