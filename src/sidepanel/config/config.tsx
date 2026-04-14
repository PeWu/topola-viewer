import {SourceHead} from '../head/head';
import {GedcomData} from '../../util/gedcom_util';
import {ParsedQuery} from 'query-string';
import {FormattedMessage} from 'react-intl';
import {Checkbox, Form, Header, Item} from 'semantic-ui-react';

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

export enum Notes {
  HIDE,
  SHOW,
}

export enum Generation {
  HIDE,
  SHOW,
}

export enum SiblingOrder {
  HIDE,
  SHOW,
}

export interface Config {
  color: ChartColors;
  id: Ids;
  sex: Sex;
  notes: Notes;
  generation: Generation;
  siblingOrder: SiblingOrder;
}

export const DEFALUT_CONFIG: Config = {
  color: ChartColors.COLOR_BY_GENERATION,
  id: Ids.SHOW,
  sex: Sex.SHOW,
  notes: Notes.SHOW,
  generation: Generation.SHOW,
  siblingOrder: SiblingOrder.SHOW,
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

const NOTES_ARG = new Map<string, Notes>([
  ['h', Notes.HIDE],
  ['s', Notes.SHOW],
]);
const NOTES_ARG_INVERSE = new Map<Notes, string>();
NOTES_ARG.forEach((v, k) => NOTES_ARG_INVERSE.set(v, k));

const GENERATION_ARG = new Map<string, Generation>([
  ['h', Generation.HIDE],
  ['s', Generation.SHOW],
]);
const GENERATION_ARG_INVERSE = new Map<Generation, string>();
GENERATION_ARG.forEach((v, k) => GENERATION_ARG_INVERSE.set(v, k));

const SIBLING_ORDER_ARG = new Map<string, SiblingOrder>([
  ['h', SiblingOrder.HIDE],
  ['s', SiblingOrder.SHOW],
]);
const SIBLING_ORDER_ARG_INVERSE = new Map<SiblingOrder, string>();
SIBLING_ORDER_ARG.forEach((v, k) => SIBLING_ORDER_ARG_INVERSE.set(v, k));

export function argsToConfig(args: ParsedQuery<any>): Config {
  const getParam = (name: string) => {
    const value = args[name];
    return typeof value === 'string' ? value : undefined;
  };

  return {
    color: COLOR_ARG.get(getParam('c') ?? '') ?? DEFALUT_CONFIG.color,
    id: ID_ARG.get(getParam('i') ?? '') ?? DEFALUT_CONFIG.id,
    sex: SEX_ARG.get(getParam('s') ?? '') ?? DEFALUT_CONFIG.sex,
    notes: NOTES_ARG.get(getParam('n') ?? '') ?? DEFALUT_CONFIG.notes,
    generation: GENERATION_ARG.get(getParam('g') ?? '') ?? DEFALUT_CONFIG.generation,
    siblingOrder: SIBLING_ORDER_ARG.get(getParam('o') ?? '') ?? DEFALUT_CONFIG.siblingOrder,
  };
}

export function configToArgs(config: Config): ParsedQuery<any> {
  return {
    c: COLOR_ARG_INVERSE.get(config.color),
    i: ID_ARG_INVERSE.get(config.id),
    s: SEX_ARG_INVERSE.get(config.sex),
    n: NOTES_ARG_INVERSE.get(config.notes),
    g: GENERATION_ARG_INVERSE.get(config.generation),
    o: SIBLING_ORDER_ARG_INVERSE.get(config.siblingOrder),
  };
}

export function ConfigPanel(props: {
  gedcom: GedcomData;
  config: Config;
  onChange: (config: Config) => void;
}) {
  return (
    <>
    {SourceHead(props.gedcom)}<Form className="details">
      <Item.Group>
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
              <FormattedMessage id="config.notes" defaultMessage="Notes" />
            </Header>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.notes.HIDE"
                    defaultMessage="hide"
                  />
                }
                name="checkboxRadioGroup"
                value="hide"
                checked={props.config.notes === Notes.HIDE}
                onClick={() =>
                  props.onChange({...props.config, notes: Notes.HIDE})
                }
              />
            </Form.Field>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.notes.SHOW"
                    defaultMessage="show"
                  />
                }
                name="checkboxRadioGroup"
                value="show"
                checked={props.config.notes === Notes.SHOW}
                onClick={() =>
                  props.onChange({...props.config, notes: Notes.SHOW})
                }
              />
            </Form.Field>
          </Item.Content>
        </Item>
        <Item>
          <Item.Content>
            <Header sub>
              <FormattedMessage id="config.generation" defaultMessage="Generation #" />
            </Header>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.generation.HIDE"
                    defaultMessage="hide"
                  />
                }
                name="checkboxRadioGroup"
                value="hide"
                checked={props.config.generation === Generation.HIDE}
                onClick={() =>
                  props.onChange({...props.config, generation: Generation.HIDE})
                }
              />
            </Form.Field>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.generation.SHOW"
                    defaultMessage="show"
                  />
                }
                name="checkboxRadioGroup"
                value="show"
                checked={props.config.generation === Generation.SHOW}
                onClick={() =>
                  props.onChange({...props.config, generation: Generation.SHOW})
                }
              />
            </Form.Field>
          </Item.Content>
        </Item>
        <Item>
          <Item.Content>
            <Header sub>
              <FormattedMessage id="config.siblingOrder" defaultMessage="Sibling order" />
            </Header>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.siblingOrder.HIDE"
                    defaultMessage="hide"
                  />
                }
                name="checkboxRadioGroup"
                value="hide"
                checked={props.config.siblingOrder === SiblingOrder.HIDE}
                onClick={() =>
                  props.onChange({...props.config, siblingOrder: SiblingOrder.HIDE})
                }
              />
            </Form.Field>
            <Form.Field className="no-margin">
              <Checkbox
                radio
                label={
                  <FormattedMessage
                    tagName="label"
                    id="config.siblingOrder.SHOW"
                    defaultMessage="show"
                  />
                }
                name="checkboxRadioGroup"
                value="show"
                checked={props.config.siblingOrder === SiblingOrder.SHOW}
                onClick={() =>
                  props.onChange({...props.config, siblingOrder: SiblingOrder.SHOW})
                }
              />
            </Form.Field>
          </Item.Content>
        </Item>
      </Item.Group>
    </Form>
    </>
  );
}
