import f3 from 'family-chart';
import {useEffect, useRef} from 'react';
import {IntlShape, useIntl} from 'react-intl';
import {IndiInfo, JsonFam, JsonGedcomData} from 'topola';
import {formatDateOrRange} from './util/date_util';
import {usePrevious} from './util/previous-hook';

export interface DonatsoChartProps {
  data: JsonGedcomData;
  selection: IndiInfo;
  onSelection: (indiInfo: IndiInfo) => void;
}

function getOtherSpouse(fam: JsonFam, indi: string) {
  return fam.husb === indi ? fam.wife : fam.husb;
}

function convertData(data: JsonGedcomData, intl: IntlShape) {
  const famMap = new Map<string, JsonFam>();
  data.fams.forEach((fam) => famMap.set(fam.id, fam));
  return data.indis.map((indi) => {
    const famc = famMap.get(indi.famc!);
    const fams = (indi.fams || [])
      .map((fam) => famMap.get(fam))
      .filter((fam): fam is JsonFam => fam !== undefined);
    const father = famc?.husb;
    const mother = famc?.wife;
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
        father,
        mother,
        spouses,
        children,
      },
    };
  });
}

class ChartWrapper {
  private store?: any;

  initializeChart(props: DonatsoChartProps, intl: IntlShape) {
    const data = convertData(props.data, intl);
    this.store = f3.createStore({
      data,
      main_id: props.selection.id,
    });
    const svg = f3.createSvg(document.querySelector('#dotatsoSvgContainer'));
    const card = f3.elements.Card({
      store: this.store,
      svg,
      card_display: [
        (i: any) =>
          `${i.data['first name'] || ''} ${i.data['last name'] || ''}`,
        (i: any) => `${i.data.birthday || ''}`,
      ],
      mini_tree: true,
      link_break: false,
      onCardClick: (e: any, d: any) =>
        props.onSelection({id: d.data.id, generation: 0}),
    });
    this.store.setOnUpdate((props: any) => {
      f3.view(this.store.getTree(), svg, card, props || {});
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
    } else {
      chartWrapper.current.updateChart(props, intl);
    }
  });

  return <div id="dotatsoSvgContainer"></div>;
}
