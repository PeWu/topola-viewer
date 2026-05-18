import {TopolaData} from '../util/gedcom_util';
import {DataSource, DataSourceEnum, SourceSelection} from './data_source';
import {
  GOOGLE_DRIVE_CACHE_KEY_PREFIX,
  googleDriveService,
} from './google_drive_service';
import {loadAndPrepareFile} from './load_data';

/** Specification for Google Drive data source. */
export interface GoogleDriveSourceSpec {
  source: DataSourceEnum.GOOGLE_DRIVE;
  /** The unique ID of the file in Google Drive. */
  fileId: string;
}

/** Error thrown when Google Drive authentication or authorization fails or is missing. */
export class GoogleDriveAuthError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'GoogleDriveAuthError';
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, GoogleDriveAuthError.prototype);
  }
}

/** Data source representing family tree data loaded from Google Drive. */
export class GoogleDriveDataSource implements DataSource<GoogleDriveSourceSpec> {
  isNewData(
    newSource: SourceSelection<GoogleDriveSourceSpec>,
    oldSource: SourceSelection<GoogleDriveSourceSpec>,
    _data?: TopolaData,
  ): boolean {
    return newSource.spec.fileId !== oldSource.spec.fileId;
  }

  async loadData(
    source: SourceSelection<GoogleDriveSourceSpec>,
  ): Promise<TopolaData> {
    const fileId = source.spec.fileId;
    const cacheKey = `${GOOGLE_DRIVE_CACHE_KEY_PREFIX}${fileId}`;

    // 1. Check sessionStorage cache
    try {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (e) {
      console.warn('Failed to load data from session storage: ' + e);
    }

    // 2. Get the active access token
    const token = googleDriveService.getAccessToken();
    if (!token) {
      throw new GoogleDriveAuthError(
        'No active Google Drive access token found.',
      );
    }

    // 3. Fetch file content from Google Drive API
    const response = await window
      .fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .catch((error) => {
        throw new Error(
          `Network error fetching file from Google Drive: ${(error as Error).message}`,
        );
      });

    // 4. Inspect response status
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404
    ) {
      throw new GoogleDriveAuthError(
        `Access denied or file not found (HTTP ${response.status}).`,
      );
    }
    if (response.status !== 200) {
      throw new Error(
        `Failed to fetch file from Google Drive (HTTP ${response.status}): ${response.statusText}`,
      );
    }

    // 5. Parse and prepare the file content
    const blob = await response.blob();
    return loadAndPrepareFile(blob, cacheKey);
  }
}
