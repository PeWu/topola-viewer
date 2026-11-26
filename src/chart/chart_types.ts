import {ModelData} from 'topola/model';
import {ColorTarget} from 'topola/toolkit';
import {
  AllowedFont,
  ChartColors,
  Ids,
  Occupations,
  PlaceDisplay,
  Sex,
  Titles,
} from '../sidepanel/config/config';
import {IndiInfo} from '../util/gedcom_util';

export type {IndiInfo};

/** Supported chart types. */
export enum ChartType {
  Hourglass,
  Relatives,
  Donatso,
  Fancy,
  Transit,
}

export interface ChartProps {
  data: ModelData;
  selection: IndiInfo;
  chartType: ChartType;
  onSelection: (indiInfo: IndiInfo) => void;
  onDetailSelection: (indiInfo: IndiInfo) => void;
  freezeAnimation?: boolean;
  colors?: ChartColors;
  colorTarget?: ColorTarget;
  fontFamily?: AllowedFont;
  hideIds?: Ids;
  hideSex?: Sex;
  occupations?: Occupations;
  titles?: Titles;
  placeDisplay?: PlaceDisplay;
  placeCount?: number;
  /** Called once after the initial layout and SVG render completes. */
  onFirstRender?: () => void;
}
