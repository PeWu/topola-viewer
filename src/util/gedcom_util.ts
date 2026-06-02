import {GedcomEntry, parse as parseGedcom} from 'parse-gedcom';
import {
  DateOrRange,
  gedcomEntriesToJson,
  getDate,
  JsonFam,
  JsonGedcomData,
  JsonImage,
  JsonIndi,
} from 'topola';
import {compareDates} from './date_util';
import {TopolaError} from './error';

export interface GedcomData {
  /** The HEAD entry. */
  head?: GedcomEntry;
  /** INDI entries mapped by id. */
  indis: {[key: string]: GedcomEntry};
  /** FAM entries mapped by id. */
  fams: {[key: string]: GedcomEntry};
  /** Other entries mapped by id, e.g. NOTE, SOUR. */
  other: {[key: string]: GedcomEntry};
}

export interface TopolaData {
  chartData: JsonGedcomData;
  gedcom: GedcomData;
  images?: Map<string, string>;
}

export interface Source {
  title?: string;
  author?: string;
  page?: string;
  date?: DateOrRange;
  publicationInfo?: string;
}

/**
 * Returns the identifier extracted from a pointer string.
 * E.g. '@I123@' -> 'I123'
 */
export function pointerToId(pointer: string): string {
  return pointer.substring(1, pointer.length - 1);
}

/** Returns a map from individual ID to individual data object. */
export function idToIndiMap(data: JsonGedcomData): Map<string, JsonIndi> {
  const map = new Map<string, JsonIndi>();
  data.indis.forEach((indi) => {
    map.set(indi.id, indi);
  });
  return map;
}

/** Returns a map from family ID to family data object. */
export function idToFamMap(data: JsonGedcomData): Map<string, JsonFam> {
  const map = new Map<string, JsonFam>();
  data.fams.forEach((fam) => {
    map.set(fam.id, fam);
  });
  return map;
}

function prepareGedcom(entries: GedcomEntry[]): GedcomData {
  const head = entries.find((entry) => entry.tag === 'HEAD');
  const indis: {[key: string]: GedcomEntry} = {};
  const fams: {[key: string]: GedcomEntry} = {};
  const other: {[key: string]: GedcomEntry} = {};
  entries.forEach((entry) => {
    if (entry.tag === 'INDI') {
      indis[pointerToId(entry.pointer)] = entry;
    } else if (entry.tag === 'FAM') {
      fams[pointerToId(entry.pointer)] = entry;
    } else if (entry.pointer) {
      other[pointerToId(entry.pointer)] = entry;
    }
  });
  return {head, indis, fams, other};
}

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
  const indiMap = idToIndiMap(gedcom);

  return (indiId1: string, indiId2: string) => {
    const indi1: JsonIndi | undefined = indiMap.get(indiId1);
    const indi2: JsonIndi | undefined = indiMap.get(indiId2);
    return (
      compareDates(indi1 && indi1.birth, indi2 && indi2.birth) ||
      strcmp(indiId1, indiId2)
    );
  };
}

/** Marriage date comparator for families. */
function marriageDatesComparator(gedcom: JsonGedcomData) {
  const famMap = idToFamMap(gedcom);

  return (famId1: string, famId2: string) => {
    const fam1: JsonFam | undefined = famMap.get(famId1);
    const fam2: JsonFam | undefined = famMap.get(famId2);
    return (
      compareDates(fam1 && fam1.marriage, fam2 && fam2.marriage) ||
      strcmp(famId1, famId2)
    );
  };
}

/**
 * Sorts children by birth date in the given family.
 * Does not modify the input objects.
 */
function sortFamilyChildren(
  fam: JsonFam,
  comparator: (id1: string, id2: string) => number,
): JsonFam {
  if (!fam.children) {
    return fam;
  }
  const newChildren = fam.children.sort(comparator);
  return Object.assign({}, fam, {children: newChildren});
}

/**
 * Sorts children by birth date.
 * Does not modify the input object.
 */
function sortChildren(gedcom: JsonGedcomData): JsonGedcomData {
  const comparator = birthDatesComparator(gedcom);
  const newFams = gedcom.fams.map((fam) => sortFamilyChildren(fam, comparator));
  return Object.assign({}, gedcom, {fams: newFams});
}

/**
 * Sorts spouses by marriage date.
 * Does not modify the input objects.
 */
function sortIndiSpouses(
  indi: JsonIndi,
  comparator: (id1: string, id2: string) => number,
): JsonFam {
  if (!indi.fams) {
    return indi;
  }
  const newFams = indi.fams.sort(comparator);
  return Object.assign({}, indi, {fams: newFams});
}

function sortSpouses(gedcom: JsonGedcomData): JsonGedcomData {
  const comparator = marriageDatesComparator(gedcom);
  const newIndis = gedcom.indis.map((indi) =>
    sortIndiSpouses(indi, comparator),
  );
  return Object.assign({}, gedcom, {indis: newIndis});
}

/**
 * If the entry is a reference to a top-level entry, the referenced entry is
 * returned. Otherwise, returns the given entry unmodified.
 */
export function dereference(
  entry: GedcomEntry,
  gedcom: GedcomData,
  getterFunction: (gedcom: GedcomData) => {[key: string]: GedcomEntry},
) {
  if (entry.data) {
    const dereferenced = getterFunction(gedcom)[pointerToId(entry.data)];
    if (dereferenced) {
      return dereferenced;
    }
  }
  return entry;
}

/**
 * Returns the data for the given GEDCOM entry as an array of lines. Supports
 * continuations with CONT and CONC.
 */
export function getData(entry: GedcomEntry) {
  const result = [entry.data];
  entry.tree.forEach((subentry) => {
    if (subentry.tag === 'CONC' && subentry.data) {
      const last = result.length - 1;
      result[last] += subentry.data;
    } else if (subentry.tag === 'CONT' && subentry.data) {
      result.push(subentry.data);
    }
  });
  return result;
}

/** Sorts children and spouses. */
export function normalizeGedcom(gedcom: JsonGedcomData): JsonGedcomData {
  return sortSpouses(sortChildren(gedcom));
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

/** Returns true if the given file name has a known image extension. */
export function isImageFile(fileName: string): boolean {
  const cleanName = fileName.split(/[?#]/)[0];
  const lowerName = cleanName.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

/**
 * Removes images that are not HTTP links or do not have known image extensions.
 * Does not modify the input object.
 */
export function isBrowserLoadable(url: string): boolean {
  return /^(https?:|blob:|data:|\/\/)/i.test(url);
}

export function resolveFileUrl(
  url: string,
  images?: Map<string, string>,
): string {
  if (isBrowserLoadable(url)) {
    return url;
  }
  const normalizedUrl = url.replace(/\\/g, '/');
  if (images instanceof Map) {
    const lowercasePath = normalizedUrl.toLowerCase();
    const mappedUrl = images.get(lowercasePath);
    if (mappedUrl) {
      return mappedUrl;
    }
  }
  return normalizedUrl;
}

function filterImage(indi: JsonIndi, images: Map<string, string>): JsonIndi {
  if (!indi.images || indi.images.length === 0) {
    return indi;
  }
  const newImages: JsonImage[] = [];
  indi.images.forEach((image) => {
    const resolvedUrl = resolveFileUrl(image.url, images);
    const normalizedUrl = image.url.replace(/\\/g, '/');
    if (
      resolvedUrl !== normalizedUrl ||
      (isBrowserLoadable(resolvedUrl) && isImageFile(resolvedUrl))
    ) {
      newImages.push({url: resolvedUrl, title: image.title});
    }
  });
  return Object.assign({}, indi, {images: newImages});
}

/**
 * Removes images that are not HTTP links.
 * Does not modify the input object.
 */
function filterImages(
  gedcom: JsonGedcomData,
  images: Map<string, string>,
): JsonGedcomData {
  const newIndis = gedcom.indis.map((indi) => filterImage(indi, images));
  return Object.assign({}, gedcom, {indis: newIndis});
}

/**
 * Converts GEDCOM file into JSON data performing additional transformations:
 * - sort children by birth date
 * - remove images that are not HTTP links and aren't mapped in `images`.
 *
 * @param images Map from file name to image URL. This is used to pass in
 *   uploaded images.
 */
/**
 * Yields to the browser event loop, allowing incremental GC and UI updates.
 * Calls onProgress if provided; does not touch the DOM directly.
 */
function yieldToEventLoop(
  onProgress?: (status: string) => void,
  status?: string,
): Promise<void> {
  if (status) onProgress?.(status);
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function convertGedcom(
  gedcom: string,
  images: Map<string, string>,
  onProgress?: (status: string) => void,
): Promise<TopolaData> {
  await yieldToEventLoop(onProgress, 'Step 1/4: parsing GEDCOM…');

  const entries = parseGedcom(gedcom);

  await yieldToEventLoop(onProgress, 'Step 2/4: building family graph…');

  const json = gedcomEntriesToJson(entries);

  if (
    !json ||
    !json.indis ||
    !json.indis.length ||
    !json.fams ||
    !json.fams.length
  ) {
    throw new TopolaError('GEDCOM_READ_FAILED', 'Failed to read GEDCOM file');
  }

  await yieldToEventLoop(onProgress, 'Step 3/4: sorting & normalizing…');

  const chartData = filterImages(normalizeGedcom(json), images);

  await yieldToEventLoop(onProgress, 'Step 4/4: indexing records…');

  const gedcomData = prepareGedcom(entries);

  return {
    chartData,
    gedcom: gedcomData,
    images,
  };
}

/** Returns the name of the software used to generate the GEDCOM file, if available. */
export function getSoftware(head?: GedcomEntry): string | null {
  const sour =
    head && head.tree && head.tree.find((entry) => entry.tag === 'SOUR');
  const name =
    sour && sour.tree && sour.tree.find((entry) => entry.tag === 'NAME');
  return (name && name.data) || null;
}

/** Returns the name of an individual, preferring birth name over married name. */
export function getName(person: GedcomEntry): string | undefined {
  const names = person.tree.filter((subEntry) => subEntry.tag === 'NAME');
  const notMarriedName = names.find(
    (subEntry) =>
      subEntry.tree.filter(
        (nameEntry) => nameEntry.tag === 'TYPE' && nameEntry.data === 'married',
      ).length === 0,
  );
  const name = notMarriedName || names[0];
  return name?.data.replace(/\//g, '');
}

/** Returns the file name for a media entry, combining title and extension. */
export function getFileName(fileEntry: GedcomEntry): string | undefined {
  const fileTitle = fileEntry?.tree.find((entry) => entry.tag === 'TITL')?.data;

  const fileExtension = fileEntry?.tree.find(
    (entry) => entry.tag === 'FORM',
  )?.data;

  if (fileTitle && fileExtension) {
    return fileTitle + '.' + fileExtension;
  }

  if (fileEntry && fileEntry.data) {
    const path = fileEntry.data.replace(/\\/g, '/');
    const cleanPath = path.split(/[?#]/)[0];
    return cleanPath.split('/').pop();
  }

  return undefined;
}

function findFileEntry(
  objectEntry: GedcomEntry,
  predicate: (entry: GedcomEntry) => boolean,
): GedcomEntry | undefined {
  return objectEntry.tree.find(
    (entry) => entry.tag === 'FILE' && entry.data && predicate(entry),
  );
}

/** Returns the first non-image file entry for a media object. */
export function getNonImageFileEntry(
  objectEntry: GedcomEntry,
): GedcomEntry | undefined {
  return findFileEntry(objectEntry, (entry) => !isImageFile(entry.data));
}

/** Returns the first image file entry for a media object. */
export function getImageFileEntry(
  objectEntry: GedcomEntry,
): GedcomEntry | undefined {
  return findFileEntry(objectEntry, (entry) => isImageFile(entry.data));
}

/** Resolves the DATE sub-entry for the given GEDCOM entry. */
export function resolveDate(entry: GedcomEntry) {
  return entry.tree.find((subEntry) => subEntry.tag === 'DATE');
}

/** Resolves the TYPE sub-entry data for the given GEDCOM entry. */
export function resolveType(entry: GedcomEntry) {
  return entry.tree.find((subEntry) => subEntry.tag === 'TYPE')?.data;
}

/** Converts a GEDCOM source reference entry to a structured Source object. */
export function mapToSource(
  sourceEntryReference: GedcomEntry,
  gedcom: GedcomData,
) {
  const sourceEntry = dereference(
    sourceEntryReference,
    gedcom,
    (gedcom) => gedcom.other,
  );

  const title = sourceEntry.tree.find((subEntry) => 'TITL' === subEntry.tag);

  const abbr = sourceEntry.tree.find((subEntry) => 'ABBR' === subEntry.tag);

  const author = sourceEntry.tree.find((subEntry) => 'AUTH' === subEntry.tag);

  const publicationInfo = sourceEntry.tree.find(
    (subEntry) => 'PUBL' === subEntry.tag,
  );

  const page = sourceEntryReference.tree.find(
    (subEntry) => 'PAGE' === subEntry.tag,
  );

  const sourceData = sourceEntryReference.tree.find(
    (subEntry) => 'DATA' === subEntry.tag,
  );

  const date = sourceData ? resolveDate(sourceData) : undefined;

  return {
    title: title?.data || abbr?.data,
    author: author?.data,
    page: page?.data,
    date: date ? getDate(date.data) : undefined,
    publicationInfo: publicationInfo?.data,
  };
}

/** Finds the shortest relationship path between two individuals in the family tree. */
export function findRelationshipPath(
  indiId1: string,
  indiId2: string,
  indiMap: Map<string, JsonIndi>,
  famMap: Map<string, JsonFam>,
): string[] {
  const getNeighbors = (id: string): string[] => {
    const indi = indiMap.get(id);
    if (!indi) {
      return [];
    }

    const neighbors: string[] = [];
    if (indi.famc) {
      const fam = famMap.get(indi.famc);
      if (fam) {
        if (fam.wife) {
          neighbors.push(fam.wife);
        }
        if (fam.husb) {
          neighbors.push(fam.husb);
        }
        if (fam.children) {
          fam.children.forEach((child) => {
            if (child !== id) {
              neighbors.push(child);
            }
          });
        }
      }
    }

    if (indi.fams) {
      indi.fams.forEach((famId) => {
        const fam = famMap.get(famId);
        if (fam) {
          if (fam.wife && fam.wife !== id) {
            neighbors.push(fam.wife);
          }
          if (fam.husb && fam.husb !== id) {
            neighbors.push(fam.husb);
          }
          if (fam.children) {
            fam.children.forEach((child) => neighbors.push(child));
          }
        }
      });
    }

    return neighbors.filter((nId) => !nId.startsWith('private_'));
  };

  const queue: string[] = [indiId1];
  const visited = new Map<string, string | null>();
  visited.set(indiId1, null);

  while (queue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const current = queue.shift()!;
    if (current === indiId2) {
      const path: string[] = [];
      let curr: string | null = current;
      while (curr !== null) {
        path.push(curr);
        curr = visited.get(curr) || null;
      }
      return path.reverse();
    }

    const neighbors = getNeighbors(current);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  return [];
}

/** Returns the ancestors of an individual up to a specified number of generations. */
export function getAncestors(
  indiId: string,
  generations: number,
  indiMap: Map<string, JsonIndi>,
  famMap: Map<string, JsonFam>,
): string[] {
  const result: string[] = [];
  const queue: {id: string; gen: number}[] = [{id: indiId, gen: 0}];
  const visited = new Set<string>();
  visited.add(indiId);

  while (queue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const {id, gen} = queue.shift()!;
    if (id !== indiId && !id.startsWith('private_')) {
      result.push(id);
    }

    if (gen < generations) {
      const indi = indiMap.get(id);
      if (indi && indi.famc) {
        const fam = famMap.get(indi.famc);
        if (fam) {
          if (fam.wife && !visited.has(fam.wife)) {
            visited.add(fam.wife);
            queue.push({id: fam.wife, gen: gen + 1});
          }
          if (fam.husb && !visited.has(fam.husb)) {
            visited.add(fam.husb);
            queue.push({id: fam.husb, gen: gen + 1});
          }
        }
      }
    }
  }

  return result;
}

/** Returns the descendants of an individual up to a specified number of generations. */
export function getDescendants(
  indiId: string,
  generations: number,
  indiMap: Map<string, JsonIndi>,
  famMap: Map<string, JsonFam>,
): string[] {
  const result: string[] = [];
  const queue: {id: string; gen: number}[] = [{id: indiId, gen: 0}];
  const visited = new Set<string>();
  visited.add(indiId);

  while (queue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const {id, gen} = queue.shift()!;
    if (id !== indiId && !id.startsWith('private_')) {
      result.push(id);
    }

    if (gen < generations) {
      const indi = indiMap.get(id);
      if (indi && indi.fams) {
        indi.fams.forEach((famId) => {
          const fam = famMap.get(famId);
          if (fam && fam.children) {
            fam.children.forEach((child) => {
              if (!visited.has(child)) {
                visited.add(child);
                queue.push({id: child, gen: gen + 1});
              }
            });
          }
        });
      }
    }
  }

  return result;
}
