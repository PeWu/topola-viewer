import * as React from 'react';
import {injectIntl, IntlShape, WrappedComponentProps} from 'react-intl';
import {dereference, GedcomData, getData} from './util/gedcom_util';
import {GedcomEntry} from 'parse-gedcom';
import {compareDates, translateDate} from './util/date_util';
import {DateOrRange, getDate} from 'topola';
import {TranslatedTag} from './translated-tag';
import {MultilineText} from './multiline-text';
import flatMap from 'array.prototype.flatmap';

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
  entry: GedcomEntry,
  indi: string,
  familyEntry: GedcomEntry,
  gedcom: GedcomData,
) {
  const spouseReference = familyEntry.tree
    .filter((familySubEntry) => ['WIFE', 'HUSB'].includes(familySubEntry.tag))
    .find((familySubEntry) => !familySubEntry.data.includes(indi));

  if (spouseReference) {
    const spouseName = dereference(
      spouseReference,
      gedcom,
      (gedcom) => gedcom.indis,
    )
      .tree.filter((subEntry) => subEntry.tag === 'NAME')
      .find(
        (subEntry) =>
          subEntry.tree.filter(
            (nameEntry) =>
              nameEntry.tag === 'TYPE' && nameEntry.data === 'married',
          ).length === 0,
      );
    if (spouseName) {
      return <div className="meta">{spouseName.data.replaceAll('/', '')}</div>;
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
  const lines = entry.tree
    .filter((subentry) => ['NOTE', 'TYPE'].includes(subentry.tag))
    .map((note) => dereference(note, gedcom, (gedcom) => gedcom.other))
    .map((note) => noteDetails(note));

  if (lines && lines.length) {
    return (
      <div className="description">
        <MultilineText lines={lines} />
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

function getEventDetails(
  entries: GedcomEntry[],
  gedcom: GedcomData,
  indi: string,
  intl: IntlShape,
): JSX.Element | null {
  const events = flatMap(EVENT_TAGS, (tag) =>
    entries
      .filter((entry) => entry.tag === tag)
      .map((eventEntry) => toEvent(eventEntry, gedcom, indi, intl))
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
      subHeader: null,
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
      subHeader: eventFamilyDetails(familyMarriageEvent, indi, family, gedcom),
      place: eventPlace(familyMarriageEvent),
      notes: eventNotes(familyMarriageEvent, gedcom),
    };
  });
}

class EventsComponent extends React.Component<
  Props & WrappedComponentProps,
  {}
> {
  render() {
    return (
      <>
        {getEventDetails(
          this.props.entries,
          this.props.gedcom,
          this.props.indi,
          this.props.intl,
        )}
      </>
    );
  }
}

export const Events = injectIntl(EventsComponent);
