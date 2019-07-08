import {convertGedcom, TopolaData} from './gedcom_util';
import {IndiInfo, JsonGedcomData} from 'topola';

/**
 * Returns a valid IndiInfo object, either with the given indi and generation
 * or with an individual taken from the data and generation 0.
 */
export function getSelection(
  data: JsonGedcomData,
  indi?: string,
  generation?: number,
): IndiInfo {
  return {
    id: indi || data.indis[0].id,
    generation: generation || 0,
  };
}

function prepareData(
  gedcom: string,
  cacheId: string,
  images?: Map<string, string>,
): TopolaData {
  const data = convertGedcom(gedcom, images || new Map());
  const serializedData = JSON.stringify(data);
  try {
    sessionStorage.setItem(cacheId, serializedData);
  } catch (e) {
    console.warn('Failed to store data in session storage: ' + e);
  }
  return data;
}

/** Fetches data from the given URL. Uses cors-anywhere if handleCors is true. */
export async function loadFromUrl(
  url: string,
  handleCors: boolean,
): Promise<TopolaData> {
  try {
    const cachedData = sessionStorage.getItem(url);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (e) {
    console.warn('Failed to load data from session storage: ' + e);
  }
  const urlToFetch = handleCors
    ? 'https://cors-anywhere.herokuapp.com/' + url
    : url;

  const response = await window.fetch(urlToFetch);
  if (response.status !== 200) {
    throw new Error(response.statusText);
  }
  const gedcom = await response.text();
  return prepareData(gedcom, url);
}

/** Loads data from the given GEDCOM file contents. */
export async function loadGedcom(
  hash: string,
  gedcom?: string,
  images?: Map<string, string>,
): Promise<TopolaData> {
  try {
    const cachedData = sessionStorage.getItem(hash);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (e) {
    console.warn('Failed to load data from session storage: ' + e);
  }
  if (!gedcom) {
    throw new Error('Error loading data. Please upload your file again.');
  }
  return prepareData(gedcom, hash, images);
}
