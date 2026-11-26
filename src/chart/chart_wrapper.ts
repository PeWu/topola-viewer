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
import {
  ANIMATION_FADE_MS,
  ANIMATION_MOVE_MS,
  ChartConfig,
  ClickInfo,
  createChart,
  LayoutResult,
  Slot,
  StyleScheme,
  Chart as TopolaChart,
  ViewState,
} from 'topola/core';
import {
  createModelGraph,
  ModelData,
  ModelGraph,
  PersonRecord,
} from 'topola/model';
import {
  createDetailedNodePlugin,
  createFancyConfig,
  DEFAULT_FANCY_THEME,
  FancyTheme,
  generationScheme,
  quayScheme,
  sexScheme,
} from 'topola/presets';
import {TextBoxTheme} from 'topola/toolkit';
import {PRIVATE_ID_PREFIX} from '../datasource/wikitree_api';
import {
  ChartColors,
  DEFAULT_FONT_FAMILY,
  ensureGoogleFontLoaded,
  getFontFamilyStack,
  Ids,
  Occupations,
  Sex,
  Titles,
} from '../sidepanel/config/config';
import {ChartProps, ChartType} from './chart_types';
import {createTransitConfig, TransitLabels, TransitTheme} from './transit_look';

/** How much to zoom when using the +/- buttons. */
const ZOOM_FACTOR = 1.3;

type ViewerChartTheme = TextBoxTheme & FancyTheme & TransitTheme;

function transitLabels(intl: IntlShape): TransitLabels {
  return {
    title: intl.formatMessage({
      id: 'transit.title',
      defaultMessage: 'Family transit map',
    }),
    zone: (relativeGeneration) =>
      intl.formatMessage(
        {id: 'transit.zone', defaultMessage: 'Zone {zone}'},
        {
          zone:
            relativeGeneration > 0
              ? `+${relativeGeneration}`
              : String(relativeGeneration).replace('-', '\u2212'),
        },
      ),
    person: intl.formatMessage({
      id: 'transit.person',
      defaultMessage: 'Person',
    }),
    marriage: intl.formatMessage({
      id: 'transit.marriage',
      defaultMessage: 'Marriage',
    }),
    otherMarriage: intl.formatMessage({
      id: 'transit.other_marriage',
      defaultMessage: 'Another marriage of the same person',
    }),
  };
}

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
  layout: Pick<LayoutResult, 'size'>,
): [number, number] {
  const [availWidth, availHeight] = getScrollbarAwareSize(parent);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const zoomOutFactor = min([
    1,
    scale,
    availWidth / layout.size[0],
    availHeight / layout.size[1],
  ])!;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return [max([0.1, zoomOutFactor])!, 2];
}

function buildSchemes(
  colors: ChartColors | undefined,
  graph: ModelGraph,
): StyleScheme[] {
  switch (colors) {
    case ChartColors.NO_COLOR:
      return [quayScheme(graph)];
    case ChartColors.COLOR_BY_SEX:
      return [sexScheme(graph), quayScheme(graph)];
    case ChartColors.COLOR_BY_GENERATION:
    default:
      return [generationScheme(), quayScheme(graph)];
  }
}

export class ChartWrapper {
  private chart?: TopolaChart<ViewerChartTheme>;
  /** The d3 zoom behavior object. */
  private zoomBehavior?: ZoomBehavior<Element, unknown>;
  private graph?: ModelGraph;
  private lastData?: ModelData;
  private lastChartType?: ChartType;
  private lastStartIndi?: string;
  private latestProps?: ChartProps;
  private collapsed = new Set<`${string}:${Slot}`>();
  /** Whether the next layout should scroll the start person into view. */
  private resetPositionOnLayout = false;

  /**
   * Keeps the viewport in step with the chart. The chart reports every layout
   * here, also the ones it starts itself, e.g. when its font has loaded.
   */
  private readonly handleLayout = (
    layout: LayoutResult,
    info: {animated: boolean},
  ) => {
    this.syncViewport(layout, {
      animate: info.animated,
      resetPosition: this.resetPositionOnLayout,
    });
    this.resetPositionOnLayout = false;
  };

  private viewState(props: ChartProps): ViewState {
    return {
      startIndi: props.selection.id,
      baseGeneration: props.selection.generation,
      collapsed: this.collapsed,
    };
  }

  zoom(factor: number) {
    const parent = select('#svgContainer') as Selection<
      Element,
      unknown,
      BaseType,
      unknown
    >;
    this.zoomBehavior?.scaleBy(parent, factor);
  }

  dispose() {
    this.chart?.dispose();
    this.chart = undefined;
  }

  private handlePersonClick = (info: ClickInfo) => {
    const props = this.latestProps;
    if (!props) {
      return;
    }
    const selection = {id: info.id, generation: info.generation};
    if (info.modifiers.shiftKey) {
      // Shift+click updates the details tab without changing the root selection in the chart.
      props.onDetailSelection(selection);
    } else {
      props.onSelection(selection);
    }
  };

  private handleExpanderClick = ({
    nodeId,
    slot,
  }: {
    nodeId: string;
    slot: Slot;
  }) => {
    if (!this.chart || !this.latestProps) {
      return;
    }
    const key: `${string}:${Slot}` = `${nodeId}:${slot}`;
    if (this.collapsed.has(key)) {
      this.collapsed.delete(key);
    } else {
      this.collapsed.add(key);
    }
    const shouldAnimate =
      !this.latestProps.freezeAnimation &&
      this.latestProps.chartType !== ChartType.Fancy;
    this.chart.patchConfig({animate: shouldAnimate});
    this.chart.update(this.viewState(this.latestProps));
  };

  /** In the transit map, clicking a marriage folds or unfolds its children. */
  private handleFamilyClick = (info: ClickInfo) => {
    this.handleExpanderClick({nodeId: info.nodeId, slot: 'children'});
  };

  private buildConfig(
    props: ChartProps,
    graph: ModelGraph,
    intl: IntlShape,
    animate: boolean,
  ): ChartConfig<ViewerChartTheme> {
    const locale = intl.locale;
    const fontFamily = getFontFamilyStack(
      props.fontFamily ?? DEFAULT_FONT_FAMILY,
    );
    const colorTarget = props.colorTarget ?? 'background';
    const schemes = buildSchemes(props.colors, graph);

    if (props.chartType === ChartType.Fancy) {
      const fancy = createFancyConfig({
        model: graph,
        schemes,
        animate: false,
        expanders: false,
        updateSvgSize: false,
        theme: {
          ...DEFAULT_FANCY_THEME,
          fontFamily,
          colorTarget,
        },
        onPersonClick: this.handlePersonClick,
        onLayout: this.handleLayout,
      });
      return fancy as ChartConfig<ViewerChartTheme>;
    }

    const hideId = (person: PersonRecord) =>
      props.hideIds === Ids.HIDE ||
      Boolean(person.hideId) ||
      person.id.startsWith(PRIVATE_ID_PREFIX);
    const hideSex = props.hideSex === Sex.HIDE;

    if (props.chartType === ChartType.Transit) {
      const transit = createTransitConfig({
        graph,
        locale,
        labels: transitLabels(intl),
        schemes,
        coloredLines: props.colors !== ChartColors.NO_COLOR,
        fontFamily,
        colorTarget,
        hideId,
        hideSex,
        animate,
        onPersonClick: this.handlePersonClick,
        onFamilyClick: this.handleFamilyClick,
        onExpanderClick: this.handleExpanderClick,
        onLayout: this.handleLayout,
      });
      return transit as ChartConfig<ViewerChartTheme>;
    }

    const nodePlugin = createDetailedNodePlugin({
      model: graph,
      locale,
      hideId,
      hideSex,
      showOccupations: props.occupations === Occupations.SHOW,
      showTitles: props.titles === Titles.SHOW,
    });

    return {
      graph,
      chart:
        props.chartType === ChartType.Relatives ? 'relatives' : 'hourglass',
      direction: 'down',
      expanders: true,
      animate,
      updateSvgSize: false,
      nodePlugin,
      schemes,
      theme: {
        fontFamily,
        colorTarget,
        generationSpacing: 34,
      },
      onPersonClick: this.handlePersonClick,
      onExpanderClick: this.handleExpanderClick,
      onLayout: this.handleLayout,
    };
  }

  private syncViewport(
    layout: LayoutResult,
    options: {animate: boolean; resetPosition: boolean},
  ) {
    const svg = select('#chartSvg');
    const parent = select('#svgContainer').node() as Element | null;
    if (!parent) {
      return;
    }
    const scale = zoomTransform(parent).k;
    const extent: [number, number] = calculateScaleExtent(
      parent,
      scale,
      layout,
    );

    this.zoomBehavior = zoom()
      .scaleExtent(extent)
      .translateExtent([[0, 0], layout.size])
      .on('zoom', (event) => zoomed(layout.size, event));

    select(parent).on('scroll', scrolled).call(this.zoomBehavior);

    const scrollTopTween = (scrollTop: number) => () => {
      const i = interpolateNumber(parent.scrollTop, scrollTop);
      return (t: number) => {
        parent.scrollTop = i(t);
      };
    };
    const scrollLeftTween = (scrollLeft: number) => () => {
      const i = interpolateNumber(parent.scrollLeft, scrollLeft);
      return (t: number) => {
        parent.scrollLeft = i(t);
      };
    };

    const dx = parent.clientWidth / 2 - layout.origin[0] * scale;
    const dy = parent.clientHeight / 2 - layout.origin[1] * scale;
    const offsetX = max([0, (parent.clientWidth - layout.size[0] * scale) / 2]);
    const offsetY = max([
      0,
      (parent.clientHeight - layout.size[1] * scale) / 2,
    ]);

    // Interrupt any in-flight viewport transition so rapid clicks stay synchronized.
    svg.interrupt();

    if (options.animate) {
      const svgTransition = svg
        .transition()
        .delay(ANIMATION_FADE_MS)
        .duration(ANIMATION_MOVE_MS);
      svgTransition
        .attr('transform', `translate(${offsetX}, ${offsetY})`)
        .attr('width', layout.size[0] * scale)
        .attr('height', layout.size[1] * scale);
      if (options.resetPosition) {
        svgTransition
          .tween('scrollLeft', scrollLeftTween(-dx))
          .tween('scrollTop', scrollTopTween(-dy));
      }
    } else {
      svg
        .attr('transform', `translate(${offsetX}, ${offsetY})`)
        .attr('width', layout.size[0] * scale)
        .attr('height', layout.size[1] * scale);
      if (options.resetPosition) {
        parent.scrollLeft = -dx;
        parent.scrollTop = -dy;
      }
    }
  }

  /**
   * Renders the chart or performs a transition animation to a new state,
   * retaining a single Topola 4 `Chart` instance across config toggles.
   */
  renderChart(
    props: ChartProps,
    intl: IntlShape,
    args: {initialRender: boolean; resetPosition: boolean} = {
      initialRender: false,
      resetPosition: false,
    },
  ) {
    this.latestProps = props;

    // Nothing changed — the SVG is already correct. Skip re-render.
    if (!args.initialRender && !args.resetPosition) {
      return;
    }

    // Freeze changing selection after initial rendering.
    if (this.chart && !args.initialRender && props.freezeAnimation) {
      return;
    }

    ensureGoogleFontLoaded(props.fontFamily ?? DEFAULT_FONT_FAMILY);

    if (!this.graph || this.lastData !== props.data) {
      this.graph = createModelGraph(props.data);
      this.lastData = props.data;
    }

    if (
      this.lastChartType !== props.chartType ||
      this.lastStartIndi !== props.selection.id
    ) {
      this.collapsed.clear();
      this.lastChartType = props.chartType;
      this.lastStartIndi = props.selection.id;
    }

    const isFirstMount = !this.chart;
    const shouldAnimate =
      !isFirstMount &&
      !args.initialRender &&
      props.chartType !== ChartType.Fancy;

    // The viewport follows from handleLayout.
    this.resetPositionOnLayout = args.resetPosition;
    const viewState = this.viewState(props);
    let chart = this.chart;
    if (!chart) {
      const containerNode = select('#chart').node() as HTMLElement | null;
      if (containerNode) {
        containerNode.innerHTML = '';
      }
      chart = createChart<ViewerChartTheme>({
        svg: '#chart',
        config: this.buildConfig(props, this.graph, intl, false),
      });
      this.chart = chart;
      chart.update(viewState);
    } else if (args.initialRender) {
      // A different look or different data: nothing of the old config stays.
      chart.setConfig(
        this.buildConfig(props, this.graph, intl, false),
        viewState,
      );
    } else {
      chart.patchConfig({animate: shouldAnimate});
      chart.update(viewState);
    }

    if (props.chartType !== ChartType.Fancy) {
      chart.patchConfig({animate: true});
    }
  }
}

export {ZOOM_FACTOR};
