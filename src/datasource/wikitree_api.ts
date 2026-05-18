import {
  clientLogin,
  getLoggedInUserName,
  getPeople,
  getRelatives as getRelativesApi,
  Person,
} from 'wikitree-js';
import {TopolaError} from '../util/error';

const WIKITREE_APP_ID = 'topola-viewer';
/** Prefix for IDs of private individuals. */
export const PRIVATE_ID_PREFIX = '~Private';

const ANCESTORS_GENERATION_LIMIT = 5;
const DESCENDANT_GENERATION_LIMIT = 5;

function getSessionStorageItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch (e) {
    console.warn('Failed to load data from session storage: ' + e);
  }
  return null;
}

function setSessionStorageItem(key: string, value: string) {
  try {
    return sessionStorage.setItem(key, value);
  } catch (e) {
    console.warn('Failed to store data in session storage: ' + e);
  }
}

function getCacheItem<T>(key: string): T | null {
  const cachedData = getSessionStorageItem(key);
  if (cachedData) {
    try {
      return JSON.parse(cachedData) as T;
    } catch (e) {
      console.warn(`Failed to parse cached data for key ${key}: ${e}`);
    }
  }
  return null;
}

function setCacheItem<T>(key: string, value: T): void {
  setSessionStorageItem(key, JSON.stringify(value));
}

function getApiOptions(handleCors: boolean) {
  return Object.assign(
    {appId: WIKITREE_APP_ID},
    handleCors
      ? {
          apiUrl:
            'https://topolaproxy.bieda.it/https://api.wikitree.com/api.php',
        }
      : {},
  );
}

async function getAncestors(
  key: string,
  handleCors: boolean,
): Promise<Person[]> {
  const cacheKey = `wikitree:ancestors:${key}`;
  const cachedData = getCacheItem<Person[]>(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  const result = await getPeople(
    [key],
    {ancestors: ANCESTORS_GENERATION_LIMIT},
    getApiOptions(handleCors),
  );
  setCacheItem(cacheKey, result);
  return result;
}

async function getRelatives(
  keys: string[],
  handleCors: boolean,
): Promise<Person[]> {
  const result: Person[] = [];
  const keysToFetch: string[] = [];
  keys.forEach((key) => {
    const cachedData = getCacheItem<Person>(`wikitree:relatives:${key}`);
    if (cachedData) {
      result.push(cachedData);
    } else {
      keysToFetch.push(key);
    }
  });
  if (keysToFetch.length === 0) {
    return result;
  }
  const response = await getRelativesApi(
    keysToFetch,
    {getChildren: true, getSpouses: true},
    getApiOptions(handleCors),
  );
  if (!response) {
    const id = keysToFetch[0];
    throw new TopolaError(
      'WIKITREE_PROFILE_NOT_FOUND',
      `WikiTree profile ${id} not found`,
      {id},
    );
  }
  response.forEach((person) => {
    setCacheItem(`wikitree:relatives:${person.Name}`, person);
  });
  return result.concat(response);
}

async function logInIfNeeded(
  authcode: string | undefined,
  handleCors: boolean,
) {
  if (!handleCors && !getLoggedInUserName() && authcode) {
    const loginResult = await clientLogin(authcode, {appId: WIKITREE_APP_ID});
    if (loginResult.result === 'Success') {
      sessionStorage.clear();
    }
  }
}

async function getFirstPerson(key: string, handleCors: boolean) {
  const person = (await getRelatives([key], handleCors))[0];
  if (!person?.Name) {
    const id = key;
    throw new TopolaError(
      'WIKITREE_PROFILE_NOT_ACCESSIBLE',
      `WikiTree profile ${id} is not accessible. Try logging in.`,
      {id},
    );
  }
  return person;
}

function getSpouseKeys(person: Person) {
  return Object.values(person.Spouses || {}).map((s) => s.Name);
}

async function getAllAncestors(keys: string[], handleCors: boolean) {
  const ancestors = await Promise.all(
    keys.map((key) => getAncestors(key, handleCors)),
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

  // Adjust private individual ids so that there are no collisions in the case
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

  // Collect private individuals.
  const privateAncestors = ancestors.flat().filter((person) => person.Id < 0);

  return ancestorDetails.concat(privateAncestors);
}

async function getAllDescendants(key: string, handleCors: boolean) {
  const everyone: Person[] = [];

  // Fetch descendants recursively.
  let toFetch = [key];
  let generation = 0;
  while (toFetch.length > 0 && generation <= DESCENDANT_GENERATION_LIMIT) {
    const people = await getRelatives(toFetch, handleCors);
    everyone.push(...people);
    const allSpouses = people.flatMap((person) =>
      Object.values(person.Spouses || {}),
    );
    everyone.push(...allSpouses);
    // Fetch all children.
    toFetch = people.flatMap((person) =>
      Object.values(person.Children || {}).map((c) => c.Name),
    );
    generation++;
  }
  return everyone;
}

/**
 * Loads data from the WikiTree API for a given person key.
 *
 * @param key The WikiTree profile ID to load.
 * @param authcode Optional authentication code.
 * @returns A unique list of WikiTree `Person` records.
 */
export async function loadData(
  key: string,
  authcode?: string,
): Promise<Person[]> {
  // Work around CORS if not in apps.wikitree.com domain.
  const handleCors = window.location.hostname !== 'apps.wikitree.com';

  await logInIfNeeded(authcode, handleCors);

  const firstPerson = await getFirstPerson(key, handleCors);
  const spouseKeys = getSpouseKeys(firstPerson);

  // Fetch the ancestors of the input person and ancestors of his/her spouses.
  const allAncestors = getAllAncestors([key].concat(spouseKeys), handleCors);
  // Fetch descendants and their spouses.
  const allDescendants = getAllDescendants(key, handleCors);

  const everyone: Person[] = [
    ...(await allAncestors),
    ...(await allDescendants),
  ];
  // Make sure the list contains unique elements.
  return Array.from(
    new Map(everyone.map((person) => [person.Id, person])).values(),
  );
}
