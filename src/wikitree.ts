import {TopolaData, GedcomData} from './gedcom_util';
import {JsonFam, JsonIndi} from 'topola';
import {GedcomEntry} from 'parse-gedcom';

interface GetAncestorsRequest {
  action: 'getAncestors';
  key: string;
  fields: string;
}

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

interface GetRelatives {
  action: 'getRelatives';
  keys: string;
  getChildren?: true;
  getSpouses?: true;
}

type WikiTreeRequest = GetAncestorsRequest | GetRelatives;

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

function getFamilyId(id1: number, id2: number) {
  if (id2 > id1) {
    return `${id1}_${id2}`;
  }
  return `${id2}_${id1}`;
}

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

  // Create a GEDCOM structure only for the purpose of displaying the details
  // panel.
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

  const gedcom: GedcomData = {
    head: {level: 0, pointer: '', tag: 'HEAD', data: '', tree: []},
    indis: gedcomIndis,
    fams: {},
    other: {},
  };

  return {chartData: {indis, fams}, gedcom};
}
