import * as React from 'react';
import flatMap from 'array.prototype.flatmap';
import {injectIntl, WrappedComponentProps} from 'react-intl';
import {dereference, GedcomData, getData} from './util/gedcom_util';
import {GedcomEntry} from 'parse-gedcom';
import {TranslatedTag} from './translated-tag';
import {Events} from './events';
import {MultilineText} from './multiline-text';

interface Props {
  gedcom: GedcomData;
  indi: string;
}

const EXCLUDED_TAGS = [
  'BIRT',
  'BAPM',
  'CHR',
  'EVEN',
  'CENS',
  'DEAT',
  'BURI',
  'NAME',
  'SEX',
  'FAMC',
  'FAMS',
  'NOTE',
  'SOUR',
];

function dataDetails(entry: GedcomEntry) {
  const lines = [];
  if (entry.data) {
    lines.push(...getData(entry));
  }
  entry.tree
    .filter((subentry) => subentry.tag === 'NOTE')
    .forEach((note) =>
      getData(note).forEach((line) => lines.push(<i>{line}</i>)),
    );
  if (!lines.length) {
    return null;
  }
  return (
    <>
      <div className="ui sub header">
        <TranslatedTag tag={entry.tag} />
      </div>
      <span>
        <MultilineText lines={lines} />
      </span>
    </>
  );
}

function noteDetails(entry: GedcomEntry) {
  return (
    <MultilineText
      lines={getData(entry).map((line, index) => (
        <i key={index}>{line}</i>
      ))}
    />
  );
}

function nameDetails(entry: GedcomEntry) {
  return (
    <h2 className="ui header">
      {entry.data
        .split('/')
        .filter((name) => !!name)
        .map((name, index) => (
          <div key={index}>
            {name}
            <br />
          </div>
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
    .map((element, index) => (
      <div className="ui segment" key={index}>
        {element}
      </div>
    ));
}

/**
 * Returns true if there is displayable information in this entry.
 * Returns false if there is no data in this entry or this is only a reference
 * to another entry.
 */
function hasData(entry: GedcomEntry) {
  return entry.tree.length > 0 || (entry.data && !entry.data.startsWith('@'));
}

function getOtherDetails(entries: GedcomEntry[]) {
  return entries
    .filter((entry) => !EXCLUDED_TAGS.includes(entry.tag))
    .filter(hasData)
    .map((entry) => dataDetails(entry))
    .filter((element) => element !== null)
    .map((element, index) => (
      <div className="ui segment" key={index}>
        {element}
      </div>
    ));
}

class DetailsComponent extends React.Component<
  Props & WrappedComponentProps,
  {}
> {
  render() {
    const entries = this.props.gedcom.indis[this.props.indi].tree;
    const entriesWithData = entries
      .map((entry) =>
        dereference(entry, this.props.gedcom, (gedcom) => gedcom.other),
      )
      .filter(hasData);

    return (
      <div className="ui segments details">
        {getDetails(entries, ['NAME'], nameDetails)}
        <Events
          gedcom={this.props.gedcom}
          entries={entries}
          indi={this.props.indi}
        />
        {getOtherDetails(entriesWithData)}
        {getDetails(entriesWithData, ['NOTE'], noteDetails)}
      </div>
    );
  }
}
export const Details = injectIntl(DetailsComponent);
