import flatMap from 'array.prototype.flatmap';
import {GedcomEntry} from 'parse-gedcom';
import {FormattedMessage} from 'react-intl';
import {Header, Item} from 'semantic-ui-react';
import {
  dereference,
  GedcomData,
  getData,
  getFileName,
  getImageFileEntry,
  getNonImageFileEntry,
  mapToSource,
} from '../util/gedcom_util';
import {AdditionalFiles} from './additional-files';
import {Events} from './events';
import {MultilineText} from './multiline-text';
import {Sources} from './sources';
import {TranslatedTag} from './translated-tag';
import {WrappedImage} from './wrapped-image';

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
      <Header sub>
        <TranslatedTag tag={entry.tag} />
      </Header>
      <span>
        <MultilineText lines={lines} />
      </span>
    </>
  );
}

function imageDetails(objectEntryReference: GedcomEntry, gedcom: GedcomData) {
  const imageEntry = dereference(
    objectEntryReference,
    gedcom,
    (gedcom) => gedcom.other,
  );

  const imageFileEntry = getImageFileEntry(imageEntry);

  if (!imageFileEntry || !hasData(imageEntry)) {
    return null;
  }

  return (
    <div className="person-image">
      <WrappedImage
        url={imageFileEntry.data}
        filename={getFileName(imageFileEntry) || ''}
      />
    </div>
  );
}

function sourceDetails(
  sourceReferenceEntries: GedcomEntry[],
  gedcom: GedcomData,
) {
  const sources = sourceReferenceEntries.map((sourceEntryReference) =>
    mapToSource(sourceEntryReference, gedcom),
  );

  if (!sources.length) {
    return null;
  }

  return (
    <>
      <div className="item-header">
        <Header as="span" size="small">
          <TranslatedTag tag="SOUR" />
        </Header>
      </div>
      <Sources sources={sources} />
    </>
  );
}

function fileDetails(objectEntries: GedcomEntry[], gedcom: GedcomData) {
  const files = objectEntries
    .map((objectEntry) =>
      dereference(objectEntry, gedcom, (gedcom) => gedcom.other),
    )
    .map((objectEntry) => getNonImageFileEntry(objectEntry))
    .filter((objectEntry): objectEntry is GedcomEntry => !!objectEntry)
    .map((fileEntry) => ({
      url: fileEntry.data,
      filename: getFileName(fileEntry),
    }));

  if (!files.length) {
    return null;
  }

  return (
    <>
      <div className="item-header">
        <Header as="span" size="small">
          <TranslatedTag tag="OBJE" />
        </Header>
      </div>
      <AdditionalFiles files={files} />
    </>
  );
}

function noteDetails(noteEntryReference: GedcomEntry, gedcom: GedcomData) {
  const noteEntry = dereference(
    noteEntryReference,
    gedcom,
    (gedcom) => gedcom.other,
  );

  if (!noteEntry || !hasData(noteEntry)) {
    return null;
  }

  return (
    <MultilineText
      lines={getData(noteEntry).map((line, index) => (
        <i key={index}>{line}</i>
      ))}
    />
  );
}

function nameDetails(entry: GedcomEntry) {
  const fullName = entry.data.replaceAll('/', '');

  const nameType = entry.tree.find(
    (entry) => entry.tag === 'TYPE' && entry.data !== 'Unknown',
  )?.data;

  return (
    <>
      <Header as="span" size="large">
        {fullName ? (
          fullName
        ) : (
          <FormattedMessage id="name.unknown_name" defaultMessage="N.N." />
        )}
      </Header>
      {fullName && nameType && (
        <Item.Meta>
          <TranslatedTag tag={nameType} />
        </Item.Meta>
      )}
    </>
  );
}

function getSectionForEachMatchingEntry(
  entries: GedcomEntry[],
  gedcom: GedcomData,
  tags: string[],
  detailsFunction: (
    entry: GedcomEntry,
    gedcom: GedcomData,
  ) => React.ReactNode | null,
): React.ReactNode[] {
  return flatMap(tags, (tag) =>
    entries
      .filter((entry) => entry.tag === tag)
      .map((entry) => detailsFunction(entry, gedcom)),
  )
    .filter((element) => element !== null)
    .map((element, index) => (
      <Item key={index}>
        <Item.Content>{element}</Item.Content>
      </Item>
    ));
}

function combineAllMatchingEntriesIntoSingleSection(
  entries: GedcomEntry[],
  gedcom: GedcomData,
  tags: string[],
  detailsFunction: (
    entries: GedcomEntry[],
    gedcom: GedcomData,
  ) => React.ReactNode | null,
): React.ReactNode {
  const entriesWithMatchingTag = flatMap(tags, (tag) =>
    entries.filter((entry) => entry.tag === tag),
  ).filter((element) => element !== null);

  const sectionWithDetails = entriesWithMatchingTag.length
    ? detailsFunction(entriesWithMatchingTag, gedcom)
    : null;

  if (!sectionWithDetails) {
    return null;
  }

  return (
    <Item>
      <Item.Content>{sectionWithDetails}</Item.Content>
    </Item>
  );
}

/**
 * Returns true if there is displayable information in this entry.
 * Returns false if there is no data in this entry or this is only a reference
 * to another entry.
 */
function hasData(entry: GedcomEntry) {
  return entry.tree.length > 0 || (entry.data && !entry.data.startsWith('@'));
}

function getOtherSections(entries: GedcomEntry[], gedcom: GedcomData) {
  return entries
    .filter((entry) => !EXCLUDED_TAGS.includes(entry.tag))
    .map((entry) => dereference(entry, gedcom, (gedcom) => gedcom.other))
    .filter(hasData)
    .map((entry) => dataDetails(entry))
    .filter((element) => element !== null)
    .map((element, index) => (
      <Item key={index}>
        <Item.Content>{element}</Item.Content>
      </Item>
    ));
}

interface Props {
  gedcom: GedcomData;
  indi: string;
}

export function Details(props: Props) {
  const entries = props.gedcom.indis[props.indi].tree;

  return (
    <div className="details">
      <Item.Group divided>
        {getSectionForEachMatchingEntry(
          entries,
          props.gedcom,
          ['NAME'],
          nameDetails,
        )}
        {getSectionForEachMatchingEntry(
          entries,
          props.gedcom,
          ['OBJE'],
          imageDetails,
        )}
        <Events gedcom={props.gedcom} entries={entries} indi={props.indi} />
        {getOtherSections(entries, props.gedcom)}
        {getSectionForEachMatchingEntry(
          entries,
          props.gedcom,
          ['NOTE'],
          noteDetails,
        )}
        {combineAllMatchingEntriesIntoSingleSection(
          entries,
          props.gedcom,
          ['OBJE'],
          fileDetails,
        )}
        {combineAllMatchingEntriesIntoSingleSection(
          entries,
          props.gedcom,
          ['SOUR'],
          sourceDetails,
        )}
      </Item.Group>
    </div>
  );
}
