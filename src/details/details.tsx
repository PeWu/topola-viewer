import flatMap from 'array.prototype.flatmap';
import {
  dereference,
  GedcomData,
  getData,
  getFileName,
  isImageFile,
} from '../util/gedcom_util';
import {Events} from './events';
import {GedcomEntry} from 'parse-gedcom';
import {MultilineText} from './multiline-text';
import {TranslatedTag} from './translated-tag';
import {Header, Item} from 'semantic-ui-react';
import {FormattedMessage} from 'react-intl';
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

function fileDetails(objectEntry: GedcomEntry) {
  const imageFileEntry = objectEntry.tree.find(
    (entry) =>
      entry.tag === 'FILE' &&
      entry.data.startsWith('http') &&
      isImageFile(entry.data),
  );

  return imageFileEntry ? (
    <div className="person-image">
      <WrappedImage
        url={imageFileEntry.data}
        filename={getFileName(imageFileEntry) || ''}
      />
    </div>
  ) : null;
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
      <Item key={index}>
        <Item.Content>{element}</Item.Content>
      </Item>
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
  const entriesWithData = entries
    .map((entry) => dereference(entry, props.gedcom, (gedcom) => gedcom.other))
    .filter(hasData);

  return (
    <div className="details">
      <Item.Group divided>
        {getDetails(entries, ['NAME'], nameDetails)}
        {getDetails(entriesWithData, ['OBJE'], fileDetails)}
        <Events gedcom={props.gedcom} entries={entries} indi={props.indi} />
        {getOtherDetails(entriesWithData)}
        {getDetails(entriesWithData, ['NOTE'], noteDetails)}
      </Item.Group>
    </div>
  );
}
