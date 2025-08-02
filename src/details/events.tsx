import flatMap from 'array.prototype.flatmap';
import {GedcomEntry} from 'parse-gedcom';
import queryString from 'query-string';
import {FormattedMessage, IntlShape, useIntl} from 'react-intl';
import {Link, useLocation} from 'react-router';
import {Header, Item} from 'semantic-ui-react';
import {DateOrRange, getDate} from 'topola';
import {calcAge} from '../util/age_util';
import {compareDates, formatDateOrRange} from '../util/date_util';
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
  Source,
} from '../util/gedcom_util';
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
  type: string;
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

const EVENT_TAGS = [
  'BIRT',
  'BAPM',
  'CHR',
  'FAMS',
  'EVEN',
  'CENS',
  'DEAT',
  'BURI',
];

const FAMILY_EVENT_TAGS = ['MARR', 'DIV'];

function EventHeader(props: {event: EventData}) {
  const intl = useIntl();
  return (
    <div className="item-header">
      <Header as="span" size="small">
        <TranslatedTag tag={props.event.type} />
      </Header>
      {props.event.date ? (
        <Header as="span" textAlign="right" sub>
          {formatDateOrRange(props.event.date, intl)}
        </Header>
      ) : null}
    </div>
  );
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
  if (eventEntry.tag !== 'DEAT') {
    return undefined;
  }
  const deathDate = resolveDate(eventEntry);

  const birthDate = gedcom.indis[indi].tree
    .filter((indiSubEntry) => indiSubEntry.tag === 'BIRT')
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
  return entry.tree
    .filter((subentry) => ['NOTE', 'TYPE'].includes(subentry.tag))
    .map((note) => dereference(note, gedcom, (gedcom) => gedcom.other))
    .map((note) => getData(note));
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
      date: date ? getDate(date.data) : undefined,
      type: entry.tag,
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
  ).map((familyMarriageEvent) => {
    const date = resolveDate(familyMarriageEvent) || null;
    return {
      date: date ? getDate(date.data) : undefined,
      type: familyMarriageEvent.tag,
      personLink: getSpouse(indi, family, gedcom),
      place: eventPlace(familyMarriageEvent),
      images: eventImages(familyMarriageEvent, gedcom),
      files: eventFiles(familyMarriageEvent, gedcom),
      notes: eventNotes(familyMarriageEvent, gedcom),
      sources: eventSources(familyMarriageEvent, gedcom),
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

  const events = flatMap(EVENT_TAGS, (tag) =>
    props.entries
      .filter((entry) => entry.tag === tag)
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
