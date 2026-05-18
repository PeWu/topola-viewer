/* eslint-disable @typescript-eslint/no-explicit-any */
import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {Blob} from 'buffer';
import dedent from 'dedent';
import {DataSourceEnum, SourceSelection} from './data_source';
import {
  GoogleDriveAuthError,
  GoogleDriveDataSource,
  GoogleDriveSourceSpec,
} from './google_drive';
import {
  GOOGLE_DRIVE_CACHE_KEY_PREFIX,
  googleDriveService,
} from './google_drive_service';
import {mockSessionStorage} from './test_helpers';

// Mock googleDriveService
jest.mock('./google_drive_service', () => ({
  googleDriveService: {
    getAccessToken: jest.fn(),
    init: jest.fn(),
    signOut: jest.fn(),
  },
  GOOGLE_DRIVE_CACHE_KEY_PREFIX: 'google-drive:',
}));

describe('GoogleDriveDataSource', () => {
  let dataSource: GoogleDriveDataSource;
  let sessionStorageMock: {[key: string]: string};

  beforeEach(() => {
    dataSource = new GoogleDriveDataSource();
    sessionStorageMock = mockSessionStorage();

    // Mock fetch
    global.fetch = jest.fn() as any;
    global.window = global as any;

    jest.clearAllMocks();
  });

  describe('isNewData', () => {
    it('returns true if fileId is different', () => {
      const isNew = dataSource.isNewData(
        {spec: {source: DataSourceEnum.GOOGLE_DRIVE, fileId: 'file-1'}},
        {spec: {source: DataSourceEnum.GOOGLE_DRIVE, fileId: 'file-2'}},
      );
      expect(isNew).toBe(true);
    });

    it('returns false if fileId is the same', () => {
      const isNew = dataSource.isNewData(
        {spec: {source: DataSourceEnum.GOOGLE_DRIVE, fileId: 'file-1'}},
        {spec: {source: DataSourceEnum.GOOGLE_DRIVE, fileId: 'file-1'}},
      );
      expect(isNew).toBe(false);
    });
  });

  describe('loadData', () => {
    const spec: SourceSelection<GoogleDriveSourceSpec> = {
      spec: {
        source: DataSourceEnum.GOOGLE_DRIVE,
        fileId: 'test-file-id',
      },
    };

    it('returns cached data from sessionStorage if present', async () => {
      const cached = {gedcom: 'INDI', chartData: {}};
      sessionStorageMock[`${GOOGLE_DRIVE_CACHE_KEY_PREFIX}test-file-id`] =
        JSON.stringify(cached);

      const result = await dataSource.loadData(spec);

      expect(result).toEqual(cached as any);
      expect(googleDriveService.getAccessToken).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('throws GoogleDriveAuthError if no access token is available', async () => {
      jest.mocked(googleDriveService.getAccessToken).mockReturnValue(null);

      await expect(dataSource.loadData(spec)).rejects.toThrow(
        GoogleDriveAuthError,
      );
    });

    it('throws GoogleDriveAuthError if fetch returns 401, 403, or 404', async () => {
      jest
        .mocked(googleDriveService.getAccessToken)
        .mockReturnValue('mock-token');
      jest.mocked(global.fetch).mockResolvedValue({
        status: 403,
        statusText: 'Forbidden',
      } as any);

      await expect(dataSource.loadData(spec)).rejects.toThrow(
        GoogleDriveAuthError,
      );
    });

    it('throws generic error if fetch returns other non-200 status', async () => {
      jest
        .mocked(googleDriveService.getAccessToken)
        .mockReturnValue('mock-token');
      jest.mocked(global.fetch).mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
      } as any);

      await expect(dataSource.loadData(spec)).rejects.toThrow(
        'Failed to fetch file from Google Drive (HTTP 500)',
      );
    });

    it('successfully fetches, parses and returns data', async () => {
      jest
        .mocked(googleDriveService.getAccessToken)
        .mockReturnValue('mock-token');

      const gedcomContent = dedent`
        0 HEAD
        1 CHAR UTF-8
        0 @I1@ INDI
        1 NAME John /Doe/
        1 FAMS @F1@
        0 @F1@ FAM
        1 HUSB @I1@
        0 TRLR
      `;
      const mockBlob = new Blob([gedcomContent]) as any;
      jest.mocked(global.fetch).mockResolvedValue({
        status: 200,
        blob: jest.fn<() => Promise<Blob>>().mockResolvedValue(mockBlob),
      } as any);

      const result = await dataSource.loadData(spec);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/drive/v3/files/test-file-id?alt=media',
        {
          headers: {
            Authorization: 'Bearer mock-token',
          },
        },
      );
      expect(result.gedcom.indis['I1']).toBeDefined();
      expect(result.gedcom.indis['I1'].tag).toBe('INDI');
      expect(result.chartData.indis[0].id).toBe('I1');
    });
  });
});
