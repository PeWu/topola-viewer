import * as queryString from 'query-string';
import flatMap from 'array.prototype.flatmap';
import {calcAge} from '../util/age_util';
import {compareDates, translateDate} from '../util/date_util';
import {DateOrRange, getDate} from 'topola';
import {dereference, GedcomData, getData, getName} from '../util/gedcom_util';
import {GedcomEntry} from 'parse-gedcom';
import {IntlShape, useIntl} from 'react-intl';
import {Link, useLocation} from 'react-router-dom';
import {MultilineText} from './multiline-text';
import {pointerToId} from '../util/gedcom_util';
import {TranslatedTag} from './translated-tag';

function PersonLink(props: {person: GedcomEntry}) {
  const location = useLocation();

  const name = getName(props.person);
  if (!name) {
    return <></>;
  }

  const search = queryString.parse(location.search);
  search['indi'] = pointerToId(props.person.pointer);

  return (
    <div className="meta">
      <Link to={{pathname: '/view', search: queryString.stringify(search)}}>
        {name}
      </Link>
    </div>
  );
}

interface Props {
  gedcom: GedcomData;
  indi: string;
  entries: GedcomEntry[];
}

interface Event {
  type: string;
  date: DateOrRange | undefined;
  header: JSX.Element;
  subHeader: JSX.Element | null;
  place: JSX.Element | null;
  notes: JSX.Element | null;
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

function eventHeader(tag: string, date: GedcomEntry | null, intl: IntlShape) {
  return (
    <div>
      <span style={{textTransform: 'uppercase'}} className="ui small header">
        <TranslatedTag tag={tag} />
      </span>
      {date && date.data ? (
        <span className="ui sub header right floated">
          {translateDate(date.data, intl)}
        </span>
      ) : null}
    </div>
  );
}

function eventFamilyDetails(
  indi: string,
  familyEntry: GedcomEntry,
  gedcom: GedcomData,
) {
  const spouseReference = familyEntry.tree
    .filter((familySubEntry) => ['WIFE', 'HUSB'].includes(familySubEntry.tag))
    .find((familySubEntry) => !familySubEntry.data.includes(indi));

  if (spouseReference) {
    const spouse = dereference(
      spouseReference,
      gedcom,
      (gedcom) => gedcom.indis,
    );
    return <PersonLink person={spouse} />;
  }
  return null;
}

function eventAdditionalDetails(
  eventEntry: GedcomEntry,
  indi: string,
  gedcom: GedcomData,
  intl: IntlShape,
) {
  if (eventEntry.tag === 'DEAT') {
    const deathDate = resolveDate(eventEntry);

    const birthDate = gedcom.indis[indi].tree
      .filter((indiSubEntry) => indiSubEntry.tag === 'BIRT')
      .map((birthEvent) => resolveDate(birthEvent))
      .find((topolaDate) => topolaDate);

    if (birthDate && deathDate) {
      return (
        <div className="meta">
          {calcAge(birthDate?.data, deathDate?.data, intl)}
        </div>
      );
    }
  }
  return null;
}

function eventPlace(entry: GedcomEntry) {
  const place = entry.tree.find((subEntry) => subEntry.tag === 'PLAC');
  if (place && place.data) {
    return <div className="description">{getData(place)}</div>;
  }
  return null;
}

function eventNotes(entry: GedcomEntry, gedcom: GedcomData) {
  const notes = entry.tree
    .filter((subentry) => ['NOTE', 'TYPE'].includes(subentry.tag))
    .map((note) => dereference(note, gedcom, (gedcom) => gedcom.other))
    .map((note) => noteDetails(note));

  if (notes && notes.length) {
    return (
      <div className="description">
        {notes.map((note, index) => (
          <div key={index}>{note}</div>
        ))}
      </div>
    );
  }
  return null;
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

function eventDetails(event: Event) {
  return (
    <div className="content">
      {event.header}
      {event.subHeader}
      {event.place}
      {event.notes}
    </div>
  );
}

function toEvent(
  entry: GedcomEntry,
  gedcom: GedcomData,
  indi: string,
  intl: IntlShape,
): Event[] {
  if (entry.tag === 'FAMS') {
    return toFamilyEvents(entry, gedcom, indi, intl);
  }
  return toIndiEvent(entry, gedcom, indi, intl);
}

function toIndiEvent(
  entry: GedcomEntry,
  gedcom: GedcomData,
  indi: string,
  intl: IntlShape,
): Event[] {
  const date = resolveDate(entry) || null;
  return [
    {
      date: date ? getDate(date.data) : undefined,
      type: entry.tag,
      header: eventHeader(entry.tag, date, intl),
      subHeader: eventAdditionalDetails(entry, indi, gedcom, intl),
      place: eventPlace(entry),
      notes: eventNotes(entry, gedcom),
    },
  ];
}

function resolveDate(entry: GedcomEntry) {
  return entry.tree.find((subEntry) => subEntry.tag === 'DATE');
}

function toFamilyEvents(
  entry: GedcomEntry,
  gedcom: GedcomData,
  indi: string,
  intl: IntlShape,
): Event[] {
  const family = dereference(entry, gedcom, (gedcom) => gedcom.fams);
  return flatMap(FAMILY_EVENT_TAGS, (tag) =>
    family.tree.filter((entry) => entry.tag === tag),
  ).map((familyMarriageEvent) => {
    const date = resolveDate(familyMarriageEvent) || null;
    return {
      date: date ? getDate(date.data) : undefined,
      type: familyMarriageEvent.tag,
      header: eventHeader(familyMarriageEvent.tag, date, intl),
      subHeader: eventFamilyDetails(indi, family, gedcom),
      place: eventPlace(familyMarriageEvent),
      notes: eventNotes(familyMarriageEvent, gedcom),
    };
  });
}

export function Events(props: Props) {
  const intl = useIntl();

  const events = flatMap(EVENT_TAGS, (tag) =>
    props.entries
      .filter((entry) => entry.tag === tag)
      .map((eventEntry) => toEvent(eventEntry, props.gedcom, props.indi, intl))
      .flatMap((events) => events)
      .sort((event1, event2) => compareDates(event1.date, event2.date))
      .map((event) => eventDetails(event)),
  );
  if (events && events.length) {
    return (
      <div className="ui segment divided items">
        {events.map((eventElement, index) => (
          <div className="ui attached item" key={index}>
            {eventElement}
          </div>
        ))}
      </div>
    );
  }
  return null;
}
