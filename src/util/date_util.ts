import {Date as TopolaDate, DateOrRange, DateRange, getDate} from 'topola';
import {IntlShape} from 'react-intl';

const DATE_QUALIFIERS = new Map([
  ['abt', 'about'],
  ['cal', 'calculated'],
  ['est', 'estimated'],
]);

function formatDate(date: TopolaDate, intl: IntlShape) {
  const hasDay = date.day !== undefined;
  const hasMonth = date.month !== undefined;
  const hasYear = date.year !== undefined;
  if (!hasDay && !hasMonth && !hasYear) {
    return date.text || '';
  }
  const dateObject = new Date(
    hasYear ? date.year! : 0,
    hasMonth ? date.month! - 1 : 0,
    hasDay ? date.day! : 1,
  );

  const qualifier = date.qualifier && date.qualifier.toLowerCase();
  const translatedQualifier =
    qualifier &&
    intl.formatMessage({
      id: `date.${qualifier}`,
      defaultMessage: DATE_QUALIFIERS.get(qualifier) || qualifier,
    });

  const formatOptions: Intl.DateTimeFormatOptions = {
    day: hasDay ? 'numeric' : undefined,
    month: hasMonth ? 'long' : undefined,
    year: hasYear ? 'numeric' : undefined,
  };
  const translatedDate = new Intl.DateTimeFormat(
    intl.locale,
    formatOptions,
  ).format(dateObject);

  return [translatedQualifier, translatedDate].join(' ');
}

function formatDateRage(dateRange: DateRange, intl: IntlShape) {
  const fromDate = dateRange.from;
  const toDate = dateRange.to;
  const translatedFromDate = fromDate && formatDate(fromDate, intl);
  const translatedToDate = toDate && formatDate(toDate, intl);
  if (translatedFromDate && translatedToDate) {
    return intl.formatMessage(
      {
        id: 'date.between',
        defaultMessage: 'between {from} and {to}',
      },
      {from: translatedFromDate, to: translatedToDate},
    );
  }
  if (translatedFromDate) {
    return intl.formatMessage(
      {
        id: 'date.after',
        defaultMessage: 'after {from}',
      },
      {from: translatedFromDate},
    );
  }
  if (translatedToDate) {
    return intl.formatMessage(
      {
        id: 'date.before',
        defaultMessage: 'before {to}',
      },
      {to: translatedToDate},
    );
  }
  return '';
}

/** Formats a DateOrRange object. */
export function formatDateOrRange(
  dateOrRange: DateOrRange | undefined,
  intl: IntlShape,
): string {
  if (!dateOrRange) {
    return '';
  }
  if (dateOrRange.date) {
    return formatDate(dateOrRange.date, intl);
  }
  if (dateOrRange.dateRange) {
    return formatDateRage(dateOrRange.dateRange, intl);
  }
  return '';
}

/** Formats a date given in GEDCOM format. */
export function translateDate(gedcomDate: string, intl: IntlShape): string {
  return formatDateOrRange(getDate(gedcomDate), intl);
}

/** Compares a dates given in GEDCOM format. */
export function compareDates(
  firstDateOrRange: DateOrRange | undefined,
  secondDateOrRange: DateOrRange | undefined,
): number {
  const date1 =
    firstDateOrRange &&
    (firstDateOrRange.date ||
      (firstDateOrRange.dateRange && firstDateOrRange.dateRange.from));
  const date2 =
    secondDateOrRange &&
    (secondDateOrRange.date ||
      (secondDateOrRange.dateRange && secondDateOrRange.dateRange.from));
  if (!date1 || !date1.year || !date2 || !date2.year) {
    return 0;
  }
  if (date1.year !== date2.year) {
    return date1.year - date2.year;
  }
  if (!date1.month || !date2.month) {
    return 0;
  }
  if (date1.month !== date2.month) {
    return date1.month - date2.month;
  }
  if (date1.day && date2.day && date1.day !== date2.day) {
    return date1.month - date2.month;
  }
  return 0;
}
