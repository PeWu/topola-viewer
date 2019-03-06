import * as React from 'react';
import {GedcomData} from './gedcom_util';
import {GedcomEntry} from 'parse-gedcom';

interface Props {
  gedcom: GedcomData;
  indi: string;
}

function eventDetails(entry: GedcomEntry, header: string) {
  const lines = [];
  const date = entry.tree.find((subentry) => subentry.tag === 'DATE');
  if (date && date.data) {
    lines.push(date.data);
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
      <div className="ui sub header">{header}</div>
      <span>
        {lines.map((line) => (
          <>
            {line}
            <br />
          </>
        ))}
      </span>
    </>
  );
}

function dataDetails(entry: GedcomEntry, header: string) {
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
      <div className="ui sub header">{header}</div>
      <span>
        {lines.map((line) => (
          <>
            {line}
            <br />
          </>
        ))}
      </span>
    </>
  );
}

function nameDetails(entry: GedcomEntry, header: string) {
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
  detailsFunction: (entry: GedcomEntry, header: string) => JSX.Element | null,
): JSX.Element[] {
  return tags
    .flatMap((tag) =>
      entries
        .filter((entry) => entry.tag === tag)
        .map((entry) => detailsFunction(entry, tag)),
    )
    .filter((element) => element !== null)
    .map((element) => <div className="ui segment">{element}</div>);
}

const NAME_TAGS = ['NAME'];
const EVENT_TAGS = ['BIRT', 'BAPM', 'CHR', 'DEAT', 'BURI'];
const DATA_TAGS = ['TITL', 'OCCU', 'WWW', 'EMAIL'];

export class Details extends React.Component<Props, {}> {
  render() {
    const entries = this.props.gedcom.indis[this.props.indi].tree;

    return (
      <div className="ui segments" id="details">
        {getDetails(entries, NAME_TAGS, nameDetails)}
        {getDetails(entries, EVENT_TAGS, eventDetails)}
        {getDetails(entries, DATA_TAGS, dataDetails)}
      </div>
    );
  }
}
