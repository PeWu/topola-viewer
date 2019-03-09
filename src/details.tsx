import * as React from 'react';
import flatMap from 'array.prototype.flatmap';
import Linkify from 'react-linkify';
import {formatDate, getDate} from 'topola';
import {FormattedMessage} from 'react-intl';
import {GedcomData} from './gedcom_util';
import {GedcomEntry} from 'parse-gedcom';
import {intlShape} from 'react-intl';

interface Props {
  gedcom: GedcomData;
  indi: string;
}

const NAME_TAGS = ['NAME'];
const EVENT_TAGS = ['BIRT', 'BAPM', 'CHR', 'DEAT', 'BURI'];
const DATA_TAGS = ['TITL', 'OCCU', 'WWW', 'EMAIL'];
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

function translateDate(gedcomDate: string, locale: string) {
  const dateOrRange = getDate(gedcomDate);
  const date = dateOrRange && dateOrRange.date;
  if (!date) {
    return gedcomDate;
  }
  return formatDate(date, locale);
}

function eventDetails(entry: GedcomEntry, tag: string, locale: string) {
  const lines = [];
  const date = entry.tree.find((subentry) => subentry.tag === 'DATE');
  if (date && date.data) {
    lines.push(translateDate(date.data, locale));
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
      <div className="ui sub header">{translateTag(tag)}</div>
      <span>
        {lines.map((line) => (
          <>
            <Linkify properties={{target: '_blank'}}>{line}</Linkify>
            <br />
          </>
        ))}
      </span>
    </>
  );
}

function dataDetails(entry: GedcomEntry, tag: string) {
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
      <div className="ui sub header">{translateTag(tag)}</div>
      <span>
        {lines.map((line) => (
          <>
            <Linkify properties={{target: '_blank'}}>{line}</Linkify>
            <br />
          </>
        ))}
      </span>
    </>
  );
}

function nameDetails(entry: GedcomEntry, tag: string) {
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
  detailsFunction: (entry: GedcomEntry, tag: string) => JSX.Element | null,
): JSX.Element[] {
  return flatMap(tags, (tag) =>
    entries
      .filter((entry) => entry.tag === tag)
      .map((entry) => detailsFunction(entry, tag)),
  )
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
        {getDetails(entries, NAME_TAGS, nameDetails)}
        {getDetails(entries, EVENT_TAGS, (entry, tag) =>
          eventDetails(entry, tag, this.context.intl.locale),
        )}
        {getDetails(entries, DATA_TAGS, dataDetails)}
      </div>
    );
  }
}
