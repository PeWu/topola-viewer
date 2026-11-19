/**
 * "Transit map" look: the family tree drawn as a metro map.
 *
 * People are stations, marriages are interchanges, every family is a coloured
 * line running left to right through generation "zones", and another marriage
 * of the same person is a dotted walking transfer.
 *
 * The look lives in the viewer on purpose. It is built only from the public
 * extension points of the `topola` library and touches each of them:
 *
 *  - node plug-in: a hand-drawn `BoxPlugin` (station, drawn and resized from
 *    box parts) and a `createTextBox` content function (interchange), paired
 *    by `createCoupleAssembler`,
 *  - layers: one in each slot (`back`, `links`, `front`), using `getBounds`,
 *    `getCss`, `defaultTheme`, `svgDefs`, the text measurer, the link router
 *    and the animation helpers,
 *  - style scheme: a palette plus person, family and link classifiers and
 *    scoped CSS, combined with the built-in schemes,
 *  - theme: core fields, text box fields and fields of its own,
 *  - `overrideCss`, a horizontal `direction`, expanders and all three click
 *    callbacks.
 */
import {
  AnimationHelpers,
  BoundingBox,
  ChartConfig,
  ClickInfo,
  createLinkRouter,
  FontSpec,
  isHorizontalDirection,
  Layer,
  LayoutLink,
  LayoutResult,
  normalizeMargin,
  Point,
  Slot,
  StyleScheme,
  TextMeasurer,
  TwoToneColor,
} from 'topola/core';
import {
  DateOrRange,
  formatDateOrRange,
  ModelGraph,
  PersonRecord,
} from 'topola/model';
import {
  BoxPart,
  BoxPlugin,
  ColorTarget,
  createCoupleAssembler,
  createTextBox,
  drawBoxParts,
  FamilyBoxContext,
  paletteCss,
  PersonBoxContext,
  resizeBoxParts,
  TextBoxSpecificTheme,
  TextBoxTheme,
} from 'topola/toolkit';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Theme fields specific to the transit look. */
export interface TransitSpecificTheme {
  paperColor: string;
  zoneColor: string;
  gridColor: string;
  inkColor: string;
  mutedInkColor: string;
  stationFill: string;
  /** Radius of the bends of the lines. */
  lineCornerRadius: number;
}

export type TransitTheme = TextBoxTheme & TransitSpecificTheme;

/** Defaults of the fields above, declared by the plug-in and the layers. */
const TRANSIT_DEFAULTS: TransitSpecificTheme = {
  paperColor: '#f6f3ea',
  zoneColor: '#ece7d9',
  gridColor: '#cfc8b4',
  inkColor: '#1d2733',
  mutedInkColor: '#5b6470',
  stationFill: '#ffffff',
  lineCornerRadius: 14,
};

/** What the look changes in the core theme. */
const TRANSIT_CORE_THEME: Partial<TransitTheme> = {
  siblingSpacing: 14,
  generationSpacing: 64,
  margin: {top: 16, right: 28, bottom: 16, left: 28},
  linkColor: '#5b6470',
  linkStrokeWidth: 5,
  additionalMarriageDash: '1 6',
};

/** Paint-only tweak of the built-in expanders: round and ink-coloured. */
const TRANSIT_OVERRIDE_CSS = [
  '{scope} .expander { stroke: #1d2733; }',
  '{scope} .expander rect { rx: 6px; ry: 6px; }',
].join('\n');

/** Texts shown on the map, already translated. */
export interface TransitLabels {
  title: string;
  /** Label of a generation column; 0 is the generation of the start person. */
  zone: (relativeGeneration: number) => string;
  person: string;
  marriage: string;
  otherMarriage: string;
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  parent: Element,
  tag: K,
  attrs: Record<string, string | number> = {},
  text?: string,
): SVGElementTagNameMap[K] {
  const el = parent.ownerDocument.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, String(value));
  }
  if (text !== undefined) {
    el.textContent = text;
  }
  parent.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Station: a person, drawn by a hand-written BoxPlugin.
// ---------------------------------------------------------------------------

const STATION_HEIGHT = 48;
const STATION_MIN_WIDTH = 124;
const STATION_RING_X = 18;
const STATION_TEXT_X = 35;
const STATION_PAD_RIGHT = 14;
/** Width of the lifespan gauge; a full gauge is 100 years. */
const GAUGE_WIDTH = 60;

const SEX_SYMBOLS: Readonly<Record<string, string>> = {
  F: '\u2640',
  M: '\u2642',
};

interface StationContent {
  name: string;
  details: string;
  id: string;
  age: number | undefined;
}

function eventYear(event: DateOrRange | undefined): number | undefined {
  return (
    event?.date?.year ??
    event?.dateRange?.from?.year ??
    event?.dateRange?.to?.year
  );
}

function createStationBox(options: {
  graph: ModelGraph;
  hideId: (person: PersonRecord) => boolean;
  hideSex: boolean;
}): BoxPlugin<PersonBoxContext, TransitTheme> {
  const {graph, hideId, hideSex} = options;

  const describe = (personId: string): StationContent => {
    const person = graph.getPerson(personId);
    const name =
      [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim() ||
      '?';
    const born = eventYear(person?.birth);
    const died = eventYear(person?.death);
    let years = '';
    if (born !== undefined && died !== undefined) {
      years = `${born} \u2013 ${died}`;
    } else if (born !== undefined) {
      years = `* ${born}`;
    } else if (died !== undefined || person?.death?.confirmed) {
      years = `\u2020 ${died ?? ''}`.trim();
    }
    const sex = hideSex ? undefined : SEX_SYMBOLS[person?.sex ?? ''];
    return {
      name,
      details: [sex, years].filter(Boolean).join(' '),
      id: person && hideId(person) ? '' : personId,
      age:
        born !== undefined && died !== undefined && died >= born
          ? died - born
          : undefined,
    };
  };

  /**
   * The elements of a station as a function of its size, so that a station
   * can be resized without drawing it again.
   */
  const stationParts = (
    personId: string,
    width: number,
    height: number,
  ): BoxPart[] => {
    const content = describe(personId);
    const cy = height / 2;
    const parts: BoxPart[] = [];
    // underlay, background and frame are the standard names of box parts
    // (BOX_PART_CLASSES), so schemes such as quayScheme apply here too.
    for (const cls of ['underlay', 'background', 'frame']) {
      parts.push({
        tag: 'rect',
        fixed: {class: cls, x: 1, height: 42, rx: 13},
        sized: {y: cy - 21, width: width - 2},
      });
    }
    parts.push(
      {
        tag: 'circle',
        fixed: {class: 'station-halo', cx: STATION_RING_X, r: 12.5},
        sized: {cy},
      },
      {
        tag: 'circle',
        fixed: {class: 'station-ring', cx: STATION_RING_X, r: 7},
        sized: {cy},
      },
      {
        tag: 'text',
        fixed: {class: 'station-name', x: STATION_TEXT_X},
        sized: {y: cy - 4},
        text: content.name,
      },
    );
    if (content.details) {
      parts.push({
        tag: 'text',
        fixed: {class: 'station-details', x: STATION_TEXT_X},
        sized: {y: cy + 8},
        text: content.details,
      });
    }
    if (content.id) {
      parts.push({
        tag: 'text',
        fixed: {class: 'station-id', 'text-anchor': 'end'},
        sized: {x: width - STATION_PAD_RIGHT, y: cy + 8},
        text: content.id,
      });
    }
    if (content.age !== undefined) {
      const gauge = {x: STATION_TEXT_X, height: 3, rx: 1.5};
      parts.push(
        {
          tag: 'rect',
          fixed: {...gauge, class: 'life-track', width: GAUGE_WIDTH},
          sized: {y: cy + 12.5},
        },
        {
          tag: 'rect',
          fixed: {
            ...gauge,
            class: 'life-bar',
            width: (GAUGE_WIDTH * Math.min(content.age, 100)) / 100,
          },
          sized: {y: cy + 12.5},
        },
        {
          tag: 'text',
          fixed: {
            class: 'station-age',
            x: STATION_TEXT_X + GAUGE_WIDTH + 5,
          },
          sized: {y: cy + 17},
          text: String(content.age),
        },
      );
    }
    return parts;
  };

  return {
    namespace: 'transit-station',
    defaultTheme: {},

    getCss(scope, theme, schemes) {
      const ns = `${scope} .transit-station`;
      const rules = [
        `${ns} text { font-family: ${theme.fontFamily}; fill: ${theme.inkColor}; }`,
        `${ns} .underlay { fill: ${theme.stationFill}; stroke: none; }`,
        `${ns} .background { fill: ${theme.stationFill}; stroke: none; }`,
        `${ns} .frame { fill: none; stroke: ${theme.inkColor}; stroke-width: 1.5px; }`,
        `${ns} .station-ring { fill: ${theme.stationFill}; stroke: ${theme.inkColor}; stroke-width: 4px; }`,
        `${ns} .station-halo { fill: none; stroke: ${theme.inkColor}; stroke-width: 1.5px; stroke-opacity: 0; }`,
        `${ns} .station-name { font-size: 13px; font-weight: bold; }`,
        `${ns} .station-details { font-size: 10px; fill: ${theme.mutedInkColor}; }`,
        `${ns} .station-id { font-size: 9px; font-style: italic; fill: ${theme.mutedInkColor}; }`,
        `${ns} .station-age { font-size: 8px; fill: ${theme.mutedInkColor}; }`,
        `${ns} .life-track { fill: ${theme.gridColor}; }`,
        `${ns} .life-bar { fill: ${theme.inkColor}; }`,
      ];
      // The accent of a scheme always colours the station marker...
      for (const scheme of schemes) {
        for (const [token, color] of Object.entries(scheme.palette ?? {})) {
          const variant = `${ns} .${token}`;
          rules.push(
            `${variant} .station-ring { stroke: ${color.accent}; }`,
            `${variant} .station-halo { stroke: ${color.accent}; }`,
            `${variant} .life-bar { fill: ${color.accent}; }`,
          );
        }
      }
      // ...and the theme's colorTarget says where the rest of the colour goes.
      rules.push(
        ...paletteCss({
          prefix: ns,
          schemes,
          colorTarget: theme.colorTarget,
          parts: {name: '.station-name'},
        }),
      );
      return rules.join('\n');
    },

    measureBox({personId}, {theme, measurer}) {
      const content = describe(personId);
      const width = (text: string, font: Omit<FontSpec, 'fontFamily'>) =>
        text
          ? measurer.measureWidth(text, {fontFamily: theme.fontFamily, ...font})
          : 0;
      const idWidth = content.id
        ? width(content.id, {fontSize: 9, fontStyle: 'italic'}) + 10
        : 0;
      const textWidth = Math.max(
        width(content.name, {fontSize: 13, fontWeight: 'bold'}),
        width(content.details, {fontSize: 10}) + idWidth,
        content.age !== undefined ? GAUGE_WIDTH + 20 : 0,
      );
      return {
        width: Math.max(
          STATION_MIN_WIDTH,
          Math.ceil(STATION_TEXT_X + textWidth + STATION_PAD_RIGHT),
        ),
        height: STATION_HEIGHT,
      };
    },

    drawBox(group, {personId}, width, height) {
      drawBoxParts(group, stationParts(personId, width, height));
    },

    resizeBox(group, {personId}, width, height, {animation}) {
      const parts = stationParts(personId, width, height);
      if (!resizeBoxParts(group, parts, animation)) {
        while (group.firstChild) {
          group.removeChild(group.firstChild);
        }
        drawBoxParts(group, parts);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Interchange: a marriage, drawn by the toolkit text box from a content
// function.
// ---------------------------------------------------------------------------

const INTERCHANGE_BOX_THEME: TextBoxSpecificTheme = {
  colorTarget: 'background',
  boxFill: '#ffffff',
  boxStroke: '#1d2733',
  boxStrokeWidth: 2,
  underlayFill: '#ffffff',
  textColor: '#1d2733',
  cornerRadius: 10,
  minWidth: 0,
  minHeight: 0,
  padding: {top: 3, right: 8, bottom: 3, left: 6},
  symbolColumnWidth: 14,
  badgeGap: 0,
  imageWidth: 0,
  imageMinHeight: 0,
  roles: {
    details: {fontSize: 10, fontWeight: 'bold', lineHeight: 14},
  },
};

function createInterchangeBox(graph: ModelGraph, locale: string) {
  return createTextBox<FamilyBoxContext, TransitTheme>({
    namespace: 'transit-interchange',
    defaultTheme: INTERCHANGE_BOX_THEME,
    suppressWhenEmpty: true,
    content: ({familyId}) => {
      const marriage = graph.getFamily(familyId)?.marriage;
      if (!marriage) {
        return null;
      }
      const year = eventYear(marriage);
      const text =
        year !== undefined ? String(year) : formatDateOrRange(marriage, locale);
      return {symbolLines: [{role: 'details', symbol: '\u26AD', text}]};
    },
  });
}

// ---------------------------------------------------------------------------
// Style scheme: every family is a line with its own colour.
// ---------------------------------------------------------------------------

const LINE_COLORS: readonly TwoToneColor[] = [
  {fill: '#fde3e8', accent: '#e4002b'},
  {fill: '#dfeaf8', accent: '#0057b8'},
  {fill: '#dcf1e5', accent: '#00843d'},
  {fill: '#fdeed6', accent: '#f28c00'},
  {fill: '#f0e2f4', accent: '#7b2d8e'},
  {fill: '#d9f3f4', accent: '#00a3ad'},
  {fill: '#efe5dc', accent: '#8b5e3c'},
  {fill: '#fbdcec', accent: '#d6006e'},
];

/** Returns the same line for a family every time, so colours never jump. */
function lineToken(familyId: string | undefined): string | undefined {
  if (!familyId) {
    return undefined;
  }
  let hash = 0;
  for (let i = 0; i < familyId.length; i++) {
    hash = (hash * 31 + familyId.charCodeAt(i)) >>> 0;
  }
  return `line-${hash % LINE_COLORS.length}`;
}

/**
 * Colours every family as a line: its interchange and the lines running from
 * it to the children. Also marks the start person as "you are here".
 *
 * With `colored: false` only the "you are here" mark remains.
 */
export function transitLineScheme(
  graph: ModelGraph,
  options: {colored: boolean},
): StyleScheme {
  const {colored} = options;
  return {
    id: 'transit-line',
    ...(colored
      ? {
          palette: Object.fromEntries(
            LINE_COLORS.map((color, i) => [`line-${i}`, color]),
          ),
        }
      : {}),
    classifyPerson: ({personId, viewState}) =>
      personId === viewState.startIndi ? 'you-are-here' : undefined,
    classifyFamily: ({familyId}) => (colored ? lineToken(familyId) : undefined),
    classifyLink: ({link}) =>
      colored && link.kind === 'parentChild' && link.childIndiId
        ? lineToken(graph.getPerson(link.childIndiId)?.famc)
        : undefined,
    getCss(scope) {
      const rules = [
        `${scope} .you-are-here .station-halo { stroke-opacity: 1; }`,
        `${scope} .you-are-here .frame { stroke-width: 2.5px; }`,
      ];
      if (colored) {
        LINE_COLORS.forEach((color, i) => {
          rules.push(
            `${scope} .transit-line.line-${i} { stroke: ${color.accent}; }`,
            `${scope} .transit-interchange .line-${i} .frame { stroke: ${color.accent}; }`,
          );
        });
      }
      return rules.join('\n');
    },
  };
}

// ---------------------------------------------------------------------------
// Layers.
// ---------------------------------------------------------------------------

/**
 * Replaces the artwork of a layer. When the chart animates, the old artwork
 * fades out and the new artwork fades in once the nodes have arrived.
 */
function redraw(
  group: SVGGElement,
  animation: AnimationHelpers,
  build: (artwork: SVGGElement) => void,
): void {
  for (const old of Array.from(
    group.querySelectorAll<SVGElement>(':scope > g.transit-artwork'),
  )) {
    old.setAttribute('class', 'transit-leaving');
    animation.disappear(old);
  }
  const fresh = svgEl(group, 'g', {class: 'transit-artwork'});
  build(fresh);
  animation.appear(fresh);
}

interface GenerationColumn {
  generation: number;
  start: number;
  end: number;
}

/**
 * Returns the horizontal extent of every generation, left to right, or an
 * empty list if generations do not form separate columns.
 */
function generationColumns(
  layout: Pick<LayoutResult, 'nodes' | 'direction'>,
): GenerationColumn[] {
  if (!isHorizontalDirection(layout.direction)) {
    return [];
  }
  const byGeneration = new Map<number, GenerationColumn>();
  for (const node of layout.nodes) {
    const start = node.x + node.bounds.x;
    const end = start + node.bounds.width;
    const column = byGeneration.get(node.generation);
    if (column) {
      column.start = Math.min(column.start, start);
      column.end = Math.max(column.end, end);
    } else {
      byGeneration.set(node.generation, {
        generation: node.generation,
        start,
        end,
      });
    }
  }
  const columns = Array.from(byGeneration.values()).sort(
    (a, b) => a.start - b.start,
  );
  const separate = columns.every(
    (column, i) => i === 0 || columns[i - 1].end <= column.start,
  );
  return separate ? columns : [];
}

/** Back layer: the sheet of the map with a dot grid and generation zones. */
function createPaperLayer(): Layer<TransitTheme> {
  return {
    id: 'transit-paper',
    slot: 'back',
    defaultTheme: TRANSIT_DEFAULTS,

    getCss(scope, theme) {
      return [
        `${scope} .transit-paper { fill: ${theme.paperColor}; }`,
        `${scope} .transit-zone { fill: ${theme.zoneColor}; }`,
        `${scope} .transit-zone-line { stroke: ${theme.gridColor}; stroke-width: 1px; stroke-dasharray: 2 6; }`,
      ].join('\n');
    },

    render({group, svgDefs, instanceId, layout, theme, animation}) {
      const [width, height] = layout.size;
      const left = -layout.origin[0];
      const top = -layout.origin[1];
      const geometry = {x: left, y: top, width, height};

      // The id of the pattern must be unique in the document.
      const patternId = `topola-transit-grid-${instanceId}`;
      if (!svgDefs.querySelector(`#${patternId}`)) {
        const pattern = svgEl(svgDefs, 'pattern', {
          id: patternId,
          width: 16,
          height: 16,
          patternUnits: 'userSpaceOnUse',
        });
        svgEl(pattern, 'circle', {cx: 2, cy: 2, r: 0.9, fill: theme.gridColor});
      }

      // The sheet stays in place and resizes together with the chart.
      if (!group.querySelector(':scope > rect.transit-sheet')) {
        svgEl(group, 'rect', {
          ...geometry,
          class: 'transit-sheet transit-paper',
        });
        svgEl(group, 'rect', {
          ...geometry,
          class: 'transit-sheet',
          fill: `url(#${patternId})`,
        });
      }
      for (const sheet of Array.from(
        group.querySelectorAll<SVGElement>(':scope > rect.transit-sheet'),
      )) {
        animation.move(sheet, geometry);
      }

      redraw(group, animation, (artwork) => {
        const columns = generationColumns(layout);
        columns.forEach((column, i) => {
          const start =
            i === 0 ? left : (columns[i - 1].end + column.start) / 2;
          const end =
            i === columns.length - 1
              ? left + width
              : (column.end + columns[i + 1].start) / 2;
          // Shade by generation, not by position, so that a zone keeps its
          // shade when the start person changes.
          if (Math.abs(column.generation) % 2 === 1) {
            svgEl(artwork, 'rect', {
              class: 'transit-zone',
              x: start,
              y: top,
              width: end - start,
              height,
            });
          }
          if (i > 0) {
            svgEl(artwork, 'line', {
              class: 'transit-zone-line',
              x1: start,
              y1: top,
              x2: start,
              y2: top + height,
            });
          }
        });
      });
    },
  };
}

/** A line through the points of a route with its corners rounded. */
function roundedPath(route: readonly Point[], radius: number): string {
  if (route.length === 0) {
    return '';
  }
  // A straight line gets each of its ends twice. So every line has four
  // points and can morph when its route changes between straight and stepped.
  const points =
    route.length === 2 ? [route[0], route[0], route[1], route[1]] : route;
  // The point at a distance from `from` on the way to `to`.
  const towards = (from: Point, to: Point, distance: number): string => {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const share = length === 0 ? 0 : distance / length;
    return `${from.x + (to.x - from.x) * share} ${from.y + (to.y - from.y) * share}`;
  };
  const parts = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length - 1; i++) {
    const [before, corner, after] = [points[i - 1], points[i], points[i + 1]];
    const r = Math.min(
      radius,
      Math.hypot(corner.x - before.x, corner.y - before.y) / 2,
      Math.hypot(after.x - corner.x, after.y - corner.y) / 2,
    );
    // Always the same commands, so that paths can be interpolated.
    parts.push(
      `L ${towards(corner, before, r)}`,
      `Q ${corner.x} ${corner.y} ${towards(corner, after, r)}`,
    );
  }
  const last = points[points.length - 1];
  parts.push(`L ${last.x} ${last.y}`);
  return parts.join(' ');
}

/**
 * Links layer: thick lines with rounded bends instead of the default elbows,
 * and dotted transfers between marriages of the same person. The routes are
 * those of the default link layer; only the style is different.
 */
function createLinesLayer(): Layer<TransitTheme> {
  return {
    id: 'transit-lines',
    slot: 'links',
    defaultTheme: TRANSIT_DEFAULTS,

    getCss(scope, theme) {
      // Colour, width and the transfer dashes come from the core theme
      // (linkColor, linkStrokeWidth, additionalMarriageDash).
      return [
        `${scope} .transit-line { stroke-linecap: round; stroke-linejoin: round; }`,
        `${scope} .transit-line.transfer { stroke: ${theme.inkColor}; stroke-width: 2px; }`,
      ].join('\n');
    },

    render({group, layout, theme, schemes, viewState, animation}) {
      const route = createLinkRouter(layout, theme);
      const pathOf = (link: LayoutLink): string =>
        roundedPath(
          route(link),
          link.kind === 'additionalMarriage' ? 0 : theme.lineCornerRadius,
        );
      const classOf = (link: LayoutLink): string =>
        [
          'link transit-line',
          ...(link.kind === 'additionalMarriage'
            ? ['additional-marriage transfer']
            : []),
          ...schemes.flatMap(
            (scheme) => scheme.classifyLink?.({link, viewState}) ?? [],
          ),
        ].join(' ');

      const lines = new Map<string | null, SVGElement>();
      for (const line of Array.from(
        group.querySelectorAll<SVGElement>(
          'path.transit-line:not([data-leaving])',
        ),
      )) {
        lines.set(line.getAttribute('data-link'), line);
      }
      for (const link of layout.links) {
        const line = lines.get(link.id);
        if (line) {
          lines.delete(link.id);
          line.setAttribute('class', classOf(link));
          animation.move(line, {d: pathOf(link)});
        } else {
          animation.appear(
            svgEl(group, 'path', {
              class: classOf(link),
              'data-link': link.id,
              d: pathOf(link),
            }),
          );
        }
      }
      for (const line of lines.values()) {
        line.setAttribute('data-leaving', '');
        animation.disappear(line);
      }
    },
  };
}

const HEADER_HEIGHT = 44;
const FOOTER_HEIGHT = 30;
const LEGEND_FONT_SIZE = 9;

/** Front layer: title, zone labels and a legend, in space of their own. */
function createLegendLayer(labels: TransitLabels): Layer<TransitTheme> {
  const entries = [
    {label: labels.person, iconWidth: 12},
    {label: labels.marriage, iconWidth: 18},
    {label: labels.otherMarriage, iconWidth: 18},
  ];
  /** Returns the width of every legend entry, including the gap after it. */
  const entryWidths = (theme: TransitTheme, measurer: TextMeasurer) =>
    entries.map(
      ({label, iconWidth}) =>
        iconWidth +
        6 +
        measurer.measureWidth(label, {
          fontFamily: theme.fontFamily,
          fontSize: LEGEND_FONT_SIZE,
        }) +
        18,
    );

  return {
    id: 'transit-legend',
    slot: 'front',
    defaultTheme: TRANSIT_DEFAULTS,

    getCss(scope, theme) {
      return [
        `${scope} .transit-title { font-size: 13px; font-weight: bold; letter-spacing: 2px; fill: ${theme.inkColor}; }`,
        `${scope} .transit-zone-label { font-size: 9px; font-weight: bold; letter-spacing: 1.5px; fill: ${theme.mutedInkColor}; }`,
        `${scope} .transit-legend text { font-size: ${LEGEND_FONT_SIZE}px; fill: ${theme.mutedInkColor}; }`,
        `${scope} .transit-legend-ring { fill: ${theme.stationFill}; stroke: ${theme.mutedInkColor}; stroke-width: 3px; }`,
        `${scope} .transit-legend-pill { fill: ${theme.stationFill}; stroke: ${theme.mutedInkColor}; stroke-width: 2px; }`,
      ].join('\n');
    },

    /** Reserves a header above the nodes and a footer below them. */
    getBounds({nodes}, {theme, measurer}): BoundingBox | null {
      if (nodes.length === 0) {
        return null;
      }
      const left = Math.min(...nodes.map((n) => n.x + n.bounds.x));
      const right = Math.max(
        ...nodes.map((n) => n.x + n.bounds.x + n.bounds.width),
      );
      const top = Math.min(...nodes.map((n) => n.y + n.bounds.y));
      const bottom = Math.max(
        ...nodes.map((n) => n.y + n.bounds.y + n.bounds.height),
      );
      const legendWidth = entryWidths(theme, measurer).reduce(
        (sum, width) => sum + width,
        0,
      );
      return {
        x: left,
        y: top - HEADER_HEIGHT,
        width: Math.max(right - left, legendWidth),
        height: bottom - top + HEADER_HEIGHT + FOOTER_HEIGHT,
      };
    },

    render({group, layout, theme, measurer, animation}) {
      const margin = normalizeMargin(theme.margin);
      const left = -layout.origin[0] + margin.left;
      const top = -layout.origin[1] + margin.top;
      const bottom = -layout.origin[1] + layout.size[1] - margin.bottom;

      redraw(group, animation, (artwork) => {
        svgEl(
          artwork,
          'text',
          {class: 'transit-title', x: left, y: top + 13},
          labels.title.toUpperCase(),
        );

        const startGeneration =
          layout.nodes.find((node) => node.isRoot)?.generation ?? 0;
        for (const column of generationColumns(layout)) {
          svgEl(
            artwork,
            'text',
            {
              class: 'transit-zone-label',
              x: (column.start + column.end) / 2,
              y: top + 33,
              'text-anchor': 'middle',
            },
            labels.zone(column.generation - startGeneration).toUpperCase(),
          );
        }

        const legend = svgEl(artwork, 'g', {class: 'transit-legend'});
        const cy = bottom - 9;
        const widths = entryWidths(theme, measurer);
        const icons: Array<(x: number) => void> = [
          (x) =>
            svgEl(legend, 'circle', {
              class: 'transit-legend-ring',
              cx: x + 6,
              cy,
              r: 4.5,
            }),
          (x) =>
            svgEl(legend, 'rect', {
              class: 'transit-legend-pill',
              x,
              y: cy - 5,
              width: 18,
              height: 10,
              rx: 5,
            }),
          (x) =>
            svgEl(legend, 'path', {
              class: 'link transit-line additional-marriage transfer',
              d: `M ${x} ${cy} L ${x + 18} ${cy}`,
            }),
        ];
        let x = left;
        entries.forEach(({label, iconWidth}, i) => {
          icons[i](x);
          svgEl(legend, 'text', {x: x + iconWidth + 6, y: cy + 3}, label);
          x += widths[i];
        });
      });
    },
  };
}

// ---------------------------------------------------------------------------
// The whole look as a chart config.
// ---------------------------------------------------------------------------

export interface TransitConfigOptions {
  graph: ModelGraph;
  locale: string;
  labels: TransitLabels;
  /**
   * Schemes to combine with the look, e.g. generationScheme or sexScheme to
   * colour the stations and quayScheme to mark uncertain data.
   */
  schemes: readonly StyleScheme[];
  /** Whether every family gets a line colour of its own. */
  coloredLines: boolean;
  fontFamily: string;
  colorTarget: ColorTarget;
  hideId: (person: PersonRecord) => boolean;
  hideSex: boolean;
  animate: boolean;
  onPersonClick: (info: ClickInfo) => void;
  onFamilyClick: (info: ClickInfo) => void;
  onExpanderClick: (info: {nodeId: string; slot: Slot}) => void;
  onLayout?: ChartConfig<TransitTheme>['onLayout'];
}

export function createTransitConfig(
  options: TransitConfigOptions,
): ChartConfig<TransitTheme> {
  const {graph} = options;
  return {
    graph,
    chart: 'hourglass',
    direction: 'right',
    expanders: true,
    animate: options.animate,
    updateSvgSize: false,
    nodePlugin: createCoupleAssembler<TransitTheme>({
      personBox: createStationBox({
        graph,
        hideId: options.hideId,
        hideSex: options.hideSex,
      }),
      familyBox: createInterchangeBox(graph, options.locale),
      defaultTheme: TRANSIT_DEFAULTS,
    }),
    layers: [
      createPaperLayer(),
      createLinesLayer(),
      createLegendLayer(options.labels),
    ],
    schemes: [
      ...options.schemes,
      transitLineScheme(graph, {colored: options.coloredLines}),
    ],
    theme: {
      ...TRANSIT_CORE_THEME,
      fontFamily: options.fontFamily,
      colorTarget: options.colorTarget,
    },
    overrideCss: TRANSIT_OVERRIDE_CSS,
    onPersonClick: options.onPersonClick,
    onFamilyClick: options.onFamilyClick,
    onExpanderClick: options.onExpanderClick,
    onLayout: options.onLayout,
  };
}
