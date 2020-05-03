import {Date as TopolaDate, DateOrRange, DateRange, getDate} from 'topola';
import {InjectedIntl} from 'react-intl';

const DATE_QUALIFIERS = new Map([
  ['abt', 'about'],
  ['cal', 'calculated'],
  ['est', 'estimated'],
]);

function formatDate(date: TopolaDate, intl: InjectedIntl) {
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

  const formatOptions = {
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

function formatDateRage(dateRange: DateRange, intl: InjectedIntl) {
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
  intl: InjectedIntl,
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
export function translateDate(gedcomDate: string, intl: InjectedIntl): string {
  return formatDateOrRange(getDate(gedcomDate), intl);
}
