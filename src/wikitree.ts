import {TopolaData, GedcomData} from './gedcom_util';
import {JsonFam, JsonIndi} from 'topola';
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

type WikiTreeRequest = GetAncestorsRequest | GetRelatives;

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

/** Retrieves ancestors from WikiTree for the given person ID. */
async function getAncestors(key: string, handleCors: boolean) {
  const response = await wikiTreeGet(
    {
      action: 'getAncestors',
      key: key,
      fields: '*',
    },
    handleCors,
  );
  return response[0].ancestors as Person[];
}

/** Retrieves relatives from WikiTree for the given array of person IDs. */
async function getRelatives(keys: string[], handleCors: boolean) {
  const response = await wikiTreeGet(
    {
      action: 'getRelatives',
      keys: keys.join(','),
      getChildren: true,
      getSpouses: true,
    },
    handleCors,
  );
  return response[0].items.map((x: {person: Person}) => x.person) as Person[];
}

/** Creates a family identifier given 2 spouse identifiers. */
function getFamilyId(spouse1: number, spouse2: number) {
  if (spouse2 > spouse1) {
    return `${spouse1}_${spouse2}`;
  }
  return `${spouse2}_${spouse1}`;
}

/**
 * Loads data from WikiTree to populate an hourglass chart starting from the
 * given person ID.
 */
export async function loadWikiTree(
  key: string,
  handleCors: boolean,
): Promise<TopolaData> {
  const everyone: Person[] = [];

  // Fetch the ancestors of the input person and ancestors of his/her spouses.
  const firstPerson = await getRelatives([key], handleCors);
  const spouseKeys = Object.values(firstPerson[0].Spouses).map((s) => s.Name);
  [key].concat(spouseKeys).forEach(async (personId) => {
    const ancestors = await getAncestors(personId, handleCors);
    everyone.push(...ancestors);
  });

  let toFetch = [key];
  while (toFetch.length > 0) {
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
  }

  // Map from person id to the set of families where they are a spouse.
  const families = new Map<number, Set<string>>();
  const children = new Map<string, Set<number>>();
  const spouses = new Map<string, {wife?: number; husband?: number}>();
  function getSet<K, V>(map: Map<K, Set<V>>, id: K): Set<V> {
    const set = map.get(id);
    if (set) {
      return set;
    }
    const newSet = new Set<V>();
    map.set(id, newSet);
    return newSet;
  }

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
    const indi: JsonIndi = {
      id: idToName.get(person.Id)!,
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
    // TODO: add to spouses map for each spouse.
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
    return fam;
  });

  const gedcom = buildGedcom(indis);
  return {chartData: {indis, fams}, gedcom};
}


/**
 * Creates a GEDCOM structure for the purpose of displaying the details
 * panel.
 */
function buildGedcom(indis: JsonIndi[]): GedcomData {
  const gedcomIndis: {[key: string]: GedcomEntry} = {};
  indis.forEach((indi) => {
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
          data: `${indi.firstName} /${indi.lastName}/`,
          tree: [],
        },
        {
          level: 1,
          pointer: '',
          tag: 'WWW',
          data: `https://www.wikitree.com/wiki/${indi.id}`,
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
