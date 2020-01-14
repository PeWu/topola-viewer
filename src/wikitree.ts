// WikiTree support is currenlty implemented only as proof of concept.
// It works for a specific id (12082793) and few others.

import md5 from 'md5';
import {loadGedcom} from './load_data';

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

export async function loadWikiTree(key: string, handleCors: boolean) {
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

  const gedcomLines: string[] = ['0 HEAD'];
  const converted = new Set<number>();
  everyone.forEach((person) => {
    if (converted.has(person.Id)) {
      return;
    }
    converted.add(person.Id);
    gedcomLines.push(`0 @${idToName.get(person.Id)}@ INDI`);
    const firstName = person.FirstName === 'Unknown' ? '' : person.FirstName;
    const lastName =
      person.LastNameAtBirth === 'Unknown' ? '' : person.LastNameAtBirth;
    gedcomLines.push(`1 NAME ${firstName} /${lastName}/`);
    if (person.Mother || person.Father) {
      gedcomLines.push(`1 FAMC @${getFamilyId(person.Mother, person.Father)}@`);
    }
    // TODO: add to spouses map for each spouse.
    getSet(families, person.Id).forEach((famId) =>
      gedcomLines.push(`1 FAMS @${famId}@`),
    );
  });

  spouses.forEach((value, key) => {
    gedcomLines.push(`0 @${key}@ FAM`);
    const wife = value.wife && idToName.get(value.wife);
    if (wife) {
      gedcomLines.push(`1 WIFE @${wife}@`);
    }
    const husband = value.husband && idToName.get(value.husband);
    if (husband) {
      gedcomLines.push(`1 HUSB @${husband}@`);
    }
    getSet(children, key).forEach((child) => {
      gedcomLines.push(`1 CHIL @${idToName.get(child)}@`);
    });
  });
  gedcomLines.push('0 TRLR');
  const gedcom = gedcomLines.join('\n');

  const hash = md5(gedcom);
  return await loadGedcom(hash, gedcom);
}
