import {Radio, Stack, Text} from '@mantine/core';
import {ParsedQuery} from 'query-string';
import {FormattedMessage} from 'react-intl';
import type {ColorTarget} from 'topola/toolkit';
import {GedcomData} from '../../util/gedcom_util';
import {DEFAULT_PLACE_DISPLAY_COUNT, PlaceDisplay} from '../../util/place_util';
import {SourceHead} from '../head/head';

export {PlaceDisplay};
export type {ColorTarget};

export enum ChartColors {
  NO_COLOR,
  COLOR_BY_SEX,
  COLOR_BY_GENERATION,
}

export enum Ids {
  HIDE,
  SHOW,
}

export enum Sex {
  HIDE,
  SHOW,
}

export const DEFAULT_FONT_FAMILY = 'Montserrat';

export const ALLOWED_FONTS = [
  'Montserrat',
  'Roboto',
  'Open Sans',
  'Lato',
  'Lora',
  'Merriweather',
] as const;

export type AllowedFont = (typeof ALLOWED_FONTS)[number];

export function isAllowedFont(value: string | undefined): value is AllowedFont {
  return (
    value !== undefined && (ALLOWED_FONTS as readonly string[]).includes(value)
  );
}

const GOOGLE_FONT_STYLESHEETS: Readonly<Record<AllowedFont, string>> = {
  Montserrat:
    'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap',
  Roboto:
    'https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,700;1,400&display=swap',
  'Open Sans':
    'https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,400;0,700;1,400&display=swap',
  Lato: 'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400&display=swap',
  Lora: 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&display=swap',
  Merriweather:
    'https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap',
};

const SERIF_FONTS: ReadonlySet<AllowedFont> = new Set(['Lora', 'Merriweather']);

export function getFontFamilyStack(font: AllowedFont): string {
  const quoted = font.includes(' ') ? `'${font}'` : font;
  return SERIF_FONTS.has(font)
    ? `${quoted}, Georgia, serif`
    : `${quoted}, verdana, arial, sans-serif`;
}

export function ensureGoogleFontLoaded(font: AllowedFont): void {
  if (typeof document === 'undefined' || font === DEFAULT_FONT_FAMILY) {
    return;
  }
  const id = `topola-google-font-${font.toLowerCase().replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) {
    return;
  }
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.crossOrigin = 'anonymous';
  link.href = GOOGLE_FONT_STYLESHEETS[font];
  document.head.appendChild(link);

  const quoted = font.includes(' ') ? `"${font}"` : font;
  if (document.fonts?.load) {
    void document.fonts.load(`400 12px ${quoted}`).catch(() => undefined);
    void document.fonts.load(`700 12px ${quoted}`).catch(() => undefined);
  }
}

export interface Config {
  color: ChartColors;
  colorTarget: ColorTarget;
  fontFamily: AllowedFont;
  id: Ids;
  sex: Sex;
  place: PlaceDisplay;
  placeCount: number;
}

export const DEFALUT_CONFIG: Config = {
  color: ChartColors.COLOR_BY_GENERATION,
  colorTarget: 'background',
  fontFamily: DEFAULT_FONT_FAMILY,
  id: Ids.SHOW,
  sex: Sex.SHOW,
  place: PlaceDisplay.FULL,
  placeCount: DEFAULT_PLACE_DISPLAY_COUNT,
};

const COLOR_ARG = new Map<string, ChartColors>([
  ['n', ChartColors.NO_COLOR],
  ['g', ChartColors.COLOR_BY_GENERATION],
  ['s', ChartColors.COLOR_BY_SEX],
]);
const COLOR_ARG_INVERSE = new Map<ChartColors, string>();
COLOR_ARG.forEach((v, k) => COLOR_ARG_INVERSE.set(v, k));

const COLOR_TARGET_ARG = new Map<string, ColorTarget>([
  ['b', 'background'],
  ['f', 'frame'],
  ['n', 'name'],
]);
const COLOR_TARGET_ARG_INVERSE = new Map<ColorTarget, string>();
COLOR_TARGET_ARG.forEach((v, k) => COLOR_TARGET_ARG_INVERSE.set(v, k));

const ID_ARG = new Map<string, Ids>([
  ['h', Ids.HIDE],
  ['s', Ids.SHOW],
]);
const ID_ARG_INVERSE = new Map<Ids, string>();
ID_ARG.forEach((v, k) => ID_ARG_INVERSE.set(v, k));

const SEX_ARG = new Map<string, Sex>([
  ['h', Sex.HIDE],
  ['s', Sex.SHOW],
]);
const SEX_ARG_INVERSE = new Map<Sex, string>();
SEX_ARG.forEach((v, k) => SEX_ARG_INVERSE.set(v, k));

const PLACE_ARG = new Map<string, PlaceDisplay>([
  ['f', PlaceDisplay.FULL],
  ['s', PlaceDisplay.SHORT],
  ['h', PlaceDisplay.HIDE],
]);
const PLACE_ARG_INVERSE = new Map<PlaceDisplay, string>();
PLACE_ARG.forEach((v, k) => PLACE_ARG_INVERSE.set(v, k));

export function argsToConfig(args: ParsedQuery<unknown>): Config {
  const getParam = (name: string) => {
    const value = args[name];
    return typeof value === 'string' ? value : undefined;
  };

  const rawFont = getParam('ff');
  const placeCount = parseInt(getParam('pn') ?? '', 10);
  return {
    color: COLOR_ARG.get(getParam('c') ?? '') ?? DEFALUT_CONFIG.color,
    colorTarget:
      COLOR_TARGET_ARG.get(getParam('ct') ?? '') ?? DEFALUT_CONFIG.colorTarget,
    fontFamily: isAllowedFont(rawFont) ? rawFont : DEFALUT_CONFIG.fontFamily,
    id: ID_ARG.get(getParam('i') ?? '') ?? DEFALUT_CONFIG.id,
    sex: SEX_ARG.get(getParam('s') ?? '') ?? DEFALUT_CONFIG.sex,
    place: PLACE_ARG.get(getParam('p') ?? '') ?? DEFALUT_CONFIG.place,
    placeCount: placeCount >= 1 ? placeCount : DEFALUT_CONFIG.placeCount,
  };
}

export function configToArgs(config: Config): ParsedQuery {
  const result: ParsedQuery = {};
  const color = COLOR_ARG_INVERSE.get(config.color);
  if (color) {
    result.c = color;
  }
  result.ct =
    config.colorTarget !== DEFALUT_CONFIG.colorTarget
      ? (COLOR_TARGET_ARG_INVERSE.get(config.colorTarget) ?? null)
      : null;
  result.ff =
    config.fontFamily !== DEFALUT_CONFIG.fontFamily ? config.fontFamily : null;
  const id = ID_ARG_INVERSE.get(config.id);
  if (id) {
    result.i = id;
  }
  const sex = SEX_ARG_INVERSE.get(config.sex);
  if (sex) {
    result.s = sex;
  }
  const place = PLACE_ARG_INVERSE.get(config.place);
  result.p = place && config.place !== PlaceDisplay.FULL ? place : null;
  result.pn =
    config.place === PlaceDisplay.SHORT &&
    config.placeCount !== DEFALUT_CONFIG.placeCount
      ? String(config.placeCount)
      : null;
  return result;
}

export function ConfigPanel(props: {
  gedcom: GedcomData;
  config: Config;
  onChange: (patch: Partial<Config>) => void;
}) {
  return (
    <form className="details" onSubmit={(e) => e.preventDefault()}>
      <Stack gap={14}>
        {SourceHead(props.gedcom)}
        <div className="item" style={{padding: '0 15px 0 25px'}}>
          <Text className="sub-header" size="xs" fw={700} tt="uppercase" mb={4}>
            <FormattedMessage id="config.colors" defaultMessage="Colors" />
          </Text>
          <Radio.Group
            value={
              props.config.color === ChartColors.NO_COLOR
                ? 'none'
                : props.config.color === ChartColors.COLOR_BY_GENERATION
                  ? 'generation'
                  : 'gender'
            }
            onChange={(val) => {
              const color =
                val === 'none'
                  ? ChartColors.NO_COLOR
                  : val === 'generation'
                    ? ChartColors.COLOR_BY_GENERATION
                    : ChartColors.COLOR_BY_SEX;
              props.onChange({color});
            }}
          >
            <Stack gap={4}>
              <Radio
                value="none"
                label={
                  <FormattedMessage
                    id="config.colors.NO_COLOR"
                    defaultMessage="none"
                  />
                }
              />
              <Radio
                value="generation"
                label={
                  <FormattedMessage
                    id="config.colors.COLOR_BY_GENERATION"
                    defaultMessage="by generation"
                  />
                }
              />
              <Radio
                value="gender"
                label={
                  <FormattedMessage
                    id="config.colors.COLOR_BY_SEX"
                    defaultMessage="by sex"
                  />
                }
              />
            </Stack>
          </Radio.Group>
        </div>

        <div className="item" style={{padding: '0 15px 0 25px'}}>
          <Text className="sub-header" size="xs" fw={700} tt="uppercase" mb={4}>
            <FormattedMessage
              id="config.colorTarget"
              defaultMessage="Color style"
            />
          </Text>
          <Radio.Group
            value={props.config.colorTarget}
            onChange={(val) => {
              if (val === 'background' || val === 'frame' || val === 'name') {
                props.onChange({colorTarget: val});
              }
            }}
          >
            <Stack gap={4}>
              <Radio
                value="background"
                label={
                  <FormattedMessage
                    id="config.colorTarget.background"
                    defaultMessage="background"
                  />
                }
              />
              <Radio
                value="frame"
                label={
                  <FormattedMessage
                    id="config.colorTarget.frame"
                    defaultMessage="frame"
                  />
                }
              />
              <Radio
                value="name"
                label={
                  <FormattedMessage
                    id="config.colorTarget.name"
                    defaultMessage="name"
                  />
                }
              />
            </Stack>
          </Radio.Group>
        </div>

        <div className="item" style={{padding: '0 15px 0 25px'}}>
          <Text className="sub-header" size="xs" fw={700} tt="uppercase" mb={4}>
            <FormattedMessage id="config.font" defaultMessage="Font" />
          </Text>
          <select
            aria-label="Font"
            value={props.config.fontFamily}
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: '13px',
              lineHeight: 1.2,
              color: 'rgba(0, 0, 0, 0.87)',
              backgroundColor: '#fff',
              border: '1px solid rgba(34, 36, 38, 0.15)',
              borderRadius: 4,
            }}
            onChange={(e) => {
              const next = e.target.value;
              if (isAllowedFont(next)) {
                props.onChange({fontFamily: next});
              }
            }}
          >
            {ALLOWED_FONTS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>

        <div className="item" style={{padding: '0 15px 0 25px'}}>
          <Text className="sub-header" size="xs" fw={700} tt="uppercase" mb={4}>
            <FormattedMessage id="config.ids" defaultMessage="IDs" />
          </Text>
          <Radio.Group
            value={props.config.id === Ids.HIDE ? 'hide' : 'show'}
            onChange={(val) =>
              props.onChange({id: val === 'hide' ? Ids.HIDE : Ids.SHOW})
            }
          >
            <Stack gap={4}>
              <Radio
                value="hide"
                label={
                  <FormattedMessage
                    id="config.ids.HIDE"
                    defaultMessage="hide"
                  />
                }
              />
              <Radio
                value="show"
                label={
                  <FormattedMessage
                    id="config.ids.SHOW"
                    defaultMessage="show"
                  />
                }
              />
            </Stack>
          </Radio.Group>
        </div>

        <div className="item" style={{padding: '0 15px 0 25px'}}>
          <Text className="sub-header" size="xs" fw={700} tt="uppercase" mb={4}>
            <FormattedMessage id="config.sex" defaultMessage="Sex" />
          </Text>
          <Radio.Group
            value={props.config.sex === Sex.HIDE ? 'hide' : 'show'}
            onChange={(val) =>
              props.onChange({sex: val === 'hide' ? Sex.HIDE : Sex.SHOW})
            }
          >
            <Stack gap={4}>
              <Radio
                value="hide"
                label={
                  <FormattedMessage
                    id="config.sex.HIDE"
                    defaultMessage="hide"
                  />
                }
              />
              <Radio
                value="show"
                label={
                  <FormattedMessage
                    id="config.sex.SHOW"
                    defaultMessage="show"
                  />
                }
              />
            </Stack>
          </Radio.Group>
        </div>

        <div className="item" style={{padding: '0 15px 0 25px'}}>
          <Text className="sub-header" size="xs" fw={700} tt="uppercase" mb={4}>
            <FormattedMessage id="config.places" defaultMessage="Places" />
          </Text>
          <Radio.Group
            value={
              props.config.place === PlaceDisplay.HIDE
                ? 'hide'
                : props.config.place === PlaceDisplay.SHORT
                  ? 'short'
                  : 'full'
            }
            onChange={(val) => {
              const place =
                val === 'hide'
                  ? PlaceDisplay.HIDE
                  : val === 'short'
                    ? PlaceDisplay.SHORT
                    : PlaceDisplay.FULL;
              props.onChange({place});
            }}
          >
            <Stack gap={4}>
              <Radio
                value="hide"
                label={
                  <FormattedMessage
                    id="config.places.HIDE"
                    defaultMessage="hide"
                  />
                }
              />
              <div style={{display: 'flex', alignItems: 'center'}}>
                <Radio
                  value="short"
                  label={
                    <FormattedMessage
                      id="config.places.SHORT"
                      defaultMessage="short"
                    />
                  }
                />
                {props.config.place === PlaceDisplay.SHORT && (
                  <input
                    type="number"
                    min={1}
                    max={10}
                    style={{
                      width: '4em',
                      marginLeft: '1.5em',
                      padding: '6px 10px',
                      fontSize: '11px',
                      lineHeight: 1.2,
                      color: 'rgba(0, 0, 0, 0.87)',
                      border: '1px solid rgba(34, 36, 38, 0.15)',
                      borderRadius: 4,
                    }}
                    value={props.config.placeCount}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (n >= 1) {
                        props.onChange({placeCount: n});
                      }
                    }}
                  />
                )}
              </div>
              <Radio
                value="full"
                label={
                  <FormattedMessage
                    id="config.places.FULL"
                    defaultMessage="full"
                  />
                }
              />
            </Stack>
          </Radio.Group>
        </div>
      </Stack>
    </form>
  );
}
