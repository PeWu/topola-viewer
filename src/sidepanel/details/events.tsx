import flatMap from 'array.prototype.flatmap';
import {GedcomEntry} from 'parse-gedcom';
import queryString from 'query-string';
import {FormattedMessage, IntlShape, useIntl} from 'react-intl';
import {Link, useLocation} from 'react-router';
import {Header, Item} from 'semantic-ui-react';
import {DateOrRange, getDate} from 'topola';
import {calcAge} from '../../util/age_util';
import {compareDates, formatDateOrRange} from '../../util/date_util';
import {
  dereference,
  GedcomData,
  getData,
  getFileName,
  getImageFileEntry,
  getName,
  getNonImageFileEntry,
  mapToSource,
  pointerToId,
  resolveDate,
  resolveType,
  Source,
} from '../../util/gedcom_util';
import {FileEntry} from './additional-files';
import {EventExtras, Image} from './event-extras';
import {TranslatedTag} from './translated-tag';

function PersonLink(props: {person: GedcomEntry}) {
  const location = useLocation();

  const name = getName(props.person);

  const search = queryString.parse(location.search);
  search['indi'] = pointerToId(props.person.pointer);

  return (
    <Item.Meta>
      <Link to={{pathname: '/view', search: queryString.stringify(search)}}>
        {name ? (
          name
        ) : (
          <FormattedMessage id="name.unknown_name" defaultMessage="N.N." />
        )}
      </Link>
    </Item.Meta>
  );
}

interface Props {
  gedcom: GedcomData;
  indi: string;
  entries: GedcomEntry[];
}

interface EventData {
  tag: string;
  type?: string;
  date?: DateOrRange;
  age?: string;
  personLink?: GedcomEntry;
  place?: string[];
  images?: Image[];
  files?: FileEntry[];
  notes?: string[][];
  sources?: Source[];
  indi: string;
}

const BIRTH_EVENT_TAGS = ['BIRT'];
const INDI_EVENT_TAGS = [
  'ADOP',
  'BAPM',
  'BARM',
  'BASM',
  'BLES',
  'CENS',
  'CHR',
  'CHRA',
  'CONF',
  'EDUC',
  'EMIG',
  'EVEN',
  'FAMS',
  'FCOM',
  'GRAD',
  'IMMI',
  'NATU',
  'ORDN',
  'OCCU',
  'PROP',
  'RESI',
  'RETI',
  'WILL',
  '_DEG',
  '_ELEC',
  '_MDCL',
  '_MILT',
];

const FAMILY_EVENT_TAGS = [
  'ANUL',
  'CENS',
  'DIV',
  'DIVF',
  'ENGA',
  'EVEN',
  'MARB',
  'MARC',
  'MARL',
  'MARR',
  'MARS',
];
const LIFE_EVENT_TAGS = [...INDI_EVENT_TAGS, ...FAMILY_EVENT_TAGS];
const DEATH_EVENT_TAGS = ['DEAT'];
const AFTER_DEATH_EVENT_TAGS = ['BURI', 'CREM', 'PROB'];
const SORTED_EVENT_TYPE_GROUPS = [
  BIRTH_EVENT_TAGS,
  LIFE_EVENT_TAGS,
  DEATH_EVENT_TAGS,
  AFTER_DEATH_EVENT_TAGS,
];

export const ALL_SUPPORTED_EVENT_TYPES = [
  ...BIRTH_EVENT_TAGS,
  ...LIFE_EVENT_TAGS,
  ...DEATH_EVENT_TAGS,
  ...AFTER_DEATH_EVENT_TAGS,
];

function EventHeader(props: {event: EventData}) {
  const intl = useIntl();
  return (
    <div className="item-header">
      <Header as="span" size="small">
        <TranslatedTag tag={getEventTitle(props.event)} />
      </Header>
      {props.event.date ? (
        <Header as="span" textAlign="right" sub>
          {formatDateOrRange(props.event.date, intl)}
        </Header>
      ) : null}
    </div>
  );
}

function getEventTitle(event: EventData) {
  if (event.tag === 'EVEN' && event.type) {
    return event.type;
  }
  return event.tag;
}

function getSpouse(indi: string, familyEntry: GedcomEntry, gedcom: GedcomData) {
  const spouseReference = familyEntry.tree
    .filter((familySubEntry) => ['WIFE', 'HUSB'].includes(familySubEntry.tag))
    .find((familySubEntry) => !familySubEntry.data.includes(indi));

  if (!spouseReference) {
    return undefined;
  }
  return dereference(spouseReference, gedcom, (gedcom) => gedcom.indis);
}

function getAge(
  eventEntry: GedcomEntry,
  indi: string,
  gedcom: GedcomData,
  intl: IntlShape,
): string | undefined {
  if (!DEATH_EVENT_TAGS.includes(eventEntry.tag)) {
    return undefined;
  }
  const deathDate = resolveDate(eventEntry);

  const birthDate = gedcom.indis[indi].tree
    .filter((indiSubEntry) => BIRTH_EVENT_TAGS.includes(indiSubEntry.tag))
    .map((birthEvent) => resolveDate(birthEvent))
    .find((topolaDate) => topolaDate);

  if (!birthDate || !deathDate) {
    return undefined;
  }
  return calcAge(birthDate?.data, deathDate?.data, intl);
}

function eventPlace(entry: GedcomEntry) {
  const place = entry.tree.find((subEntry) => subEntry.tag === 'PLAC');
  return place?.data ? getData(place) : undefined;
}

function eventImages(entry: GedcomEntry, gedcom: GedcomData): Image[] {
  return entry.tree
    .filter((subEntry) => 'OBJE' === subEntry.tag)
    .map((objectEntry) =>
      dereference(objectEntry, gedcom, (gedcom) => gedcom.other),
    )
    .map((objectEntry) => getImageFileEntry(objectEntry))
    .flatMap((imageFileEntry) =>
      imageFileEntry
        ? [
            {
              url: imageFileEntry?.data || '',
              filename: getFileName(imageFileEntry) || '',
            },
          ]
        : [],
    );
}

function eventFiles(entry: GedcomEntry, gedcom: GedcomData): Image[] {
  return entry.tree
    .filter((subEntry) => 'OBJE' === subEntry.tag)
    .map((objectEntry) =>
      dereference(objectEntry, gedcom, (gedcom) => gedcom.other),
    )
    .map((objectEntry) => getNonImageFileEntry(objectEntry))
    .flatMap((fileEntry) =>
      fileEntry
        ? [
            {
              url: fileEntry?.data || '',
              filename: getFileName(fileEntry) || '',
            },
          ]
        : [],
    );
}

function eventSources(entry: GedcomEntry, gedcom: GedcomData): Source[] {
  return entry.tree
    .filter((subEntry) => 'SOUR' === subEntry.tag)
    .map((sourceEntryReference) => mapToSource(sourceEntryReference, gedcom));
}

function eventNotes(entry: GedcomEntry, gedcom: GedcomData): string[][] {
  const externalNotes = entry.tree
    .filter((subEntry) => subEntry.tag === 'NOTE')
    .map((note) => dereference(note, gedcom, (gedcom) => gedcom.other));

  //for generic 'EVEN' tag 'TYPE is mandatory and is part of the header, for other types it can be worth it to display it as a note
  const type =
    entry.tag !== 'EVEN'
      ? entry.tree.filter((subEntry) => subEntry.tag === 'TYPE')
      : [];

  //entry.data contains event description, so it's also displayed in notes section
  return (
    [entry, ...type, ...externalNotes]
      .filter((entry) => !!entry.data)
      /* In Gedcom 'Y' only indicates event occurred, but it doesn't contain any valuable information
      like place, date or description, so it should be omitted when fetching entry data. */
      .filter((entry) => entry.data !== 'Y')
      .map((note) => getData(note))
  );
}

function toEvent(
  entry: GedcomEntry,
  gedcom: GedcomData,
  indi: string,
  intl: IntlShape,
): EventData[] {
  if (entry.tag === 'FAMS') {
    return toFamilyEvents(entry, gedcom, indi);
  }
  return toIndiEvent(entry, gedcom, indi, intl);
}

function toIndiEvent(
  entry: GedcomEntry,
  gedcom: GedcomData,
  indi: string,
  intl: IntlShape,
): EventData[] {
  const date = resolveDate(entry) || null;
  return [
    {
      tag: entry.tag,
      date: date ? getDate(date.data) : undefined,
      type: resolveType(entry),
      age: getAge(entry, indi, gedcom, intl),
      place: eventPlace(entry),
      images: eventImages(entry, gedcom),
      files: eventFiles(entry, gedcom),
      notes: eventNotes(entry, gedcom),
      sources: eventSources(entry, gedcom),
      indi: indi,
    },
  ];
}

function toFamilyEvents(
  entry: GedcomEntry,
  gedcom: GedcomData,
  indi: string,
): EventData[] {
  const family = dereference(entry, gedcom, (gedcom) => gedcom.fams);
  return flatMap(FAMILY_EVENT_TAGS, (tag) =>
    family.tree.filter((entry) => entry.tag === tag),
  ).map((familyEvent) => {
    const date = resolveDate(familyEvent) || null;
    return {
      tag: familyEvent.tag,
      date: date ? getDate(date.data) : undefined,
      type: resolveType(familyEvent),
      personLink: getSpouse(indi, family, gedcom),
      place: eventPlace(familyEvent),
      images: eventImages(familyEvent, gedcom),
      files: eventFiles(familyEvent, gedcom),
      notes: eventNotes(familyEvent, gedcom),
      sources: eventSources(familyEvent, gedcom),
      indi: indi,
    };
  });
}

function Event(props: {event: EventData}) {
  return (
    <Item>
      <Item.Content>
        <EventHeader event={props.event} />
        {!!props.event.age && <Item.Meta>{props.event.age}</Item.Meta>}
        {!!props.event.personLink && (
          <PersonLink person={props.event.personLink} />
        )}
        {!!props.event.place && (
          <Item.Description>{props.event.place}</Item.Description>
        )}
        <EventExtras
          images={props.event.images}
          notes={props.event.notes}
          sources={props.event.sources}
          indi={props.event.indi}
          files={props.event.files}
        />
      </Item.Content>
    </Item>
  );
}

export function Events(props: Props) {
  const intl = useIntl();

  const events = flatMap(SORTED_EVENT_TYPE_GROUPS, (eventTypeGroup) =>
    props.entries
      .filter((entry) => eventTypeGroup.includes(entry.tag))
      .map((eventEntry) => toEvent(eventEntry, props.gedcom, props.indi, intl))
      .flatMap((events) => events)
      .sort((event1, event2) => compareDates(event1.date, event2.date)),
  );
  if (events.length) {
    return (
      <>
        {events.map((event, index) => (
          <Event event={event} key={index} />
        ))}
      </>
    );
  }
  return null;
}
