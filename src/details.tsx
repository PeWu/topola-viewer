import * as React from 'react';
import flatMap from 'array.prototype.flatmap';
import Linkify from 'react-linkify';
import {Date as TopolaDate, DateRange, getDate} from 'topola';
import {FormattedMessage, InjectedIntl} from 'react-intl';
import {GedcomData} from './gedcom_util';
import {GedcomEntry} from 'parse-gedcom';
import {intlShape} from 'react-intl';

interface Props {
  gedcom: GedcomData;
  indi: string;
}

const EVENT_TAGS = ['BIRT', 'BAPM', 'CHR', 'DEAT', 'BURI'];
const EXCLUDED_TAGS = ['NAME', 'SEX', 'FAMC', 'FAMS', 'SOUR', 'NOTE'];
const TAG_DESCRIPTIONS = new Map([
  ['BAPM', 'Baptism'],
  ['BIRT', 'Birth'],
  ['BURI', 'Burial'],
  ['CHR', 'Christening'],
  ['DEAT', 'Death'],
  ['EMAIL', 'E-mail'],
  ['OCCU', 'Occupation'],
  ['TITL', 'Title'],
  ['WWW', 'WWW'],
]);

function translateTag(tag: string) {
  return (
    <FormattedMessage
      id={`gedcom.${tag}`}
      defaultMessage={TAG_DESCRIPTIONS.get(tag) || tag}
    />
  );
}

const DATE_QUALIFIERS = new Map([
  ['abt', 'about'],
  ['cal', 'calculated'],
  ['est', 'estimated'],
]);

function formatDate(date: TopolaDate, intl: InjectedIntl) {
  const hasDay = date.day !== undefined;
  const hasMonth = date.month !== undefined;
  const hasYear = date.year !== undefined;
  if (!hasDay && !hasMonth && !hasYear) {
    return date.text || '';
  }
  const dateObject = new Date(
    hasYear ? date.year! : 0,
    hasMonth ? date.month! - 1 : 0,
    hasDay ? date.day! : 1,
  );

  const qualifier = date.qualifier && date.qualifier.toLowerCase();
  const translatedQualifier =
    qualifier &&
    intl.formatMessage({
      id: `date.${qualifier}`,
      defaultMessage: DATE_QUALIFIERS.get(qualifier) || qualifier,
    });

  const formatOptions = {
    day: hasDay ? 'numeric' : undefined,
    month: hasMonth ? 'long' : undefined,
    year: hasYear ? 'numeric' : undefined,
  };
  const translatedDate = new Intl.DateTimeFormat(
    intl.locale,
    formatOptions,
  ).format(dateObject);

  return [translatedQualifier, translatedDate].join(' ');
}

function formatDateRage(dateRange: DateRange, intl: InjectedIntl) {
  const fromDate = dateRange.from;
  const toDate = dateRange.to;
  const translatedFromDate = fromDate && formatDate(fromDate, intl);
  const translatedToDate = toDate && formatDate(toDate, intl);
  if (translatedFromDate && translatedToDate) {
    return intl.formatMessage(
      {
        id: 'date.between',
        defaultMessage: 'between {from} and {to}',
      },
      {from: translatedFromDate, to: translatedToDate},
    );
  }
  if (translatedFromDate) {
    return intl.formatMessage(
      {
        id: 'date.after',
        defaultMessage: 'after {from}',
      },
      {from: translatedFromDate},
    );
  }
  if (translatedToDate) {
    return intl.formatMessage(
      {
        id: 'date.before',
        defaultMessage: 'before {to}',
      },
      {to: translatedToDate},
    );
  }
  return '';
}

function translateDate(gedcomDate: string, intl: InjectedIntl) {
  const dateOrRange = getDate(gedcomDate);
  if (!dateOrRange) {
    return '';
  }
  if (dateOrRange.date) {
    return formatDate(dateOrRange.date, intl);
  }
  if (dateOrRange.dateRange) {
    return formatDateRage(dateOrRange.dateRange, intl);
  }
  return '';
}

function joinLines(lines: (JSX.Element | string)[]) {
  return (
    <>
      {lines.map((line) => (
        <>
          <Linkify properties={{target: '_blank'}}>{line}</Linkify>
          <br />
        </>
      ))}
    </>
  );
}

function eventDetails(entry: GedcomEntry, intl: InjectedIntl) {
  const lines = [];
  const date = entry.tree.find((subentry) => subentry.tag === 'DATE');
  if (date && date.data) {
    lines.push(translateDate(date.data, intl));
  }
  const place = entry.tree.find((subentry) => subentry.tag === 'PLAC');
  if (place && place.data) {
    lines.push(place.data);
  }
  entry.tree
    .filter((subentry) => subentry.tag === 'NOTE')
    .forEach((note) => {
      lines.push(<i>{note.data}</i>);
    });
  if (!lines.length) {
    return null;
  }
  return (
    <>
      <div className="ui sub header">{translateTag(entry.tag)}</div>
      <span>{joinLines(lines)}</span>
    </>
  );
}

function dataDetails(entry: GedcomEntry) {
  const lines = [];
  if (entry.data) {
    lines.push(entry.data);
  }
  entry.tree
    .filter((subentry) => subentry.tag === 'NOTE')
    .forEach((note) => {
      lines.push(<i>{note.data}</i>);
    });
  if (!lines.length) {
    return null;
  }
  return (
    <>
      <div className="ui sub header">{translateTag(entry.tag)}</div>
      <span>{joinLines(lines)}</span>
    </>
  );
}

function noteDetails(entry: GedcomEntry) {
  const lines = [];
  if (entry.data) {
    lines.push(entry.data);
  }
  if (!lines.length) {
    return null;
  }
  return <i>{joinLines(lines)}</i>;
}

function nameDetails(entry: GedcomEntry) {
  return (
    <h2 className="ui header">
      {entry.data
        .split('/')
        .filter((name) => !!name)
        .map((name) => (
          <>
            {name}
            <br />
          </>
        ))}
    </h2>
  );
}

function getDetails(
  entries: GedcomEntry[],
  tags: string[],
  detailsFunction: (entry: GedcomEntry) => JSX.Element | null,
): JSX.Element[] {
  return flatMap(tags, (tag) =>
    entries
      .filter((entry) => entry.tag === tag)
      .map((entry) => detailsFunction(entry)),
  )
    .filter((element) => element !== null)
    .map((element) => <div className="ui segment">{element}</div>);
}

function getOtherDetails(entries: GedcomEntry[]) {
  return entries
    .filter(
      (entry) =>
        !EXCLUDED_TAGS.includes(entry.tag) && !EVENT_TAGS.includes(entry.tag),
    )
    .map((entry) => dataDetails(entry))
    .filter((element) => element !== null)
    .map((element) => <div className="ui segment">{element}</div>);
}

export class Details extends React.Component<Props, {}> {
  /** Make intl appear in this.context. */
  static contextTypes = {
    intl: intlShape,
  };

  render() {
    const entries = this.props.gedcom.indis[this.props.indi].tree;

    return (
      <div className="ui segments" id="details">
        {getDetails(entries, ['NAME'], nameDetails)}
        {getDetails(entries, EVENT_TAGS, (entry) =>
          eventDetails(entry, this.context.intl as InjectedIntl),
        )}
        {getOtherDetails(entries)}
        {getDetails(entries, ['NOTE'], noteDetails)}
      </div>
    );
  }
}
