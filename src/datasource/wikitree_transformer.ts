import {IntlShape} from 'react-intl';
import {
  Date,
  DateOrRange,
  JsonEvent,
  JsonFam,
  JsonImage,
  JsonIndi,
} from 'topola';
import {StringUtils} from 'turbocommons-ts';
import {Person} from 'wikitree-js';
import {PRIVATE_ID_PREFIX} from './wikitree_api';

function getFamilyId(spouse1: number, spouse2: number) {
  if (spouse2 > spouse1) {
    return `${spouse1}_${spouse2}`;
  }
  return `${spouse2}_${spouse1}`;
}

function getFamilies(people: Person[]) {
  // Map from person id to the set of families where they are a spouse.
  const families = new Map<number, Set<string>>();
  people.forEach((person) => {
    if (person.Mother || person.Father) {
      const famId = getFamilyId(person.Mother, person.Father);
      getSet(families, person.Mother).add(famId);
      getSet(families, person.Father).add(famId);
    }
    if (person.Spouses) {
      Object.values(person.Spouses).forEach((spouse) => {
        const famId = getFamilyId(person.Id, spouse.Id);
        getSet(families, person.Id).add(famId);
        getSet(families, spouse.Id).add(famId);
      });
    }
  });
  return families;
}

function getChildren(people: Person[]) {
  // Map from family id to the set of children.
  const children = new Map<string, Set<number>>();

  people.forEach((person) => {
    if (person.Mother || person.Father) {
      const famId = getFamilyId(person.Mother, person.Father);
      getSet(children, famId).add(person.Id);
    }
  });
  return children;
}

function getSpouses(people: Person[]) {
  // Map from famliy id to the spouses.
  const spouses = new Map<
    string,
    {wife?: number; husband?: number; spouse?: Person}
  >();

  people.forEach((person) => {
    if (person.Mother || person.Father) {
      const famId = getFamilyId(person.Mother, person.Father);
      spouses.set(famId, {
        wife: person.Mother || undefined,
        husband: person.Father || undefined,
      });
    }
    if (person.Spouses) {
      Object.values(person.Spouses).forEach((spouse) => {
        const famId = getFamilyId(person.Id, spouse.Id);
        const familySpouses =
          person.Gender === 'Male'
            ? {wife: spouse.Id, husband: person.Id, spouse}
            : {wife: person.Id, husband: spouse.Id, spouse};
        spouses.set(famId, familySpouses);
      });
    }
  });
  return spouses;
}

/**
 * Converts a list of WikiTree Person records into Topola individual records.
 *
 * @param people List of Person records to convert.
 * @param intl Intl shape for localization.
 * @returns List of JsonIndi objects.
 */
export function convertIndis(people: Person[], intl: IntlShape): JsonIndi[] {
  const families = getFamilies(people);
  return people.map((person) => {
    const indi = convertPerson(person, intl);
    indi.fams = Array.from(getSet(families, person.Id));
    return indi;
  });
}

/**
 * Converts relationships of a list of WikiTree Person records into Topola family records.
 *
 * @param people List of Person records to convert.
 * @returns List of JsonFam objects.
 */
export function convertFams(people: Person[]): JsonFam[] {
  // Map from numerical id to human-readable id.
  const idToName = new Map(people.map((person) => [person.Id, person.Name]));
  const children = getChildren(people);
  const spouses = getSpouses(people);
  return Array.from(spouses.entries()).map(([key, value]) => {
    const fam: JsonFam = {
      id: key,
    };
    const wife = value.wife && idToName.get(value.wife);
    if (wife) {
      fam.wife = wife;
    }
    const husband = value.husband && idToName.get(value.husband);
    if (husband) {
      fam.husb = husband;
    }
    fam.children = Array.from(getSet(children, key))
      .map((child) => idToName.get(child))
      .filter((x) => !!x) as string[];
    if (
      value.spouse &&
      ((value.spouse.marriage_date &&
        value.spouse.marriage_date !== '0000-00-00') ||
        value.spouse.marriage_location)
    ) {
      const parsedDate = parseDate(value.spouse.marriage_date);
      fam.marriage = Object.assign({}, parsedDate, {
        place: value.spouse.marriage_location,
      });
    }
    return fam;
  });
}

function extractNames(person: Person, intl: IntlShape): Partial<JsonIndi> {
  const result: Partial<JsonIndi> = {};
  if (person.Name.startsWith(PRIVATE_ID_PREFIX)) {
    result.hideId = true;
    result.firstName = intl.formatMessage({
      id: 'wikitree.private',
      defaultMessage: 'Private',
    });
  }
  if (person.FirstName && person.FirstName !== 'Unknown') {
    result.firstName = person.FirstName;
  } else if (person.RealName && person.RealName !== 'Unknown') {
    result.firstName = person.RealName;
  }
  if (person.LastNameAtBirth !== 'Unknown') {
    result.lastName = person.LastNameAtBirth;
  }
  return result;
}

function extractDates(person: Person): {
  birth?: JsonEvent;
  death?: JsonEvent;
} {
  const result: {birth?: JsonEvent; death?: JsonEvent} = {};
  if (
    (person.BirthDate && person.BirthDate !== '0000-00-00') ||
    person.BirthLocation ||
    person.BirthDateDecade !== 'unknown'
  ) {
    const parsedDate = parseDate(
      person.BirthDate,
      (person.DataStatus && person.DataStatus.BirthDate) || undefined,
    );
    const date = parsedDate || parseDecade(person.BirthDateDecade);
    result.birth = Object.assign({}, date, {place: person.BirthLocation});
  }
  if (
    (person.DeathDate && person.DeathDate !== '0000-00-00') ||
    person.DeathLocation ||
    person.DeathDateDecade !== 'unknown'
  ) {
    const parsedDate = parseDate(
      person.DeathDate,
      (person.DataStatus && person.DataStatus.DeathDate) || undefined,
    );
    const date = parsedDate || parseDecade(person.DeathDateDecade);
    result.death = Object.assign({}, date, {place: person.DeathLocation});
  }
  return result;
}

function extractImages(person: Person): JsonImage[] | undefined {
  if (person.PhotoData) {
    return [
      {
        url: `https://www.wikitree.com${person.PhotoData.url}`,
        title: person.Photo,
      },
    ];
  }
  return undefined;
}

function convertPerson(person: Person, intl: IntlShape): JsonIndi {
  const indi: JsonIndi = Object.assign(
    {id: person.Name},
    extractNames(person, intl),
    extractDates(person),
  );
  if (person.Mother || person.Father) {
    indi.famc = getFamilyId(person.Mother, person.Father);
  }
  if (person.Gender === 'Male') {
    indi.sex = 'M';
  } else if (person.Gender === 'Female') {
    indi.sex = 'F';
  }
  const images = extractImages(person);
  if (images) {
    indi.images = images;
  }
  return indi;
}

function isSimilarName(name1: string, name2: string) {
  return StringUtils.compareSimilarityPercent(name1, name2) >= 75;
}

function getMarriedName(person: Person) {
  if (
    !person.Spouses ||
    person.LastNameCurrent === 'Unknown' ||
    person.LastNameCurrent === person.LastNameAtBirth
  ) {
    return undefined;
  }
  const nameParts = person.LastNameCurrent.split(/[- ,]/);
  // In some languages the same names can differ a bit between genders,
  // so regular equals comparison cannot be used.
  // To verify if spouse has the same name, person name is split to include
  // people with double names, then there is a check if any name part is
  // at least 75% similar to spouse name.
  const matchingNames = Object.entries(person.Spouses)
    .flatMap(([, spousePerson]) => spousePerson.LastNameAtBirth.split(/[- ,]/))
    .some((spousePersonNamePart) =>
      nameParts.some((personNamePart) =>
        isSimilarName(spousePersonNamePart, personNamePart),
      ),
    );
  return matchingNames ? person.LastNameCurrent : undefined;
}

/**
 * Resolves the birth, married, and aka names of a WikiTree Person.
 *
 * @param person The WikiTree Person to resolve names for.
 * @returns Object containing birth, married, and aka names.
 */
export function convertPersonNames(person: Person): {
  birth?: string;
  married?: string;
  aka?: string;
} {
  const birth =
    person.LastNameAtBirth !== 'Unknown' ? person.LastNameAtBirth : undefined;
  const married = getMarriedName(person);
  const aka =
    person.LastNameOther !== 'Unknown' &&
    person.LastNameAtBirth !== person.LastNameOther &&
    person.LastNameCurrent !== person.LastNameOther
      ? person.LastNameOther
      : undefined;
  return {birth, married, aka};
}

function parseDate(date: string, dataStatus?: string): DateOrRange | undefined {
  if (!date) {
    return undefined;
  }
  const matchedDate = date.match(/(\d\d\d\d)-(\d\d)-(\d\d)/);
  if (!matchedDate) {
    return {date: {text: date}};
  }
  const parsedDate: Date = {};
  if (matchedDate[1] !== '0000') {
    parsedDate.year = ~~matchedDate[1];
  }
  if (matchedDate[2] !== '00') {
    parsedDate.month = ~~matchedDate[2];
  }
  if (matchedDate[3] !== '00') {
    parsedDate.day = ~~matchedDate[3];
  }
  if (dataStatus === 'after') {
    return {dateRange: {from: parsedDate}};
  }
  if (dataStatus === 'before') {
    return {dateRange: {to: parsedDate}};
  }
  if (dataStatus === 'guess') {
    parsedDate.qualifier = 'abt';
  }
  return {date: parsedDate};
}

function parseDecade(decade: string): DateOrRange | undefined {
  return decade !== 'unknown' ? {date: {text: decade}} : undefined;
}

function getSet<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
  const set = map.get(key);
  if (set) {
    return set;
  }
  const newSet = new Set<V>();
  map.set(key, newSet);
  return newSet;
}
