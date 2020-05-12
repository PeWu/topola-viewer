import {convertGedcom, TopolaData} from '../util/gedcom_util';
import {IndiInfo, JsonGedcomData} from 'topola';

/**
 * Returns a valid IndiInfo object, either with the given indi and generation
 * or with an individual taken from the data and generation 0.
 */
export function getSelection(
  data: JsonGedcomData,
  selection?: IndiInfo,
): IndiInfo {
  // If ID is not given or it doesn't exist in the data, use the first ID in
  // the data.
  const id =
    selection && data.indis.some((i) => i.id === selection.id)
      ? selection.id
      : data.indis[0].id;
  return {id, generation: selection?.generation || 0};
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

  const driveUrlMatch1 = url.match(
    /https:\/\/drive\.google\.com\/file\/d\/(.*)\/.*/,
  );
  if (driveUrlMatch1) {
    url = `https://drive.google.com/uc?id=${driveUrlMatch1[1]}&export=download`;
  }
  const driveUrlMatch2 = url.match(
    /https:\/\/drive\.google\.com\/open\?id=([^&]*)&?.*/,
  );
  if (driveUrlMatch2) {
    url = `https://drive.google.com/uc?id=${driveUrlMatch2[1]}&export=download`;
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
