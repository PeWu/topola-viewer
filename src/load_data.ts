import {convertGedcom} from './gedcom_util';
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

/** Fetches data from the given URL. Uses cors-anywhere if handleCors is true. */
export function loadFromUrl(
  url: string,
  handleCors: boolean,
): Promise<JsonGedcomData> {
  const cachedData = sessionStorage.getItem(url);
  if (cachedData) {
    return Promise.resolve(JSON.parse(cachedData));
  }
  const urlToFetch = handleCors
    ? 'https://cors-anywhere.herokuapp.com/' + url
    : url;

  return window
    .fetch(urlToFetch)
    .then((response) => {
      if (response.status !== 200) {
        return Promise.reject(new Error(response.statusText));
      }
      return response.text();
    })
    .then((gedcom) => {
      const data = convertGedcom(gedcom);
      const serializedData = JSON.stringify(data);
      sessionStorage.setItem(url, serializedData);
      return data;
    });
}

/** Loads data from the given GEDCOM file contents. */
function loadGedcomSync(hash: string, gedcom?: string) {
  const cachedData = sessionStorage.getItem(hash);
  if (cachedData) {
    return JSON.parse(cachedData);
  }
  if (!gedcom) {
    throw new Error('Error loading data. Please upload your file again.');
  }
  const data = convertGedcom(gedcom);
  const serializedData = JSON.stringify(data);
  sessionStorage.setItem(hash, serializedData);
  return data;
}

/** Loads data from the given GEDCOM file contents. */
export function loadGedcom(
  hash: string,
  gedcom?: string,
): Promise<JsonGedcomData> {
  try {
    return Promise.resolve(loadGedcomSync(hash, gedcom));
  } catch (e) {
    return Promise.reject(new Error('Failed to read GEDCOM file'));
  }
}
