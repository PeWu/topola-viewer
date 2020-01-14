// WikiTree support is currenlty implemented only as proof of concept.
// It works for a specific id (12082793) and few others.

import md5 from 'md5';
import {loadGedcom} from './load_data';

interface GetAncestorsRequest {
  action: 'getAncestors';
  key: string;
  fields: string;
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

function getFamilyId(id1: number, id2: number) {
  if (id2 > id1) {
    return `${id1}_${id2}`;
  }
  return `${id2}_${id1}`;
}

export async function loadWikiTree(id: string, handleCors: boolean) {
  const firstRelativesData = await wikiTreeGet(
    {
      action: 'getRelatives',
      keys: id,
      getChildren: true,
      getSpouses: true,
    },
    handleCors,
  );

  const spouseIds = Object.values(
    firstRelativesData[0].items[0].person.Spouses,
  ).map((s: any) => s.Id);

  const everyone: any[] = [];

  [id].concat(spouseIds).forEach(async (personId) => {
    const ancestorsData = await wikiTreeGet(
      {
        action: 'getAncestors',
        key: personId,
        fields: '*',
      },
      handleCors,
    );
    const ancestors = ancestorsData[0].ancestors;
    ancestors.forEach((a: any) => everyone.push(a));
  });

  let toFetch = [id];

  while (toFetch.length > 0) {
    const relativesData = await wikiTreeGet(
      {
        action: 'getRelatives',
        keys: toFetch.join(','),
        getChildren: true,
        getSpouses: true,
      },
      handleCors,
    );
    const people = relativesData[0].items.map((x: any) => x.person);
    toFetch = [];
    people.forEach((person: any) => {
      everyone.push(person);
      const spouses = Object.values(person.Spouses);
      spouses.forEach((s) => everyone.push(s));
      const children = Object.values(person.Children);
      const childrenKeys = (children as any[]).map((c) => c.Name);
      childrenKeys.forEach((k) => toFetch.push(k));
    });
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

  everyone.forEach((person: any) => {
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
  everyone.forEach((person: any) => {
    if (converted.has(person.Id)) {
      return;
    }
    converted.add(person.Id);
    gedcomLines.push(`0 @${idToName.get(person.Id)}@ INDI`);
    const firstName = person.FirstName === 'Unknown' ? '' : person.FirstName;
    const lastName = person.LastNameAtBirth === 'Unknown' ? '' : person.LastNameAtBirth;
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
