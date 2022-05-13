import Cookies from 'js-cookie';
import {analyticsEvent} from '../util/analytics';
import {DataSource, DataSourceEnum, SourceSelection} from './data_source';
import {
  Date,
  DateOrRange,
  JsonEvent,
  JsonFam,
  JsonGedcomData,
  JsonImage,
  JsonIndi,
} from 'topola';
import {GedcomData, normalizeGedcom, TopolaData} from '../util/gedcom_util';
import {GedcomEntry} from 'parse-gedcom';
import {IntlShape} from 'react-intl';
import {TopolaError} from '../util/error';
import {isValidDateOrRange} from '../util/date_util';

/** Prefix for IDs of private individuals. */
export const PRIVATE_ID_PREFIX = '~Private';

/**
 * Cookie where the logged in user name is stored. This cookie is shared
 * between apps hosted on apps.wikitree.com.
 */
const USER_NAME_COOKIE = 'wikidb_wtb_UserName';

/** WikiTree API getAncestors request. */
interface GetAncestorsRequest {
  action: 'getAncestors';
  key: string;
  fields: string;
}

/** WikiTree API getRelatives request. */
interface GetRelativesRequest {
  action: 'getRelatives';
  keys: string;
  getChildren?: true;
  getSpouses?: true;
}

/** WikiTree API clientLogin request. */
interface ClientLoginRequest {
  action: 'clientLogin';
  authcode: string;
}

/** WikiTree API clientLogin response. */
interface ClientLoginResponse {
  result: string;
  username: string;
}

type WikiTreeRequest =
  | GetAncestorsRequest
  | GetRelativesRequest
  | ClientLoginRequest;

/** Person structure returned from WikiTree API. */
interface Person {
  Id: number;
  Name: string;
  FirstName: string;
  LastNameAtBirth: string;
  RealName: string;
  Spouses?: {[key: number]: Person};
  Children: {[key: number]: Person};
  Mother: number;
  Father: number;
  Gender: string;
  BirthDate: string;
  DeathDate: string;
  BirthLocation: string;
  DeathLocation: string;
  BirthDateDecade: string;
  DeathDateDecade: string;
  marriage_location: string;
  marriage_date: string;
  DataStatus?: {
    BirthDate: string;
    DeathDate: string;
  };
  Photo: string;
  PhotoData?: {
    path: string;
    url: string;
  };
}

/** Gets item from session storage. Logs exception if one is thrown. */
function getSessionStorageItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch (e) {
    console.warn('Failed to load data from session storage: ' + e);
  }
  return null;
}

/** Sets item in session storage. Logs exception if one is thrown. */
function setSessionStorageItem(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch (e) {
    console.warn('Failed to store data in session storage: ' + e);
  }
}

/** Sends a request to the WikiTree API. Returns the parsed response JSON. */
async function wikiTreeGet(request: WikiTreeRequest, handleCors: boolean) {
  const requestData = new FormData();
  requestData.append('format', 'json');
  for (const key in request) {
    requestData.append(key, request[key]);
  }
  const apiUrl = handleCors
    ? 'https://topola-cors.herokuapp.com/https://api.wikitree.com/api.php'
    : 'https://api.wikitree.com/api.php';
  const response = await window.fetch(apiUrl, {
    method: 'POST',
    body: requestData,
    credentials: handleCors ? undefined : 'include',
  });
  const responseBody = await response.text();
  return JSON.parse(responseBody);
}

/**
 * Retrieves ancestors from WikiTree for the given person ID.
 * Uses sessionStorage for caching responses.
 */
async function getAncestors(
  key: string,
  handleCors: boolean,
): Promise<Person[]> {
  const cacheKey = `wikitree:ancestors:${key}`;
  const cachedData = getSessionStorageItem(cacheKey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }
  const response = await wikiTreeGet(
    {
      action: 'getAncestors',
      key: key,
      fields: '*',
    },
    handleCors,
  );
  const result = response[0].ancestors as Person[];
  setSessionStorageItem(cacheKey, JSON.stringify(result));
  return result;
}

/**
 * Retrieves relatives from WikiTree for the given array of person IDs.
 * Uses sessionStorage for caching responses.
 */
async function getRelatives(
  keys: string[],
  handleCors: boolean,
): Promise<Person[]> {
  const result: Person[] = [];
  const keysToFetch: string[] = [];
  keys.forEach((key) => {
    const cachedData = getSessionStorageItem(`wikitree:relatives:${key}`);
    if (cachedData) {
      result.push(JSON.parse(cachedData));
    } else {
      keysToFetch.push(key);
    }
  });
  if (keysToFetch.length === 0) {
    return result;
  }
  const response = await wikiTreeGet(
    {
      action: 'getRelatives',
      keys: keysToFetch.join(','),
      getChildren: true,
      getSpouses: true,
    },
    handleCors,
  );
  if (response[0].items === null) {
    const id = keysToFetch[0];
    throw new TopolaError(
      'WIKITREE_PROFILE_NOT_FOUND',
      `WikiTree profile ${id} not found`,
      {id},
    );
  }
  const fetchedResults = response[0].items.map(
    (x: {person: Person}) => x.person,
  ) as Person[];
  fetchedResults.forEach((person) => {
    setSessionStorageItem(
      `wikitree:relatives:${person.Name}`,
      JSON.stringify(person),
    );
  });
  return result.concat(fetchedResults);
}

export async function clientLogin(
  authcode: string,
): Promise<ClientLoginResponse> {
  const response = await wikiTreeGet(
    {
      action: 'clientLogin',
      authcode,
    },
    false,
  );
  return response.clientLogin;
}

/**
 * Returns the logged in user name or undefined if not logged in.
 *
 * This is not an authoritative answer. The result of this function relies on
 * the cookies set on the apps.wikitree.com domain under which this application
 * is hosted. The authoritative source of login information is in cookies set on
 * the api.wikitree.com domain.
 */
export function getLoggedInUserName(): string | undefined {
  return Cookies.get(USER_NAME_COOKIE);
}

/**
 * Loads data from WikiTree to populate an hourglass chart starting from the
 * given person ID.
 */
export async function loadWikiTree(
  key: string,
  intl: IntlShape,
  authcode?: string,
): Promise<TopolaData> {
  // Work around CORS if not in apps.wikitree.com domain.
  const handleCors = window.location.hostname !== 'apps.wikitree.com';

  if (!handleCors && !getLoggedInUserName() && authcode) {
    const loginResult = await clientLogin(authcode);
    if (loginResult.result === 'Success') {
      sessionStorage.clear();
      Cookies.set(USER_NAME_COOKIE, loginResult.username);
    }
  }

  const everyone: Person[] = [];

  // Fetch the ancestors of the input person and ancestors of his/her spouses.
  const firstPerson = await getRelatives([key], handleCors);
  if (!firstPerson[0].Name) {
    const id = key;
    throw new TopolaError(
      'WIKITREE_PROFILE_NOT_ACCESSIBLE',
      `WikiTree profile ${id} is not accessible. Try logging in.`,
      {id},
    );
  }

  const spouseKeys = Object.values(firstPerson[0].Spouses || {}).map(
    (s) => s.Name,
  );
  const ancestors = await Promise.all(
    [key]
      .concat(spouseKeys)
      .map((personId) => getAncestors(personId, handleCors)),
  );
  const ancestorKeys = ancestors
    .flat()
    .map((person) => person.Name)
    .filter((key) => !!key);
  const ancestorDetails = await getRelatives(ancestorKeys, handleCors);

  // Map from person id to father id if the father profile is private.
  const privateFathers: Map<number, number> = new Map();
  // Map from person id to mother id if the mother profile is private.
  const privateMothers: Map<number, number> = new Map();

  // Andujst private individual ids so that there are no collisions in the case
  // that ancestors were collected for more than one person.
  ancestors.forEach((ancestorList, index) => {
    const offset = 1000 * index;
    // Adjust ids by offset.
    ancestorList.forEach((person) => {
      if (person.Id < 0) {
        person.Id -= offset;
        person.Name = `${PRIVATE_ID_PREFIX}${person.Id}`;
      }
      if (person.Father < 0) {
        person.Father -= offset;
        privateFathers.set(person.Id, person.Father);
      }
      if (person.Mother < 0) {
        person.Mother -= offset;
        privateMothers.set(person.Id, person.Mother);
      }
    });
  });

  // Set the Father and Mother fields again because getRelatives doesn't return
  // private parents.
  ancestorDetails.forEach((person) => {
    const privateFather = privateFathers.get(person.Id);
    if (privateFather) {
      person.Father = privateFather;
    }
    const privateMother = privateMothers.get(person.Id);
    if (privateMother) {
      person.Mother = privateMother;
    }
  });
  everyone.push(...ancestorDetails);

  // Collect private individuals.
  const privateAncestors = ancestors.flat().filter((person) => person.Id < 0);
  everyone.push(...privateAncestors);

  // Limit the number of generations of descendants because there may be tens of
  // generations for some profiles.
  const descendantGenerationLimit = 5;

  // Fetch descendants recursively.
  let toFetch = [key];
  let generation = 0;
  while (toFetch.length > 0 && generation <= descendantGenerationLimit) {
    const people = await getRelatives(toFetch, handleCors);
    everyone.push(...people);
    const allSpouses = people.flatMap((person) =>
      Object.values(person.Spouses || {}),
    );
    everyone.push(...allSpouses);
    // Fetch all children.
    toFetch = people.flatMap((person) =>
      Object.values(person.Children).map((c) => c.Name),
    );
    generation++;
  }

  // Map from person id to the set of families where they are a spouse.
  const families = new Map<number, Set<string>>();
  // Map from family id to the set of children.
  const children = new Map<string, Set<number>>();
  // Map from famliy id to the spouses.
  const spouses = new Map<
    string,
    {wife?: number; husband?: number; spouse?: Person}
  >();
  // Map from numerical id to human-readable id.
  const idToName = new Map<number, string>();
  // Map from human-readable person id to fullSizeUrl of person photo.
  const fullSizePhotoUrls: Map<string, string> = new Map();

  everyone.forEach((person) => {
    idToName.set(person.Id, person.Name);
    if (person.Mother || person.Father) {
      const famId = getFamilyId(person.Mother, person.Father);
      getSet(families, person.Mother).add(famId);
      getSet(families, person.Father).add(famId);
      getSet(children, famId).add(person.Id);
      spouses.set(famId, {
        wife: person.Mother || undefined,
        husband: person.Father || undefined,
      });
    }
  });

  const indis: JsonIndi[] = [];

  const converted = new Set<number>();
  everyone.forEach((person) => {
    if (converted.has(person.Id)) {
      return;
    }
    converted.add(person.Id);
    const indi = convertPerson(person, intl);
    if (person.PhotoData?.path) {
      fullSizePhotoUrls.set(
        person.Name,
        `https://www.wikitree.com${person.PhotoData.path}`,
      );
    }
    if (person.Spouses) {
      Object.values(person.Spouses).forEach((spouse) => {
        const famId = getFamilyId(person.Id, spouse.Id);
        getSet(families, person.Id).add(famId);
        getSet(families, spouse.Id).add(famId);
        const familySpouses =
          person.Gender === 'Male'
            ? {wife: spouse.Id, husband: person.Id, spouse}
            : {wife: person.Id, husband: spouse.Id, spouse};
        spouses.set(famId, familySpouses);
      });
    }
    indi.fams = Array.from(getSet(families, person.Id));
    indis.push(indi);
  });

  const fams = Array.from(spouses.entries()).map(([key, value]) => {
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
    fam.children = Array.from(getSet(children, key)).map(
      (child) => idToName.get(child)!,
    );
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

  const chartData = normalizeGedcom({indis, fams});
  const gedcom = buildGedcom(chartData, fullSizePhotoUrls);
  return {chartData, gedcom};
}

/** Creates a family identifier given 2 spouse identifiers. */
function getFamilyId(spouse1: number, spouse2: number) {
  if (spouse2 > spouse1) {
    return `${spouse1}_${spouse2}`;
  }
  return `${spouse2}_${spouse1}`;
}

function convertPerson(person: Person, intl: IntlShape): JsonIndi {
  const indi: JsonIndi = {
    id: person.Name,
  };
  if (person.Name.startsWith(PRIVATE_ID_PREFIX)) {
    indi.hideId = true;
    indi.firstName = intl.formatMessage({
      id: 'wikitree.private',
      defaultMessage: 'Private',
    });
  }
  if (person.FirstName && person.FirstName !== 'Unknown') {
    indi.firstName = person.FirstName;
  } else if (person.RealName && person.RealName !== 'Unknown') {
    indi.firstName = person.RealName;
  }
  if (person.LastNameAtBirth !== 'Unknown') {
    indi.lastName = person.LastNameAtBirth;
  }
  if (person.Mother || person.Father) {
    indi.famc = getFamilyId(person.Mother, person.Father);
  }
  if (person.Gender === 'Male') {
    indi.sex = 'M';
  } else if (person.Gender === 'Female') {
    indi.sex = 'F';
  }
  if (
    (person.BirthDate && person.BirthDate !== '0000-00-00') ||
    person.BirthLocation ||
    person.BirthDateDecade !== 'unknown'
  ) {
    const parsedDate = parseDate(
      person.BirthDate,
      person.DataStatus && person.DataStatus.BirthDate,
    );
    const date = parsedDate || parseDecade(person.BirthDateDecade);
    indi.birth = Object.assign({}, date, {place: person.BirthLocation});
  }
  if (
    (person.DeathDate && person.DeathDate !== '0000-00-00') ||
    person.DeathLocation ||
    person.DeathDateDecade !== 'unknown'
  ) {
    const parsedDate = parseDate(
      person.DeathDate,
      person.DataStatus && person.DataStatus.DeathDate,
    );
    const date = parsedDate || parseDecade(person.DeathDateDecade);
    indi.death = Object.assign({}, date, {place: person.DeathLocation});
  }
  if (person.PhotoData) {
    indi.images = [
      {
        url: `https://www.wikitree.com${person.PhotoData.url}`,
        title: person.Photo,
      },
    ];
  }
  return indi;
}

/**
 * Parses a date in the format returned by WikiTree and converts in to
 * the format defined by Topola.
 */
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
): GedcomEntry {
  // WikiTree URLs replace spaces with underscores.
  const escapedId = indi.id.replace(/ /g, '_');
  const record: GedcomEntry = {
    level: 0,
    pointer: `@${indi.id}@`,
    tag: 'INDI',
    data: '',
    tree: [
      {
        level: 1,
        pointer: '',
        tag: 'NAME',
        data: `${indi.firstName || ''} /${indi.lastName || ''}/`,
        tree: [],
      },
    ],
  };
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
function buildGedcom(
  data: JsonGedcomData,
  fullSizePhotoUrls: Map<string, string>,
): GedcomData {
  const gedcomIndis: {[key: string]: GedcomEntry} = {};
  const gedcomFams: {[key: string]: GedcomEntry} = {};
  data.indis.forEach((indi) => {
    gedcomIndis[indi.id] = indiToGedcom(indi, fullSizePhotoUrls);
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

/**
 * Returns a set which is a value from a SetMultimap. If the key doesn't exist,
 * an empty set is added to the map.
 */
function getSet<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
  const set = map.get(key);
  if (set) {
    return set;
  }
  const newSet = new Set<V>();
  map.set(key, newSet);
  return newSet;
}

export interface WikiTreeSourceSpec {
  source: DataSourceEnum.WIKITREE;
  authcode?: string;
}

/** Loading data from the WikiTree API. */
export class WikiTreeDataSource implements DataSource<WikiTreeSourceSpec> {
  constructor(private intl: IntlShape) {}

  isNewData(
    newSource: SourceSelection<WikiTreeSourceSpec>,
    oldSource: SourceSelection<WikiTreeSourceSpec>,
    data?: TopolaData,
  ): boolean {
    if (!newSource.selection) {
      return false;
    }
    if (oldSource.selection?.id === newSource.selection.id) {
      // Selection unchanged -> don't reload.
      return false;
    }
    if (
      data &&
      data.chartData.indis.some((indi) => indi.id === newSource.selection?.id)
    ) {
      // New selection exists in current view -> animate instead of reloading.
      return false;
    }
    return true;
  }

  async loadData(
    source: SourceSelection<WikiTreeSourceSpec>,
  ): Promise<TopolaData> {
    if (!source.selection) {
      throw new TopolaError(
        'WIKITREE_ID_NOT_PROVIDED',
        'WikiTree id needs to be provided',
      );
    }
    try {
      const data = await loadWikiTree(
        source.selection.id,
        this.intl,
        source.spec.authcode,
      );
      analyticsEvent('wikitree_loaded');
      return data;
    } catch (error) {
      analyticsEvent('wikitree_error');
      throw error;
    }
  }
}
