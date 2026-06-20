import {Buffer} from 'buffer';
import {strFromU8, unzip, Unzipped} from 'fflate';
import {IndiInfo, JsonGedcomData} from 'topola';
import {analyticsEvent} from '../util/analytics';
import {TopolaError} from '../util/error';
import {convertGedcom, getSoftware, TopolaData} from '../util/gedcom_util';
import {DataSource, DataSourceEnum, SourceSelection} from './data_source';
import {getStoredGedcom} from './gedcom_store';

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

// sessionStorage limit is ~5MB in all browsers. The serialized output for
// typical files includes both chartData (~7.85MB for 24K individuals) and the
// raw gedcom entry tree (~25MB), so attempting JSON.stringify for large files
// wastes 10-20s in Safari and always fails. Skip caching above this threshold.
const SESSION_CACHE_GEDCOM_LIMIT = 512 * 1024; // 512KB raw GEDCOM → safe to try

async function prepareData(
  gedcom: string,
  cacheId: string,
  images?: Map<string, string>,
  onProgress?: (status: string) => void,
  useSessionCache = true,
): Promise<TopolaData> {
  const data = await convertGedcom(gedcom, images || new Map(), onProgress);
  if (useSessionCache && (!images || images.size === 0)) {
    if (gedcom.length <= SESSION_CACHE_GEDCOM_LIMIT) {
      const dataToSerialize = {...data};
      delete dataToSerialize.images;
      const serializedData = JSON.stringify(dataToSerialize);
      try {
        sessionStorage.setItem(cacheId, serializedData);
      } catch (e) {
        console.warn('Failed to store data in session storage: ' + e);
      }
    }
  }
  return data;
}

/**
 * Revokes browser-created Object URLs (blob URLs) from a map or list of images
 * to free up memory and prevent resource leaks.
 */
export function revokeObjectUrls(
  images?: Map<string, string> | Iterable<string>,
): void {
  if (!images) {
    return;
  }
  const urls = images instanceof Map ? images.values() : images;
  for (const url of urls) {
    if (url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // Ignore.
      }
    }
  }
}

async function loadGedzip(
  blob: Blob,
): Promise<{gedcom: string; images: Map<string, string>}> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const unzipped: Unzipped = await new Promise((resolve, reject) => {
    unzip(buffer, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });

  let gedcom = undefined;
  const images = new Map<string, string>();
  try {
    for (const fileName of Object.keys(unzipped)) {
      if (fileName.endsWith('.ged')) {
        if (gedcom) {
          console.warn('Multiple GEDCOM files found in zip archive.');
        } else {
          gedcom = strFromU8(unzipped[fileName]);
        }
      } else {
        // Save image for later.
        const normalizedKey = fileName.replace(/\\/g, '/').toLowerCase();
        images.set(
          normalizedKey,
          URL.createObjectURL(new Blob([unzipped[fileName] as BlobPart])),
        );
      }
    }
    if (!gedcom) {
      throw new Error('GEDCOM file not found in zip archive.');
    }
  } catch (error) {
    revokeObjectUrls(images);
    throw error;
  }
  return {gedcom, images};
}

export async function loadFile(
  blob: Blob,
): Promise<{gedcom: string; images: Map<string, string>}> {
  const fileHeader = await blob.slice(0, 2).text();
  if (fileHeader === 'PK') {
    return loadGedzip(blob);
  }
  return {gedcom: await blob.text(), images: new Map()};
}

/** Parses the given file and prepares the TopolaData structure, revoking URLs on error. */
export async function loadAndPrepareFile(
  blob: Blob,
  cacheId: string,
  onProgress?: (status: string) => void,
): Promise<TopolaData> {
  const {gedcom, images} = await loadFile(blob);
  try {
    return await prepareData(gedcom, cacheId, images, onProgress);
  } catch (error) {
    revokeObjectUrls(images);
    throw error;
  }
}

/** Fetches data from the given URL. Uses cors-anywhere if handleCors is true. */
export async function loadFromUrl(
  url: string,
  handleCors: boolean,
  onProgress?: (status: string) => void,
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

  const urlToFetch = handleCors ? 'https://topolaproxy.bieda.it/' + url : url;

  const response = await window.fetch(urlToFetch);
  if (response.status !== 200) {
    throw new Error(response.statusText);
  }

  return loadAndPrepareFile(await response.blob(), url, onProgress);
}

/** Loads GEDCOM data from the cache or the in-memory store by its hash. */
export async function loadGedcom(
  hash: string,
  onProgress?: (status: string) => void,
  options?: {useSessionCache?: boolean},
): Promise<TopolaData> {
  const useSessionCache = options?.useSessionCache ?? true;
  if (useSessionCache) {
    try {
      const cachedData = sessionStorage.getItem(hash);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (e) {
      console.warn('Failed to load data from session storage: ' + e);
    }
  }
  // Retrieve from the in-memory store (survives within-tab navigation even
  // when the GEDCOM is too large for history.pushState or sessionStorage).
  const stored = getStoredGedcom(hash);
  if (!stored) {
    throw new TopolaError(
      'ERROR_LOADING_UPLOADED_FILE',
      'Error loading data. Please upload your file again.',
    );
  }
  try {
    return await prepareData(
      stored.gedcom,
      hash,
      stored.images,
      onProgress,
      useSessionCache,
    );
  } catch (error) {
    revokeObjectUrls(stored.images);
    throw error;
  }
}

export interface UploadSourceSpec {
  source: DataSourceEnum.UPLOADED;
  /** Fingerprint of the uploaded file, used as cache key and store lookup. */
  hash: string;
}

/** Files opened from the local computer. */
export class UploadedDataSource implements DataSource<UploadSourceSpec> {
  isNewData(
    newSource: SourceSelection<UploadSourceSpec>,
    oldSource: SourceSelection<UploadSourceSpec>,
    _data?: TopolaData,
  ): boolean {
    return newSource.spec.hash !== oldSource.spec.hash;
  }

  async loadData(
    source: SourceSelection<UploadSourceSpec>,
    onProgress?: (status: string) => void,
  ): Promise<TopolaData> {
    try {
      const data = await loadGedcom(source.spec.hash, onProgress);
      const software = getSoftware(data.gedcom.head);
      analyticsEvent('upload_file_loaded', {event_label: software});
      return data;
    } catch (error) {
      analyticsEvent('upload_file_error');
      throw error;
    }
  }
}

export interface UrlSourceSpec {
  source: DataSourceEnum.GEDCOM_URL;
  /** URL of the data that is loaded or is being loaded. */
  url: string;
  handleCors: boolean;
}

/** GEDCOM file loaded by pointing to a URL. */
export class GedcomUrlDataSource implements DataSource<UrlSourceSpec> {
  isNewData(
    newSource: SourceSelection<UrlSourceSpec>,
    oldSource: SourceSelection<UrlSourceSpec>,
    _data?: TopolaData,
  ): boolean {
    return newSource.spec.url !== oldSource.spec.url;
  }

  async loadData(
    source: SourceSelection<UrlSourceSpec>,
    onProgress?: (status: string) => void,
  ): Promise<TopolaData> {
    try {
      const data = await loadFromUrl(
        source.spec.url,
        source.spec.handleCors,
        onProgress,
      );
      const software = getSoftware(data.gedcom.head);
      analyticsEvent('upload_file_loaded', {event_label: software});
      return data;
    } catch (error) {
      analyticsEvent('url_file_error');
      throw error;
    }
  }
}
