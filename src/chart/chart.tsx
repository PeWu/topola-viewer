import {useEffect, useMemo, useRef} from 'react';
import {useIntl} from 'react-intl';
import {JsonGedcomData, propagateConfidence} from 'topola';
import {Confidence, PlaceDisplay} from '../sidepanel/config/config';
import {Media} from '../util/media';
import {DEFAULT_PLACE_DISPLAY_COUNT, shortenPlace} from '../util/place_util';
import {usePrevious} from '../util/previous-hook';
import {ChartProps} from './chart_types';
import {ChartWrapper, ZOOM_FACTOR} from './chart_wrapper';

/** Removes QUAY confidence values so the chart shows no source quality. */
function removeConfidence(data: JsonGedcomData): JsonGedcomData {
  const strip = <T extends {confidence?: number}>(item: T): T => {
    if (item.confidence === undefined) {
      return item;
    }
    const {confidence: _, ...rest} = item;
    if ('parentLinkConfidence' in rest) {
      delete rest.parentLinkConfidence;
    }
    return rest as T;
  };
  const stripEvent = <T extends {confidence?: number}>(item?: T) =>
    item && strip(item);
  return {
    ...data,
    indis: data.indis.map((indi) => ({
      ...strip(indi),
      birth: stripEvent(indi.birth),
      death: stripEvent(indi.death),
    })),
    fams: data.fams.map((fam) => ({
      ...fam,
      marriage: stripEvent(fam.marriage),
    })),
  };
}

export function Chart(props: ChartProps) {
  const chartWrapper = useRef(new ChartWrapper());
  const prevProps = usePrevious(props);
  const intl = useIntl();

  const placeDisplay = props.placeDisplay ?? PlaceDisplay.FULL;
  const placeCount = props.placeCount ?? DEFAULT_PLACE_DISPLAY_COUNT;

  const confidence = props.confidence ?? Confidence.SHOW;
  // Propagated confidence depends on who is selected.
  const confidenceStart =
    confidence === Confidence.PROPAGATE ? props.selection.id : undefined;

  const confidenceData = useMemo(() => {
    if (confidence === Confidence.HIDE) {
      return removeConfidence(props.data);
    }
    if (confidenceStart !== undefined) {
      return propagateConfidence(props.data, confidenceStart);
    }
    return props.data;
  }, [props.data, confidence, confidenceStart]);

  const processedData = useMemo(() => {
    if (placeDisplay === PlaceDisplay.FULL) {
      return confidenceData;
    }
    const data = confidenceData;
    return {
      ...data,
      indis: data.indis.map((indi) => ({
        ...indi,
        birth: indi.birth
          ? {
              ...indi.birth,
              place: shortenPlace(indi.birth.place, placeDisplay, placeCount),
            }
          : undefined,
        death: indi.death
          ? {
              ...indi.death,
              place: shortenPlace(indi.death.place, placeDisplay, placeCount),
            }
          : undefined,
      })),
      fams: data.fams.map((fam) => ({
        ...fam,
        marriage: fam.marriage
          ? {
              ...fam.marriage,
              place: shortenPlace(fam.marriage.place, placeDisplay, placeCount),
            }
          : undefined,
      })),
    };
  }, [confidenceData, placeDisplay, placeCount]);

  useEffect(() => {
    const propsWithProcessedData: ChartProps = {...props, data: processedData};
    if (prevProps) {
      const initialRender =
        props.chartType !== prevProps?.chartType ||
        props.colors !== prevProps?.colors ||
        props.hideIds !== prevProps?.hideIds ||
        props.hideSex !== prevProps?.hideSex ||
        props.placeDisplay !== prevProps?.placeDisplay ||
        props.placeCount !== prevProps?.placeCount ||
        props.confidence !== prevProps?.confidence;
      const resetPosition =
        props.chartType !== prevProps?.chartType ||
        props.data !== prevProps.data ||
        // This does not work as the objects are always different instances.
        //props.selection !== prevProps.selection;
        // Therefore, compare id and generation instead.
        props.selection.id !== prevProps.selection.id ||
        props.selection.generation !== prevProps.selection.generation;
      chartWrapper.current.renderChart(propsWithProcessedData, intl, {
        initialRender,
        resetPosition,
      });
    } else {
      chartWrapper.current.renderChart(propsWithProcessedData, intl, {
        initialRender: true,
        resetPosition: true,
      });
      // Clear the loading pill now that the chart SVG is in the DOM.
      // This fires before the D3 fade-in animation completes (~400ms), which
      // is intentional: the chart is visible and interactive at this point,
      // and keeping the pill visible during the animation would create a
      // confusing overlap.
      props.onFirstRender?.();
    }
  });

  return (
    <div id="svgContainer">
      <Media greaterThanOrEqual="large" className="zoom">
        <button
          className="zoom-in"
          onClick={() => chartWrapper.current.zoom(ZOOM_FACTOR)}
        >
          +
        </button>
        <button
          className="zoom-out"
          onClick={() => chartWrapper.current.zoom(1 / ZOOM_FACTOR)}
        >
          −
        </button>
      </Media>
      <svg id="chartSvg">
        <g id="chart" data-testid="chart" />
      </svg>
    </div>
  );
}
