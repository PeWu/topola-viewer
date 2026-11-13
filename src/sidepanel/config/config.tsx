import {ParsedQuery} from 'query-string';
import {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';
import {
  Button,
  Checkbox,
  Form,
  Header,
  Input,
  Item,
  Popup,
} from 'semantic-ui-react';
import {GedcomData} from '../../util/gedcom_util';
import {DEFAULT_PLACE_DISPLAY_COUNT, PlaceDisplay} from '../../util/place_util';
import {SourceHead} from '../head/head';

export {PlaceDisplay};

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

/** Whether to show all generations above/below the selected person. */
export enum GenerationLimit {
  ALL,
  LIMITED,
}

export const DEFAULT_GENERATION_LIMIT_COUNT = 3;
const MAX_GENERATION_LIMIT_COUNT = 99;

export interface Config {
  color: ChartColors;
  id: Ids;
  sex: Sex;
  place: PlaceDisplay;
  placeCount: number;
  generationsUp: GenerationLimit;
  generationsUpCount: number;
  generationsDown: GenerationLimit;
  generationsDownCount: number;
}

export const DEFALUT_CONFIG: Config = {
  color: ChartColors.COLOR_BY_GENERATION,
  id: Ids.SHOW,
  sex: Sex.SHOW,
  place: PlaceDisplay.FULL,
  placeCount: DEFAULT_PLACE_DISPLAY_COUNT,
  generationsUp: GenerationLimit.ALL,
  generationsUpCount: DEFAULT_GENERATION_LIMIT_COUNT,
  generationsDown: GenerationLimit.ALL,
  generationsDownCount: DEFAULT_GENERATION_LIMIT_COUNT,
};

const COLOR_ARG = new Map<string, ChartColors>([
  ['n', ChartColors.NO_COLOR],
  ['g', ChartColors.COLOR_BY_GENERATION],
  ['s', ChartColors.COLOR_BY_SEX],
]);
const COLOR_ARG_INVERSE = new Map<ChartColors, string>();
COLOR_ARG.forEach((v, k) => COLOR_ARG_INVERSE.set(v, k));

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

function parseGenerationCount(value: string | undefined): number | undefined {
  const count = parseInt(value ?? '', 10);
  return count >= 0 && count <= MAX_GENERATION_LIMIT_COUNT ? count : undefined;
}

export function argsToConfig(args: ParsedQuery<unknown>): Config {
  const getParam = (name: string) => {
    const value = args[name];
    return typeof value === 'string' ? value : undefined;
  };

  const placeCount = parseInt(getParam('pn') ?? '', 10);
  // A generation limit is present in the URL only when it is set.
  const generationsUp = parseGenerationCount(getParam('gu'));
  const generationsDown = parseGenerationCount(getParam('gd'));
  return {
    color: COLOR_ARG.get(getParam('c') ?? '') ?? DEFALUT_CONFIG.color,
    id: ID_ARG.get(getParam('i') ?? '') ?? DEFALUT_CONFIG.id,
    sex: SEX_ARG.get(getParam('s') ?? '') ?? DEFALUT_CONFIG.sex,
    place: PLACE_ARG.get(getParam('p') ?? '') ?? DEFALUT_CONFIG.place,
    placeCount: placeCount >= 1 ? placeCount : DEFALUT_CONFIG.placeCount,
    generationsUp:
      generationsUp !== undefined
        ? GenerationLimit.LIMITED
        : DEFALUT_CONFIG.generationsUp,
    generationsUpCount: generationsUp ?? DEFALUT_CONFIG.generationsUpCount,
    generationsDown:
      generationsDown !== undefined
        ? GenerationLimit.LIMITED
        : DEFALUT_CONFIG.generationsDown,
    generationsDownCount:
      generationsDown ?? DEFALUT_CONFIG.generationsDownCount,
  };
}

/**
 * Returns the URL parameters for the given config. Parameters left at their
 * default value are set to null so that they are removed from the URL;
 * otherwise a previous value would stay in the URL and the setting could not
 * be changed back to its default.
 */
export function configToArgs(config: Config): ParsedQuery {
  const result: ParsedQuery = {
    c: COLOR_ARG_INVERSE.get(config.color) ?? null,
    i: ID_ARG_INVERSE.get(config.id) ?? null,
    s: SEX_ARG_INVERSE.get(config.sex) ?? null,
    p: null,
    pn: null,
    gu: null,
    gd: null,
  };
  const place = PLACE_ARG_INVERSE.get(config.place);
  if (place && config.place !== PlaceDisplay.FULL) {
    result.p = place;
  }
  if (
    config.place === PlaceDisplay.SHORT &&
    config.placeCount !== DEFALUT_CONFIG.placeCount
  ) {
    result.pn = String(config.placeCount);
  }
  if (config.generationsUp === GenerationLimit.LIMITED) {
    result.gu = String(config.generationsUpCount);
  }
  if (config.generationsDown === GenerationLimit.LIMITED) {
    result.gd = String(config.generationsDownCount);
  }
  return result;
}

/** Maximum number of generations above the selected person, if limited. */
export function getGenerationsUp(config: Config): number | undefined {
  return config.generationsUp === GenerationLimit.LIMITED
    ? config.generationsUpCount
    : undefined;
}

/** Maximum number of generations below the selected person, if limited. */
export function getGenerationsDown(config: Config): number | undefined {
  return config.generationsDown === GenerationLimit.LIMITED
    ? config.generationsDownCount
    : undefined;
}

/** Settings item with "all" / "limit to [N]" choices. */
function GenerationLimitItem(props: {
  title: ReactNode;
  limit: GenerationLimit;
  count: number;
  onChange: (limit: GenerationLimit, count: number) => void;
}) {
  return (
    <Item>
      <Item.Content>
        <Header sub>{props.title}</Header>
        <Form.Field className="no-margin">
          <Checkbox
            radio
            label={
              <FormattedMessage
                tagName="label"
                id="config.generations.ALL"
                defaultMessage="all"
              />
            }
            name="checkboxRadioGroup"
            value="all"
            checked={props.limit === GenerationLimit.ALL}
            onClick={() => props.onChange(GenerationLimit.ALL, props.count)}
          />
        </Form.Field>
        <Form.Field className="no-margin">
          <Checkbox
            radio
            label={
              <FormattedMessage
                tagName="label"
                id="config.generations.LIMITED"
                defaultMessage="limit to"
              />
            }
            name="checkboxRadioGroup"
            value="limited"
            checked={props.limit === GenerationLimit.LIMITED}
            onClick={() => props.onChange(GenerationLimit.LIMITED, props.count)}
          />
          {props.limit === GenerationLimit.LIMITED && (
            <Input
              type="number"
              min={0}
              max={MAX_GENERATION_LIMIT_COUNT}
              size="mini"
              style={{width: '6em', marginLeft: '1.5em'}}
              value={props.count}
              onChange={(_e, {value}) => {
                const n = parseGenerationCount(value);
                if (n !== undefined) {
                  props.onChange(GenerationLimit.LIMITED, n);
                }
              }}
            />
          )}
        </Form.Field>
      </Item.Content>
    </Item>
  );
}

export function ConfigPanel(props: {
  gedcom: GedcomData;
  config: Config;
  onChange: (config: Config) => void;
  /** Expands all the branches collapsed with the chart's [-] buttons. */
  onExpandAll?: () => void;
}) {
  return (
    <Form className="details">
      <Item.Group>
        {SourceHead(props.gedcom)}
        <Item>
          <Item.Content>
            <Header sub>
              <FormattedMessage id="config.colors" defaultMessage="Colors" />
            </Header>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.colors.NO_COLOR"
                    defaultMessage="none"
                  />
                }
                name="checkboxRadioGroup"
                value="none"
                checked={props.config.color === ChartColors.NO_COLOR}
                onClick={() =>
                  props.onChange({
                    ...props.config,
                    color: ChartColors.NO_COLOR,
                  })
                }
              />
            </Form.Field>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.colors.COLOR_BY_GENERATION"
                    defaultMessage="by generation"
                  />
                }
                name="checkboxRadioGroup"
                value="generation"
                checked={props.config.color === ChartColors.COLOR_BY_GENERATION}
                onClick={() =>
                  props.onChange({
                    ...props.config,
                    color: ChartColors.COLOR_BY_GENERATION,
                  })
                }
              />
            </Form.Field>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.colors.COLOR_BY_SEX"
                    defaultMessage="by sex"
                  />
                }
                name="checkboxRadioGroup"
                value="gender"
                checked={props.config.color === ChartColors.COLOR_BY_SEX}
                onClick={() =>
                  props.onChange({
                    ...props.config,
                    color: ChartColors.COLOR_BY_SEX,
                  })
                }
              />
            </Form.Field>
          </Item.Content>
        </Item>
        <Item>
          <Item.Content>
            <Header sub>
              <FormattedMessage id="config.ids" defaultMessage="IDs" />
            </Header>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.ids.HIDE"
                    defaultMessage="hide"
                  />
                }
                name="checkboxRadioGroup"
                value="hide"
                checked={props.config.id === Ids.HIDE}
                onClick={() => props.onChange({...props.config, id: Ids.HIDE})}
              />
            </Form.Field>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.ids.SHOW"
                    defaultMessage="show"
                  />
                }
                name="checkboxRadioGroup"
                value="show"
                checked={props.config.id === Ids.SHOW}
                onClick={() => props.onChange({...props.config, id: Ids.SHOW})}
              />
            </Form.Field>
          </Item.Content>
        </Item>
        <Item>
          <Item.Content>
            <Header sub>
              <FormattedMessage id="config.sex" defaultMessage="Sex" />
            </Header>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.sex.HIDE"
                    defaultMessage="hide"
                  />
                }
                name="checkboxRadioGroup"
                value="hide"
                checked={props.config.sex === Sex.HIDE}
                onClick={() => props.onChange({...props.config, sex: Sex.HIDE})}
              />
            </Form.Field>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.sex.SHOW"
                    defaultMessage="show"
                  />
                }
                name="checkboxRadioGroup"
                value="show"
                checked={props.config.sex === Sex.SHOW}
                onClick={() => props.onChange({...props.config, sex: Sex.SHOW})}
              />
            </Form.Field>
          </Item.Content>
        </Item>
        <Item>
          <Item.Content>
            <Header sub>
              <FormattedMessage id="config.places" defaultMessage="Places" />
            </Header>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.places.HIDE"
                    defaultMessage="hide"
                  />
                }
                name="checkboxRadioGroup"
                value="hide"
                checked={props.config.place === PlaceDisplay.HIDE}
                onClick={() =>
                  props.onChange({...props.config, place: PlaceDisplay.HIDE})
                }
              />
            </Form.Field>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.places.SHORT"
                    defaultMessage="short"
                  />
                }
                name="checkboxRadioGroup"
                value="short"
                checked={props.config.place === PlaceDisplay.SHORT}
                onClick={() =>
                  props.onChange({...props.config, place: PlaceDisplay.SHORT})
                }
              />
              {props.config.place === PlaceDisplay.SHORT && (
                <Input
                  type="number"
                  min={1}
                  max={10}
                  size="mini"
                  style={{width: '6em', marginLeft: '1.5em'}}
                  value={props.config.placeCount}
                  onChange={(_e, {value}) => {
                    const n = parseInt(value, 10);
                    if (n >= 1) {
                      props.onChange({...props.config, placeCount: n});
                    }
                  }}
                />
              )}
            </Form.Field>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.places.FULL"
                    defaultMessage="full"
                  />
                }
                name="checkboxRadioGroup"
                value="full"
                checked={props.config.place === PlaceDisplay.FULL}
                onClick={() =>
                  props.onChange({...props.config, place: PlaceDisplay.FULL})
                }
              />
            </Form.Field>
          </Item.Content>
        </Item>
        <GenerationLimitItem
          title={
            <FormattedMessage
              id="config.generations_up"
              defaultMessage="Generations above"
            />
          }
          limit={props.config.generationsUp}
          count={props.config.generationsUpCount}
          onChange={(generationsUp, generationsUpCount) =>
            props.onChange({...props.config, generationsUp, generationsUpCount})
          }
        />
        <GenerationLimitItem
          title={
            <FormattedMessage
              id="config.generations_down"
              defaultMessage="Generations below"
            />
          }
          limit={props.config.generationsDown}
          count={props.config.generationsDownCount}
          onChange={(generationsDown, generationsDownCount) =>
            props.onChange({
              ...props.config,
              generationsDown,
              generationsDownCount,
            })
          }
        />
        <Item>
          <Item.Content>
            <Header sub>
              <FormattedMessage
                id="config.branches"
                defaultMessage="Branches"
              />
            </Header>
            <Form.Field className="no-margin">
              <Popup
                position="bottom left"
                content={
                  <FormattedMessage
                    id="config.expand_all.tooltip"
                    defaultMessage="Shows again all the branches hidden with the [-] buttons of the chart."
                  />
                }
                trigger={
                  <Button
                    basic
                    size="small"
                    disabled={!props.onExpandAll}
                    onClick={(e) => {
                      e.preventDefault();
                      props.onExpandAll?.();
                    }}
                  >
                    <FormattedMessage
                      id="config.expand_all"
                      defaultMessage="Expand all branches"
                    />
                  </Button>
                }
              />
            </Form.Field>
          </Item.Content>
        </Item>
      </Item.Group>
    </Form>
  );
}
