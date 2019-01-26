import {gedcomToJson, JsonFam, JsonGedcomData, JsonIndi} from 'topola';

function strcmp(a: string, b: string) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/** Birth date comparator for individuals. */
function birthDatesComparator(gedcom: JsonGedcomData) {
  const idToIndiMap = new Map<string, JsonIndi>();
  gedcom.indis.forEach((indi) => {
    idToIndiMap[indi.id] = indi;
  });

  return (indiId1: string, indiId2: string) => {
    const idComparison = strcmp(indiId1, indiId2);
    const indi1: JsonIndi = idToIndiMap[indiId1];
    const indi2: JsonIndi = idToIndiMap[indiId2];
    const birth1 = indi1 && indi1.birth;
    const birth2 = indi2 && indi2.birth;
    const date1 =
      birth1 && (birth1.date || (birth1.dateRange && birth1.dateRange.from));
    const date2 =
      birth2 && (birth2.date || (birth2.dateRange && birth2.dateRange.from));
    if (!date1 || !date1.year || !date2 || !date2.year) {
      return idComparison;
    }
    if (date1.year !== date2.year) {
      return date1.year - date2.year;
    }
    if (!date1.month || !date2.month) {
      return idComparison;
    }
    if (date1.month !== date2.month) {
      return date1.month - date2.month;
    }
    if (date1.day && date2.day && date1.day !== date2.day) {
      return date1.month - date2.month;
    }
    return idComparison;
  };
}

/**
 * Sorts children by birth date in the given family.
 * Does not modify the input objects.
 */
function sortFamilyChildren(fam: JsonFam, gedcom: JsonGedcomData): JsonFam {
  if (!fam.children) {
    return fam;
  }
  const newChildren = fam.children.sort(birthDatesComparator(gedcom));
  return Object.assign({}, fam, {children: newChildren});
}

/**
 * Sorts children by birth date.
 * Does not modify the input object.
 */
function sortChildren(gedcom: JsonGedcomData): JsonGedcomData {
  const newFams = gedcom.fams.map((fam) => sortFamilyChildren(fam, gedcom));
  return Object.assign({}, gedcom, {fams: newFams});
}

/**
 * Removes images that are not HTTP links.
 * Does not modify the input object.
 */
function filterImage(indi: JsonIndi): JsonIndi {
  if (!indi.imageUrl || indi.imageUrl.startsWith('http')) {
    return indi;
  }
  const newIndi = Object.assign({}, indi);
  delete newIndi.imageUrl;
  return newIndi;
}

/**
 * Removes images that are not HTTP links.
 * Does not modify the input object.
 */
function filterImages(gedcom: JsonGedcomData): JsonGedcomData {
  const newIndis = gedcom.indis.map(filterImage);
  return Object.assign({}, gedcom, {indis: newIndis});
}

/**
 * Converts GEDCOM file into JSON data performing additional transformations:
 * - sort children by birth date
 * - remove images that are not HTTP links.
 */
export function convertGedcom(gedcom: string): JsonGedcomData {
  const json = gedcomToJson(gedcom);
  if (
    !json ||
    !json.indis ||
    !json.indis.length ||
    !json.fams ||
    !json.fams.length
  ) {
    throw new Error('Failed to read GEDCOM file');
  }
  return filterImages(sortChildren(json));
}
