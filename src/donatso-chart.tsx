import {
  Datum,
  Store,
  TreeDatum,
  createStore,
  createSvg,
  elements,
  view,
} from 'family-chart';
import {useEffect, useRef} from 'react';
import {IntlShape, useIntl} from 'react-intl';
import {IndiInfo, JsonFam, JsonGedcomData} from 'topola';
import {formatDateOrRange} from './util/date_util';
import {usePrevious} from './util/previous-hook';

export interface DonatsoChartProps {
  data: JsonGedcomData;
  selection: IndiInfo;
  onSelection: (indiInfo: IndiInfo) => void;
  /** Called once after the initial chart render completes. */
  onFirstRender?: () => void;
}

function getOtherSpouse(fam: JsonFam, indi: string) {
  return fam.husb === indi ? fam.wife : fam.husb;
}

function convertData(data: JsonGedcomData, intl: IntlShape): Datum[] {
  const famMap = new Map<string, JsonFam>();
  data.fams.forEach((fam) => famMap.set(fam.id, fam));
  return data.indis.map((indi) => {
    const famc = (indi.famc && famMap.get(indi.famc)) || undefined;
    const fams = (indi.fams || [])
      .map((fam) => famMap.get(fam))
      .filter((fam): fam is JsonFam => fam !== undefined);
    const father = famc?.husb;
    const mother = famc?.wife;
    const parents = [father, mother].filter((x) => !!x);
    const spouses = fams
      .map((fam) => getOtherSpouse(fam, indi.id))
      .filter((indi): indi is string => indi !== undefined);
    const children = fams.flatMap((fam) => fam.children || []);

    return {
      id: indi.id,
      data: {
        'first name': indi.firstName,
        'last name': indi.lastName,
        birthday: formatDateOrRange(indi.birth, intl),
        avatar: indi.images?.[0]?.url,
        gender: indi.sex,
      },
      rels: {
        parents,
        spouses,
        children,
      },
    } as Datum;
  });
}

class ChartWrapper {
  private store!: Store;

  initializeChart(props: DonatsoChartProps, intl: IntlShape) {
    const data = convertData(props.data, intl);
    this.store = createStore({
      data,
      main_id: props.selection.id,
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const svg = createSvg(document.querySelector('#dotatsoSvgContainer')!);
    const card = elements.CardSvg({
      store: this.store,
      svg,
      card_display: [
        (i: Datum) =>
          `${i.data['first name'] || ''} ${i.data['last name'] || ''}`,
        (i: Datum) => `${i.data.birthday || ''}`,
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      mini_tree: true,
      link_break: false,
      onCardClick: (e: MouseEvent, d: TreeDatum) =>
        props.onSelection({id: d.data.id, generation: 0}),
      card_dim: {
        w: 220,
        h: 70,
        text_x: 75,
        text_y: 15,
        img_w: 60,
        img_h: 60,
        img_x: 5,
        img_y: 5,
      },
    });
    this.store.setOnUpdate((props: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      view(this.store.getTree()!, svg, card, props || {});
    });
    this.store.updateTree({initial: true});
  }

  updateChart(props: DonatsoChartProps, intl: IntlShape) {
    const data = convertData(props.data, intl);
    this.store.updateData(data);
    this.store.updateMainId(props.selection.id);
    this.store.updateTree();
  }
}

export function DonatsoChart(props: DonatsoChartProps) {
  const chartWrapper = useRef(new ChartWrapper());
  const prevProps = usePrevious(props);
  const intl = useIntl();

  useEffect(() => {
    if (!prevProps) {
      chartWrapper.current.initializeChart(props, intl);
      props.onFirstRender?.();
    } else {
      chartWrapper.current.updateChart(props, intl);
    }
  });

  return <div id="dotatsoSvgContainer"></div>;
}
