import {GedcomEntry} from 'parse-gedcom';
import {
  Date,
  DateOrRange,
  JsonEvent,
  JsonFam,
  JsonGedcomData,
  JsonImage,
  JsonIndi,
} from 'topola';
import {isValidDateOrRange} from '../util/date_util';
import {GedcomData} from '../util/gedcom_util';

const MONTHS = new Map<number, string>([
  [1, 'JAN'],
  [2, 'FEB'],
  [3, 'MAR'],
  [4, 'APR'],
  [5, 'MAY'],
  [6, 'JUN'],
  [7, 'JUL'],
  [8, 'AUG'],
  [9, 'SEP'],
  [10, 'OCT'],
  [11, 'NOV'],
  [12, 'DEC'],
]);

function dateToGedcom(date: Date): string {
  return [date.qualifier, date.day, MONTHS.get(date.month!), date.year]
    .filter((x) => x !== undefined)
    .join(' ');
}

function dateOrRangeToGedcom(dateOrRange: DateOrRange): string {
  if (dateOrRange.date) {
    return dateToGedcom(dateOrRange.date);
  }
  if (!dateOrRange.dateRange) {
    return '';
  }
  if (dateOrRange.dateRange.from && dateOrRange.dateRange.to) {
    return `BET ${dateToGedcom(dateOrRange.dateRange.from)} AND ${
      dateOrRange.dateRange.to
    }`;
  }
  if (dateOrRange.dateRange.from) {
    return `AFT ${dateToGedcom(dateOrRange.dateRange.from)}`;
  }
  if (dateOrRange.dateRange.to) {
    return `BEF ${dateToGedcom(dateOrRange.dateRange.to)}`;
  }
  return '';
}

function nameToGedcom(type: string, firstName?: string, lastName?: string) {
  return {
    level: 1,
    pointer: '',
    tag: 'NAME',
    data: `${firstName || ''} /${lastName || ''}/`,
    tree: [
      {
        level: 2,
        pointer: '',
        tag: 'TYPE',
        data: type,
        tree: [],
      },
    ],
  };
}

function eventToGedcom(event: JsonEvent): GedcomEntry[] {
  const result = [];
  if (isValidDateOrRange(event)) {
    result.push({
      level: 2,
      pointer: '',
      tag: 'DATE',
      data: dateOrRangeToGedcom(event),
      tree: [],
    });
  }
  if (event.place) {
    result.push({
      level: 2,
      pointer: '',
      tag: 'PLAC',
      data: event.place,
      tree: [],
    });
  }
  return result;
}

function imageToGedcom(
  image: JsonImage,
  fullSizePhotoUrl: string | undefined,
): GedcomEntry[] {
  return [
    {
      level: 2,
      pointer: '',
      tag: 'FILE',
      data: fullSizePhotoUrl || image.url,
      tree: [
        {
          level: 3,
          pointer: '',
          tag: 'FORM',
          data: image.title?.split('.').pop() || '',
          tree: [],
        },
        {
          level: 3,
          pointer: '',
          tag: 'TITL',
          data: image.title?.split('.')[0] || '',
          tree: [],
        },
      ],
    },
  ];
}

function indiToGedcom(
  indi: JsonIndi,
  fullSizePhotoUrl: Map<string, string>,
  personNames: {birth?: string; married?: string; aka?: string},
): GedcomEntry {
  // WikiTree URLs replace spaces with underscores.
  const escapedId = indi.id.replace(/ /g, '_');
  const record: GedcomEntry = {
    level: 0,
    pointer: `@${indi.id}@`,
    tag: 'INDI',
    data: '',
    tree: [],
  };

  if (personNames.birth) {
    record.tree.push(nameToGedcom('birth', indi.firstName, personNames.birth));
  }
  if (personNames.married) {
    record.tree.push(
      nameToGedcom('married', indi.firstName, personNames.married),
    );
  }
  if (personNames.aka) {
    record.tree.push(nameToGedcom('aka', indi.firstName, personNames.aka));
  }

  if (indi.birth) {
    record.tree.push({
      level: 1,
      pointer: '',
      tag: 'BIRT',
      data: '',
      tree: eventToGedcom(indi.birth),
    });
  }
  if (indi.death) {
    record.tree.push({
      level: 1,
      pointer: '',
      tag: 'DEAT',
      data: '',
      tree: eventToGedcom(indi.death),
    });
  }
  if (indi.famc) {
    record.tree.push({
      level: 1,
      pointer: '',
      tag: 'FAMC',
      data: `@${indi.famc}@`,
      tree: [],
    });
  }
  (indi.fams || []).forEach((fams) =>
    record.tree.push({
      level: 1,
      pointer: '',
      tag: 'FAMS',
      data: `@${fams}@`,
      tree: [],
    }),
  );
  if (!indi.id.startsWith('~')) {
    record.tree.push({
      level: 1,
      pointer: '',
      tag: 'WWW',
      data: `https://www.wikitree.com/wiki/${escapedId}`,
      tree: [],
    });
  }
  (indi.images || []).forEach((image) => {
    record.tree.push({
      level: 1,
      pointer: '',
      tag: 'OBJE',
      data: '',
      tree: imageToGedcom(image, fullSizePhotoUrl.get(indi.id)),
    });
  });
  return record;
}

function famToGedcom(fam: JsonFam): GedcomEntry {
  const record: GedcomEntry = {
    level: 0,
    pointer: `@${fam.id}@`,
    tag: 'FAM',
    data: '',
    tree: [],
  };
  if (fam.wife) {
    record.tree.push({
      level: 1,
      pointer: '',
      tag: 'WIFE',
      data: `@${fam.wife}@`,
      tree: [],
    });
  }
  if (fam.husb) {
    record.tree.push({
      level: 1,
      pointer: '',
      tag: 'HUSB',
      data: `@${fam.husb}@`,
      tree: [],
    });
  }
  (fam.children || []).forEach((child) =>
    record.tree.push({
      level: 1,
      pointer: child,
      tag: 'CHILD',
      data: '',
      tree: [],
    }),
  );
  if (fam.marriage) {
    record.tree.push({
      level: 1,
      pointer: '',
      tag: 'MARR',
      data: '',
      tree: eventToGedcom(fam.marriage),
    });
  }
  return record;
}

/**
 * Creates a GEDCOM structure for the purpose of displaying the details
 * panel.
 */
export function buildGedcom(
  data: JsonGedcomData,
  fullSizePhotoUrls: Map<string, string>,
  personNames: Map<string, {birth?: string; married?: string; aka?: string}>,
): GedcomData {
  const gedcomIndis: {[key: string]: GedcomEntry} = {};
  const gedcomFams: {[key: string]: GedcomEntry} = {};
  data.indis.forEach((indi) => {
    gedcomIndis[indi.id] = indiToGedcom(
      indi,
      fullSizePhotoUrls,
      personNames.get(indi.id) || {},
    );
  });
  data.fams.forEach((fam) => {
    gedcomFams[fam.id] = famToGedcom(fam);
  });

  return {
    head: {level: 0, pointer: '', tag: 'HEAD', data: '', tree: []},
    indis: gedcomIndis,
    fams: gedcomFams,
    other: {},
  };
}
