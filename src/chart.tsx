import * as d3 from 'd3';
import * as React from 'react';
import {
  JsonGedcomData,
  ChartHandle,
  IndiInfo,
  createChart,
  DetailedRenderer,
  HourglassChart,
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

export interface ChartProps {
  data: JsonGedcomData;
  selection: IndiInfo;
  onSelection: (indiInfo: IndiInfo) => void;
}

/** Component showing the genealogy chart and handling transition animations. */
export class Chart extends React.PureComponent<ChartProps, {}> {
  private chart?: ChartHandle;

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
        chartType: HourglassChart,
        renderer: DetailedRenderer,
        svgSelector: '#chart',
        indiCallback: (info) => this.props.onSelection(info),
        animate: true,
        updateSvgSize: false,
      });
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
    this.renderChart({initialRender: this.props.data !== prevProps.data});
  }

  render() {
    return (
      <div id="svgContainer">
        <svg id="chart" />
      </div>
    );
  }
}
