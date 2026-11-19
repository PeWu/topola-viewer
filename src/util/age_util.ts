import {IntlShape} from 'react-intl';
import {parseGedcomDate} from 'topola/gedcom';
import {DateOrRange, DateValue} from 'topola/model';
import {
  areDateRangesOverlapped,
  compareDates,
  formatDateQualifier,
  isDateRangeClosed,
  isValidDateOrRange,
  toDateObject,
} from './date_util';

function formatExactAge(
  birthDate: DateValue,
  deathDate: DateValue,
  intl: IntlShape,
): string {
  const ageInYears = calcDateDifferenceInYears(birthDate, deathDate);
  const qualifier = birthDate.qualifier || deathDate.qualifier;
  const translatedQualifier =
    qualifier && formatDateQualifier(qualifier, intl) + ' ';

  return intl.formatMessage(
    {
      id: 'age.exact',
      defaultMessage:
        '{qualifier}{age, plural, =0 {Less than 1 year} one {1 year} other {# years}}',
    },
    {age: ageInYears, qualifier: translatedQualifier},
  );
}

function formatAgeMoreThan(
  birthDate: DateValue,
  deathDate: DateValue,
  intl: IntlShape,
): string {
  const ageInYears = calcDateDifferenceInYears(birthDate, deathDate);
  return intl.formatMessage(
    {
      id: 'age.more',
      defaultMessage:
        'More than {age, plural, =0 {0 years} one {1 year} other {# years}}',
    },
    {age: ageInYears},
  );
}

function formatAgeLessThan(
  birthDate: DateValue,
  deathDate: DateValue,
  intl: IntlShape,
): string {
  const ageInYears = calcDateDifferenceInYears(birthDate, deathDate);
  return intl.formatMessage(
    {
      id: 'age.less',
      defaultMessage:
        'Less than {age, plural, =0 {1 year} one {1 year} other {# years}}',
    },
    {age: ageInYears},
  );
}

function formatAgeBetween(
  birthDateFrom: DateValue,
  birthDateTo: DateValue,
  deathDateFrom: DateValue,
  deathDateTo: DateValue,
  intl: IntlShape,
): string {
  const ageInYearsFrom = calcDateDifferenceInYears(birthDateTo, deathDateFrom);
  const ageInYearsTo = calcDateDifferenceInYears(birthDateFrom, deathDateTo);
  return intl.formatMessage(
    {
      id: 'age.between',
      defaultMessage:
        'Between {ageFrom} and {ageTo, plural, =0 {0 years} one {1 year} other {# years}}',
    },
    {ageFrom: ageInYearsFrom, ageTo: ageInYearsTo},
  );
}

function canCalculateAge(
  birthDate: DateOrRange | undefined,
  deathDate: DateOrRange | undefined,
): boolean {
  if (birthDate && deathDate) {
    // cannot calculate if there is no valid birth or death date
    if (!isValidDateOrRange(birthDate) || !isValidDateOrRange(deathDate)) {
      return false;
    }
    //cannot calculate if death date is before birth date
    if (compareDates(birthDate, deathDate) > 0) {
      return false;
    }
    // cannot calculate if closed date range for birth or death are overlapping
    if (
      birthDate.dateRange &&
      deathDate.dateRange &&
      isDateRangeClosed(birthDate?.dateRange) &&
      isDateRangeClosed(deathDate?.dateRange)
    ) {
      return !areDateRangesOverlapped(birthDate.dateRange, deathDate.dateRange);
    }
    return true;
  }
  return false;
}

function calcDateDifferenceInYears(
  firstDate: DateValue,
  secondDate: DateValue,
): number {
  const firstDateObject = toDateObject(firstDate);
  const secondDateObject = toDateObject(secondDate);

  const startYear = firstDateObject.getUTCFullYear();

  let yearDiff = secondDateObject.getUTCFullYear() - startYear;
  let monthDiff =
    secondDateObject.getUTCMonth() - firstDateObject.getUTCMonth();
  if (monthDiff < 0) {
    yearDiff--;
    monthDiff += 12;
  }
  const dayDiff = secondDateObject.getUTCDate() - firstDateObject.getUTCDate();
  if (dayDiff < 0) {
    if (monthDiff <= 0) {
      yearDiff--;
    }
  }
  return Math.abs(yearDiff);
}

export function calcAge(
  birthGedcomDate: string | undefined,
  deathGedcomDate: string | undefined,
  intl: IntlShape,
): string | undefined {
  if (birthGedcomDate && deathGedcomDate) {
    const birthDateOrRange = parseGedcomDate(birthGedcomDate);
    const deathDateOrRange = parseGedcomDate(deathGedcomDate);
    if (canCalculateAge(birthDateOrRange, deathDateOrRange)) {
      if (birthDateOrRange?.date) {
        if (deathDateOrRange?.date) {
          return formatExactAge(
            birthDateOrRange.date,
            deathDateOrRange.date,
            intl,
          );
        }
        if (
          deathDateOrRange?.dateRange?.from &&
          deathDateOrRange.dateRange?.to
        ) {
          return formatAgeBetween(
            birthDateOrRange.date,
            birthDateOrRange.date,
            deathDateOrRange?.dateRange?.from,
            deathDateOrRange?.dateRange?.to,
            intl,
          );
        }
        if (deathDateOrRange?.dateRange?.from) {
          return formatAgeMoreThan(
            birthDateOrRange.date,
            deathDateOrRange.dateRange?.from,
            intl,
          );
        }
        if (deathDateOrRange?.dateRange?.to) {
          return formatAgeLessThan(
            birthDateOrRange.date,
            deathDateOrRange.dateRange?.to,
            intl,
          );
        }
      }
      if (
        birthDateOrRange?.dateRange?.from &&
        birthDateOrRange?.dateRange?.to
      ) {
        if (deathDateOrRange?.date) {
          return formatAgeBetween(
            birthDateOrRange?.dateRange?.from,
            birthDateOrRange?.dateRange?.to,
            deathDateOrRange?.date,
            deathDateOrRange?.date,
            intl,
          );
        }
        if (
          deathDateOrRange?.dateRange?.from &&
          deathDateOrRange.dateRange?.to
        ) {
          return formatAgeBetween(
            birthDateOrRange?.dateRange?.from,
            birthDateOrRange?.dateRange?.to,
            deathDateOrRange?.dateRange?.from,
            deathDateOrRange?.dateRange?.to,
            intl,
          );
        }
        if (deathDateOrRange?.dateRange?.from) {
          return formatAgeMoreThan(
            birthDateOrRange.dateRange?.to,
            deathDateOrRange.dateRange?.from,
            intl,
          );
        }
        if (deathDateOrRange?.dateRange?.to) {
          return formatAgeLessThan(
            birthDateOrRange.dateRange?.from,
            deathDateOrRange.dateRange?.to,
            intl,
          );
        }
      }
      if (birthDateOrRange?.dateRange?.from) {
        if (deathDateOrRange?.date) {
          return formatAgeLessThan(
            birthDateOrRange.dateRange?.from,
            deathDateOrRange.date,
            intl,
          );
        }
        if (deathDateOrRange?.dateRange?.to) {
          return formatAgeLessThan(
            birthDateOrRange.dateRange?.from,
            deathDateOrRange.dateRange?.to,
            intl,
          );
        }
      }
      if (birthDateOrRange?.dateRange?.to) {
        if (deathDateOrRange?.date) {
          return formatAgeMoreThan(
            birthDateOrRange?.dateRange?.to,
            deathDateOrRange.date,
            intl,
          );
        }
        if (deathDateOrRange?.dateRange?.from) {
          return formatAgeMoreThan(
            birthDateOrRange?.dateRange?.to,
            deathDateOrRange.dateRange?.from,
            intl,
          );
        }
      }
    }
  }
}
