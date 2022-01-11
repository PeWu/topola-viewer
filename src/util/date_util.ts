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
  const dateObject = toDateObject(date);
  const translatedQualifier = formatDateQualifier(date.qualifier, intl);

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

export function formatDateQualifier(
  qualifier: string | undefined,
  intl: IntlShape,
): string {
  const lowerCaseQualifier = qualifier && qualifier.toLowerCase();
  return (
    (lowerCaseQualifier &&
      intl.formatMessage({
        id: `date.${lowerCaseQualifier}`,
        defaultMessage:
          DATE_QUALIFIERS.get(lowerCaseQualifier) || lowerCaseQualifier,
      })) ||
    ''
  );
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

export function compareTopolaDates(
  date1: TopolaDate | undefined,
  date2: TopolaDate | undefined,
): number {
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

/** Compares a dates given in GEDCOM format. */
export function compareDates(
  firstDateOrRange: DateOrRange | undefined,
  secondDateOrRange: DateOrRange | undefined,
): number {
  const date1 =
    firstDateOrRange &&
    (firstDateOrRange.date ||
      (firstDateOrRange.dateRange &&
        (firstDateOrRange.dateRange.from || firstDateOrRange.dateRange.to)));
  const date2 =
    secondDateOrRange &&
    (secondDateOrRange.date ||
      (secondDateOrRange.dateRange &&
        (secondDateOrRange.dateRange.from || secondDateOrRange.dateRange.to)));
  return compareTopolaDates(date1, date2);
}

export function areDateRangesOverlapped(
  range1: DateRange,
  range2: DateRange,
): boolean {
  return (
    compareTopolaDates(range1.from, range2.to) <= 0 &&
    compareTopolaDates(range1.to, range2.from) >= 0
  );
}

export function isValidDateOrRange(
  dateOrRange: DateOrRange | undefined,
): boolean {
  // invalid when range is closed and start is before end
  if (isDateRangeClosed(dateOrRange?.dateRange)) {
    return (
      compareTopolaDates(
        dateOrRange?.dateRange?.from,
        dateOrRange?.dateRange?.to,
      ) <= 0
    );
  }
  //valid when there is exact date or date range has start or end defined
  return !!(
    dateOrRange?.date ||
    dateOrRange?.dateRange?.from ||
    dateOrRange?.dateRange?.to
  );
}

export function isDateRangeClosed(range: DateRange | undefined): boolean {
  return !!(range?.from && range?.to);
}

export function toDateObject(date: TopolaDate): Date {
  return new Date(
    date.year !== undefined ? date.year! : 0,
    date.month !== undefined ? date.month! - 1 : 0,
    date.day !== undefined ? date.day! : 1,
  );
}
