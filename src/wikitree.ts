import Cookies from 'js-cookie';
import {Date, JsonFam, JsonIndi} from 'topola';
import {GedcomData, TopolaData} from './gedcom_util';
import {GedcomEntry} from 'parse-gedcom';

/** WikiTree API getAncestors request. */
interface GetAncestorsRequest {
  action: 'getAncestors';
  key: string;
  fields: string;
}

/** WikiTree API getRelatives request. */
interface GetRelatives {
  action: 'getRelatives';
  keys: string;
  getChildren?: true;
  getSpouses?: true;
}

interface ClientLogin {
  action: 'clientLogin';
  authcode: string;
}

type WikiTreeRequest = GetAncestorsRequest | GetRelatives | ClientLogin;

/** Person structure returned from WikiTree API. */
interface Person {
  Id: number;
  Name: string;
  FirstName: string;
  LastNameAtBirth: string;
  Spouses: {[key: number]: Person};
  Children: {[key: number]: Person};
  Mother: number;
  Father: number;
  Gender: string;
  BirthDate: string;
  DeathDate: string;
  BirthLocation: string;
  DeathLocation: string;
  marriage_location: string;
  marriage_date: string;
  DataStatus?: {
    BirthDate: string;
    DeathDate: string;
  };
  PhotoData?: {
    path: string;
  };
}

/** Sends a request to the WikiTree API. Returns the parsed response JSON. */
async function wikiTreeGet(request: WikiTreeRequest, handleCors: boolean) {
  const requestData = new FormData();
  requestData.append('format', 'json');
  for (const key in request) {
    requestData.append(key, request[key]);
  }
  const apiUrl = handleCors
    ? 'https://cors-anywhere.herokuapp.com/https://apps.wikitree.com/api.php'
    : 'https://apps.wikitree.com/api.php';
  const response = await window.fetch(apiUrl, {
    method: 'POST',
    body: requestData,
  });
  const responseBody = await response.text();
  return JSON.parse(responseBody);
}

/**
 * Retrieves ancestors from WikiTree for the given person ID.
 * Uses sessionStorage for caching responses.
 */
async function getAncestors(key: string, handleCors: boolean) {
  const cacheKey = `wikitree:ancestors:${key}`;
  const cachedData = sessionStorage.getItem(cacheKey);
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
  sessionStorage.setItem(cacheKey, JSON.stringify(result));
  return result;
}

/**
 * Retrieves relatives from WikiTree for the given array of person IDs.
 * Uses sessionStorage for caching responses.
 */
async function getRelatives(keys: string[], handleCors: boolean) {
  const result: Person[] = [];
  const keysToFetch: string[] = [];
  keys.forEach((key) => {
    const cachedData = sessionStorage.getItem(`wikitree:relatives:${key}`);
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
    throw new Error(`WikiTree profile ${keysToFetch[0]} not found.`);
  }
  const fetchedResults = response[0].items.map(
    (x: {person: Person}) => x.person,
  ) as Person[];
  fetchedResults.forEach((person) => {
    sessionStorage.setItem(
      `wikitree:relatives:${person.Name}`,
      JSON.stringify(person),
    );
  });
  return result.concat(fetchedResults);
}

export async function clientLogin(authcode: string) {
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
 * Loads data from WikiTree to populate an hourglass chart starting from the
 * given person ID.
 */
export async function loadWikiTree(
  key: string,
  authcode?: string,
): Promise<TopolaData> {
  // Work around CORS if not in apps.wikitree.com domain.
  const handleCors = window.location.hostname !== 'apps.wikitree.com';

  if (!handleCors && !Cookies.get('wikidb_wtb_UserID') && authcode) {
    const loginResult = await clientLogin(authcode);
    if (loginResult.result === 'Success') {
      sessionStorage.clear();
    }
  }

  const everyone: Person[] = [];

  // Fetch the ancestors of the input person and ancestors of his/her spouses.
  const firstPerson = await getRelatives([key], handleCors);
  if (!firstPerson[0].Name) {
    throw new Error(
      `WikiTree profile ${key} is not accessible. Try logging in.`,
    );
  }

  const spouseKeys = Object.values(firstPerson[0].Spouses).map((s) => s.Name);
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
  everyone.push(...ancestorDetails);

  // Limit the number of generations of descendants because there may be tens of
  // generations for some profiles.
  const descendantGenerationLimit = 10;

  // Fetch descendants recursively.
  let toFetch = [key];
  let generation = 0;
  while (toFetch.length > 0 && generation <= descendantGenerationLimit) {
    const people = await getRelatives(toFetch, handleCors);
    everyone.push(...people);
    const allSpouses = people.flatMap((person) =>
      Object.values(person.Spouses),
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
    const indi = convertPerson(person);
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

  const gedcom = buildGedcom(indis);
  return {chartData: {indis, fams}, gedcom};
}

/** Creates a family identifier given 2 spouse identifiers. */
function getFamilyId(spouse1: number, spouse2: number) {
  if (spouse2 > spouse1) {
    return `${spouse1}_${spouse2}`;
  }
  return `${spouse2}_${spouse1}`;
}

function convertPerson(person: Person): JsonIndi {
  const indi: JsonIndi = {
    id: person.Name,
  };
  if (person.FirstName !== 'Unknown') {
    indi.firstName = person.FirstName;
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
    (person.BirthDate && person.DeathDate !== '0000-00-00') ||
    person.BirthLocation
  ) {
    const parsedDate = parseDate(
      person.BirthDate,
      person.DataStatus && person.DataStatus.BirthDate,
    );
    indi.birth = Object.assign({}, parsedDate, {place: person.BirthLocation});
  }
  if (
    (person.DeathDate && person.DeathDate !== '0000-00-00') ||
    person.DeathLocation
  ) {
    const parsedDate = parseDate(
      person.DeathDate,
      person.DataStatus && person.DataStatus.DeathDate,
    );
    indi.death = Object.assign({}, parsedDate, {place: person.DeathLocation});
  }
  if (person.PhotoData) {
    indi.images = [{url: `https://wikitree.com${person.PhotoData.path}`}];
  }
  return indi;
}

/**
 * Parses a date in the format returned by WikiTree and converts in to
 * the format defined by Topola.
 */
function parseDate(date: string, dataStatus?: string) {
  if (!date) {
    return undefined;
  }
  const matchedDate = date.match(/(\d\d\d\d)-(\d\d)-(\d\d)/);
  if (!matchedDate) {
    return {text: date};
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
    return {dataRange: {from: parsedDate}};
  }
  if (dataStatus === 'before') {
    return {dataRange: {to: parsedDate}};
  }
  if (dataStatus === 'guess') {
    parsedDate.qualifier = 'abt';
  }
  return {date: parsedDate};
}

/**
 * Creates a GEDCOM structure for the purpose of displaying the details
 * panel.
 */
function buildGedcom(indis: JsonIndi[]): GedcomData {
  const gedcomIndis: {[key: string]: GedcomEntry} = {};
  indis.forEach((indi) => {
    // WikiTree URLs replace spaces with underscores.
    const escapedId = indi.id.replace(' ', '_');
    gedcomIndis[indi.id] = {
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
        {
          level: 1,
          pointer: '',
          tag: 'WWW',
          data: `https://www.wikitree.com/wiki/${escapedId}`,
          tree: [],
        },
      ],
    };
  });

  return {
    head: {level: 0, pointer: '', tag: 'HEAD', data: '', tree: []},
    indis: gedcomIndis,
    fams: {},
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
