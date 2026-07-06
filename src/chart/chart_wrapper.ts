import {max, min} from 'd3-array';
import {interpolateNumber} from 'd3-interpolate';
import {BaseType, select, Selection} from 'd3-selection';
import 'd3-transition';
import {
  D3ZoomEvent,
  zoom,
  ZoomBehavior,
  ZoomedElementBaseType,
  zoomTransform,
} from 'd3-zoom';
import {IntlShape} from 'react-intl';
import {ChartHandle, ChartInfo, createChart} from 'topola';
import {
  chartColors,
  ChartProps,
  getChartType,
  getRendererType,
} from './chart_types';

/** How much to zoom when using the +/- buttons. */
const ZOOM_FACTOR = 1.3;

/**
 * Called when the view is dragged with the mouse.
 *
 * @param size the size of the chart
 */
function zoomed(
  size: [number, number],
  event: D3ZoomEvent<ZoomedElementBaseType, unknown>,
) {
  const parent = select('#svgContainer').node() as Element;

  const scale = event.transform.k;
  const offsetX = max([0, (parent.clientWidth - size[0] * scale) / 2]);
  const offsetY = max([0, (parent.clientHeight - size[1] * scale) / 2]);
  select('#chartSvg')
    .attr('width', size[0] * scale)
    .attr('height', size[1] * scale)
    .attr('transform', `translate(${offsetX}, ${offsetY})`);
  select('#chart').attr('transform', `scale(${scale})`);

  parent.scrollLeft = -event.transform.x;
  parent.scrollTop = -event.transform.y;
}

/** Called when the scrollbars are used. */
function scrolled() {
  const parent = select('#svgContainer').node() as Element;
  const x = parent.scrollLeft + parent.clientWidth / 2;
  const y = parent.scrollTop + parent.clientHeight / 2;
  const scale = zoomTransform(parent).k;
  select(parent).call(zoom().translateTo, x / scale, y / scale);
}

/** Returns the element's usable width and height by subtracting the assumed scrollbar size. */
function getScrollbarAwareSize(
  element: Element,
  scrollbarSize = 20,
): [number, number] {
  const htmlElement = element as HTMLElement;
  return [
    htmlElement.clientWidth - scrollbarSize,
    htmlElement.clientHeight - scrollbarSize,
  ];
}

/**
 * Calculates the allowed zoom scale range.
 * Sets the minimum scale so the chart cannot zoom out beyond full visibility,
 * and fixes the maximum scale at 2.
 */
function calculateScaleExtent(
  parent: Element,
  scale: number,
  chartInfo: ChartInfo,
): [number, number] {
  const [availWidth, availHeight] = getScrollbarAwareSize(parent);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const zoomOutFactor = min([
    1,
    scale,
    availWidth / chartInfo.size[0],
    availHeight / chartInfo.size[1],
  ])!;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return [max([0.1, zoomOutFactor])!, 2];
}

export class ChartWrapper {
  private chart?: ChartHandle;
  /** Animation is in progress. */
  private animating = false;
  /** Rendering is required after the current animation finishes. */
  private rerenderRequired = false;
  /** The d3 zoom behavior object. */
  private zoomBehavior?: ZoomBehavior<Element, unknown>;
  /** Props that will be used for rerendering. */
  private rerenderProps?: ChartProps;
  private rerenderResetPosition?: boolean;

  zoom(factor: number) {
    const parent = select('#svgContainer') as Selection<
      Element,
      unknown,
      BaseType,
      unknown
    >;
    this.zoomBehavior?.scaleBy(parent, factor);
  }

  /**
   * Renders the chart or performs a transition animation to a new state.
   * If indiInfo is not given, it means that it is the initial render and no
   * animation is performed.
   */
  renderChart(
    props: ChartProps,
    intl: IntlShape,
    args: {initialRender: boolean; resetPosition: boolean} = {
      initialRender: false,
      resetPosition: false,
    },
  ) {
    // Nothing changed — the SVG is already correct. Skip re-render.
    // This prevents repeated full D3 layout passes (500ms+ each) that happen
    // when React re-renders for unrelated state changes.
    if (!args.initialRender && !args.resetPosition) {
      return;
    }

    // Wait for animation to finish if animation is in progress.
    if (!args.initialRender && this.animating) {
      this.rerenderRequired = true;
      this.rerenderProps = props;
      this.rerenderResetPosition = args.resetPosition;
      return;
    }

    // Freeze changing selection after initial rendering.
    if (!args.initialRender && props.freezeAnimation) {
      return;
    }

    if (args.initialRender || !this.chart) {
      (select('#chart').node() as HTMLElement).innerHTML = '';
      this.chart = createChart({
        json: props.data,
        chartType: getChartType(props.chartType),
        renderer: getRendererType(props.chartType),
        svgSelector: '#chart',
        indiCallback: (info) => {
          // ths is called when an individual is selected in the chart
          if (info.modifiers?.shiftKey) {
            // If the shift key is pressed, we just update the details tab without changing the selection in the chart.
            // This allows users to quickly view details of multiple individuals without losing their place in the chart.
            props.onDetailSelection(info);
          } else {
            // If the shift key is not pressed, we update the selection in the chart as usual.
            props.onSelection(info);
          }
        },
        colors:
          props.colors !== undefined
            ? chartColors.get(props.colors)
            : undefined,
        animate: true,
        updateSvgSize: false,
        locale: intl.locale,
      });
    } else {
      this.chart.setData(props.data);
    }
    const chartInfo = this.chart.render({
      startIndi: props.selection.id,
      baseGeneration: props.selection.generation,
    });
    const svg = select('#chartSvg');
    const parent = select('#svgContainer').node() as Element;
    const scale = zoomTransform(parent).k;
    const extent: [number, number] = calculateScaleExtent(
      parent,
      scale,
      chartInfo,
    );

    this.zoomBehavior = zoom()
      .scaleExtent(extent)
      .translateExtent([[0, 0], chartInfo.size])
      .on('zoom', (event) => zoomed(chartInfo.size, event));

    select(parent).on('scroll', scrolled).call(this.zoomBehavior);

    const scrollTopTween = (scrollTop: number) => {
      return () => {
        const i = interpolateNumber(parent.scrollTop, scrollTop);
        return (t: number) => {
          parent.scrollTop = i(t);
        };
      };
    };
    const scrollLeftTween = (scrollLeft: number) => {
      return () => {
        const i = interpolateNumber(parent.scrollLeft, scrollLeft);
        return (t: number) => {
          parent.scrollLeft = i(t);
        };
      };
    };

    const dx = parent.clientWidth / 2 - chartInfo.origin[0] * scale;
    const dy = parent.clientHeight / 2 - chartInfo.origin[1] * scale;
    const offsetX = max([
      0,
      (parent.clientWidth - chartInfo.size[0] * scale) / 2,
    ]);
    const offsetY = max([
      0,
      (parent.clientHeight - chartInfo.size[1] * scale) / 2,
    ]);
    const svgTransition = svg.transition().delay(200).duration(500);
    const transition = args.initialRender ? svg : svgTransition;
    transition.attr('transform', `translate(${offsetX}, ${offsetY})`);
    transition.attr('width', chartInfo.size[0] * scale);
    transition.attr('height', chartInfo.size[1] * scale);
    if (args.resetPosition) {
      if (args.initialRender) {
        parent.scrollLeft = -dx;
        parent.scrollTop = -dy;
      } else {
        svgTransition
          .tween('scrollLeft', scrollLeftTween(-dx))
          .tween('scrollTop', scrollTopTween(-dy));
      }
    }

    // After the animation is finished, rerender the chart if required.
    this.animating = true;
    chartInfo.animationPromise.then(() => {
      this.animating = false;
      if (this.rerenderRequired) {
        this.rerenderRequired = false;
        // Use `this.rerenderProps` instead of the props in scope because
        // the props may have been updated in the meantime.
        if (this.rerenderProps) {
          this.renderChart(this.rerenderProps, intl, {
            initialRender: false,
            resetPosition: !!this.rerenderResetPosition,
          });
        } else {
          console.error(
            'Rerender required after animation, but rerenderProps was not set.',
          );
        }
      }
    });
  }
}

export {ZOOM_FACTOR};
