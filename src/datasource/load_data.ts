import {analyticsEvent} from '../util/analytics';
import {convertGedcom, getSoftware, TopolaData} from '../util/gedcom_util';
import {DataSource, DataSourceEnum, SourceSelection} from './data_source';
import {IndiInfo, JsonGedcomData} from 'topola';
import {TopolaError} from '../util/error';
import AdmZip from 'adm-zip';

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

async function loadGedzip(
  blob: Blob,
): Promise<{gedcom: string; images: Map<string, string>}> {
  const zip = new AdmZip(Buffer.from(await blob.arrayBuffer()));
  const entries = zip.getEntries();

  let gedcom = undefined;
  const images = new Map<string, string>();
  for (const entry of entries) {
    if (entry.entryName.endsWith('.ged')) {
      if (gedcom) {
        console.warn('Multiple GEDCOM files found in zip archive.');
      } else {
        gedcom = entry.getData().toString();
      }
    } else {
      // Save image for later.
      images.set(
        entry.entryName,
        URL.createObjectURL(new Blob([entry.getData()])),
      );
    }
  }
  if (!gedcom) {
    throw new Error('GEDCOM file not found in zip archive.');
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

  const urlToFetch = handleCors ? 'https://topolaproxy.bieda.it/' + url : url;

  const response = await window.fetch(urlToFetch);
  if (response.status !== 200) {
    throw new Error(response.statusText);
  }

  const {gedcom, images} = await loadFile(await response.blob());
  return prepareData(gedcom, url, images);
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
    throw new TopolaError(
      'ERROR_LOADING_UPLOADED_FILE',
      'Error loading data. Please upload your file again.',
    );
  }
  return prepareData(gedcom, hash, images);
}

export interface UploadSourceSpec {
  source: DataSourceEnum.UPLOADED;
  gedcom?: string;
  /** Hash of the GEDCOM contents. */
  hash: string;
  images?: Map<string, string>;
}

/** Files opened from the local computer. */
export class UploadedDataSource implements DataSource<UploadSourceSpec> {
  // isNewData(args: Arguments, state: State): boolean {
  isNewData(
    newSource: SourceSelection<UploadSourceSpec>,
    oldSource: SourceSelection<UploadSourceSpec>,
    data?: TopolaData,
  ): boolean {
    return newSource.spec.hash !== oldSource.spec.hash;
  }

  async loadData(
    source: SourceSelection<UploadSourceSpec>,
  ): Promise<TopolaData> {
    try {
      const data = await loadGedcom(
        source.spec.hash,
        source.spec.gedcom,
        source.spec.images,
      );
      const software = getSoftware(data.gedcom.head);
      analyticsEvent('upload_file_loaded', {
        event_label: software,
        event_value: (source.spec.images && source.spec.images.size) || 0,
      });
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
    data?: TopolaData,
  ): boolean {
    return newSource.spec.url !== oldSource.spec.url;
  }

  async loadData(source: SourceSelection<UrlSourceSpec>): Promise<TopolaData> {
    try {
      const data = await loadFromUrl(source.spec.url, source.spec.handleCors);
      const software = getSoftware(data.gedcom.head);
      analyticsEvent('upload_file_loaded', {event_label: software});
      return data;
    } catch (error) {
      analyticsEvent('url_file_error');
      throw error;
    }
  }
}
