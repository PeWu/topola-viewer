import {Text} from '@mantine/core';
import flatMap from 'array.prototype.flatmap';
import {GedcomEntry} from 'parse-gedcom';
import {FormattedMessage} from 'react-intl';
import {
  dereference,
  GedcomData,
  getData,
  getFileName,
  getImageFileEntry,
  getNonImageFileEntry,
  mapToSource,
  resolveFileUrl,
} from '../../util/gedcom_util';
import {Config, Ids} from '../config/config';
import {AdditionalFiles, FileEntry} from './additional-files';
import {ALL_SUPPORTED_EVENT_TYPES, Events} from './events';
import {ImmediateFamily} from './immediate-family';
import {MultilineText} from './multiline-text';
import {Sources} from './sources';
import {TranslatedTag} from './translated-tag';
import {WrappedImage} from './wrapped-image';

const EXCLUDED_TAGS = [
  ...ALL_SUPPORTED_EVENT_TYPES,
  'NAME',
  'SEX',
  'FAMC',
  'FAMS',
  'NOTE',
  'SOUR',
  'FACT',
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
      <Text
        className="sub-header"
        size="xs"
        fw={700}
        tt="uppercase"
        style={{color: 'rgba(0, 0, 0, 0.87)', lineHeight: 1.2}}
      >
        <TranslatedTag tag={entry.tag} />
      </Text>
      <span>
        <MultilineText lines={lines} />
      </span>
    </>
  );
}

function attributeDetails(entry: GedcomEntry) {
  if (!entry.data) {
    return null;
  }

  const attributeName = entry.tree
    .filter((subentry) => subentry.tag === 'TYPE')
    .flatMap((type) => getData(type))
    .join()
    .trim();

  const attributeValue = getData(entry).join(' ').trim();
  if (attributeName) {
    return (
      <>
        <Text
          className="sub-header"
          size="xs"
          fw={700}
          tt="uppercase"
          style={{color: 'rgba(0, 0, 0, 0.87)', lineHeight: 1.2}}
        >
          <TranslatedTag tag={entry.tag} />
        </Text>
        <div>
          <b>{attributeName}</b>: {attributeValue}
        </div>
      </>
    );
  } else {
    return (
      <>
        <Text
          className="sub-header"
          size="xs"
          fw={700}
          tt="uppercase"
          style={{color: 'rgba(0, 0, 0, 0.87)', lineHeight: 1.2}}
        >
          <TranslatedTag tag={entry.tag} />
        </Text>
        <div>{attributeValue}</div>
      </>
    );
  }
}

function imageDetails(
  objectEntryReference: GedcomEntry,
  gedcom: GedcomData,
  images?: Map<string, string>,
) {
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
        url={resolveFileUrl(imageFileEntry.data, images)}
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
        <Text
          span
          className="header"
          fw={700}
          style={{
            fontSize: '15px',
            lineHeight: 1.2857,
            color: 'rgba(0, 0, 0, 0.87)',
          }}
        >
          <TranslatedTag tag="SOUR" />
        </Text>
      </div>
      <Sources sources={sources} />
    </>
  );
}

function fileDetails(
  objectEntries: GedcomEntry[],
  gedcom: GedcomData,
  images?: Map<string, string>,
) {
  const files: FileEntry[] = [];
  objectEntries
    .map((objectEntry) =>
      dereference(objectEntry, gedcom, (gedcom) => gedcom.other),
    )
    .forEach((objectEntry) => {
      const fileEntry = getNonImageFileEntry(objectEntry);
      if (fileEntry) {
        files.push({
          url: resolveFileUrl(fileEntry.data, images),
          filename: getFileName(fileEntry),
          titl: objectEntry.tree.find((entry) => entry.tag === 'TITL')?.data,
        });
      }
    });

  if (!files.length) {
    return null;
  }

  return (
    <>
      <div className="item-header">
        <Text
          span
          className="header"
          fw={700}
          style={{
            fontSize: '15px',
            lineHeight: 1.2857,
            color: 'rgba(0, 0, 0, 0.87)',
          }}
        >
          <TranslatedTag tag="OBJE" />
        </Text>
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
  const prefix = entry.tree.find((entry) => entry.tag === 'NPFX')?.data;
  let given = entry.tree.find((entry) => entry.tag === 'GIVN')?.data;
  let rufname = entry.tree.find((entry) => entry.tag === '_RUFNAME')?.data;
  const nickname = entry.tree.find((entry) => entry.tag === 'NICK')?.data;
  const surnamePrefix = entry.tree.find((entry) => entry.tag === 'SPFX')?.data;
  const surname = entry.tree.find((entry) => entry.tag === 'SURN')?.data;
  const suffix = entry.tree.find((entry) => entry.tag === 'NSFX')?.data;

  // If _RUFNAME is included in GIVN, then replace this part in GIVN with this part in quotation marks,
  // so that this name is not shown twice.
  if (given && rufname && given.includes(rufname)) {
    given = given.replace(rufname, `"${rufname}"`);
    rufname = undefined;
  }

  const fullNameParts = [
    prefix,
    given,
    rufname && `"${rufname}"`,
    nickname && `(${nickname})`,
    surnamePrefix,
    surname,
    suffix,
  ].filter(Boolean);

  const fullName =
    fullNameParts.join(' ').trim() || entry.data.replaceAll('/', '') || '';

  const nameType = entry.tree.find(
    (entry) => entry.tag === 'TYPE' && entry.data !== 'Unknown',
  )?.data;

  return (
    <>
      <Text
        span
        fw={700}
        style={{
          fontSize: '24px',
          lineHeight: 1.2857,
          color: 'rgba(0, 0, 0, 0.87)',
        }}
      >
        {fullName ? (
          fullName
        ) : (
          <FormattedMessage id="name.unknown_name" defaultMessage="N.N." />
        )}
      </Text>
      {fullName && nameType && (
        <div
          style={{
            fontSize: '14px',
            lineHeight: 1,
            color: 'rgba(0, 0, 0, 0.6)',
            margin: '7px 0 0',
          }}
        >
          <TranslatedTag tag={nameType} />
        </div>
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
    images?: Map<string, string>,
  ) => React.ReactNode | null,
  images?: Map<string, string>,
): React.ReactNode[] {
  return flatMap(tags, (tag) =>
    entries
      .filter((entry) => entry.tag === tag)
      .map((entry) => detailsFunction(entry, gedcom, images)),
  )
    .filter((element) => element !== null)
    .map((element, index) => (
      <div className="item" key={index}>
        <div className="content">{element}</div>
      </div>
    ));
}

function combineAllMatchingEntriesIntoSingleSection(
  entries: GedcomEntry[],
  gedcom: GedcomData,
  tags: string[],
  detailsFunction: (
    entries: GedcomEntry[],
    gedcom: GedcomData,
    images?: Map<string, string>,
  ) => React.ReactNode | null,
  images?: Map<string, string>,
): React.ReactNode {
  const entriesWithMatchingTag = flatMap(tags, (tag) =>
    entries.filter((entry) => entry.tag === tag),
  ).filter((element) => element !== null);

  const sectionWithDetails = entriesWithMatchingTag.length
    ? detailsFunction(entriesWithMatchingTag, gedcom, images)
    : null;

  if (!sectionWithDetails) {
    return null;
  }

  return (
    <div className="item">
      <div className="content">{sectionWithDetails}</div>
    </div>
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
      <div className="item" key={index}>
        <div className="content">{element}</div>
      </div>
    ));
}

function getSectionForId(indi: string): React.ReactNode {
  return (
    <div className="item">
      <div className="content">
        <Text
          className="sub-header"
          size="xs"
          fw={700}
          tt="uppercase"
          style={{color: 'rgba(0, 0, 0, 0.87)', lineHeight: 1.2}}
        >
          <FormattedMessage id="config.ids" defaultMessage="Identification" />
        </Text>
        <div>
          <i>{indi}</i>
        </div>
      </div>
    </div>
  );
}

interface Props {
  gedcom: GedcomData;
  indi: string;
  config: Config;
  images?: Map<string, string>;
}

export function Details(props: Props) {
  const entries = props.gedcom.indis[props.indi].tree;

  return (
    <div className="details" data-testid="details">
      <div className="items divided">
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
          props.images,
        )}
        <ImmediateFamily gedcom={props.gedcom} indi={props.indi} />
        <Events
          gedcom={props.gedcom}
          entries={entries}
          indi={props.indi}
          images={props.images}
        />
        {props.config.id === Ids.SHOW ? getSectionForId(props.indi) : null}
        {getSectionForEachMatchingEntry(
          entries,
          props.gedcom,
          ['FACT'],
          attributeDetails,
        )}
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
          props.images,
        )}
        {combineAllMatchingEntriesIntoSingleSection(
          entries,
          props.gedcom,
          ['SOUR'],
          sourceDetails,
        )}
      </div>
    </div>
  );
}
