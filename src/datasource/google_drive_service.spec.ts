/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {
  GOOGLE_DRIVE_CACHE_KEY_PREFIX,
  GOOGLE_DRIVE_TOKEN_EXPIRES_AT_KEY,
  GOOGLE_DRIVE_TOKEN_KEY,
  GoogleDriveService,
  clearGoogleDriveCache,
  isGoogleDriveConfigured,
} from './google_drive_service';
import {mockSessionStorage} from './test_helpers';

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;
  let sessionStorageMock: {[key: string]: string};
  let mockTokenClient: any;
  let initTokenClientSpy: any;
  let revokeSpy: any;
  let headMock: any;
  let documentMock: any;

  beforeEach(() => {
    sessionStorageMock = mockSessionStorage();

    // Mock document
    headMock = {
      appendChild: jest.fn((el: any) => {
        if (el.onload) {
          setTimeout(() => el.onload(), 0);
        }
      }),
    };

    documentMock = {
      querySelector: jest.fn().mockReturnValue(null),
      createElement: jest.fn().mockImplementation(() => ({
        src: '',
        async: false,
        defer: false,
        onload: null,
        onerror: null,
        remove: jest.fn(),
      })),
      head: headMock,
    };

    Object.defineProperty(global, 'document', {
      value: documentMock,
      writable: true,
      configurable: true,
    });

    // Mock global window objects
    (global as any).window = global;
    (global as any).gapi = {
      load: jest.fn((apiName: string, config: any) => {
        if (config && config.callback) {
          config.callback();
        }
      }),
    };

    mockTokenClient = {
      requestAccessToken: jest.fn(),
    };

    initTokenClientSpy = jest.fn().mockReturnValue(mockTokenClient);
    revokeSpy = jest.fn((token: string, callback: () => void) => callback());

    (global as any).google = {
      accounts: {
        oauth2: {
          initTokenClient: initTokenClientSpy,
          revoke: revokeSpy,
        },
      },
      picker: {
        DocsView: jest.fn().mockImplementation(() => ({
          setMimeTypes: jest.fn().mockReturnThis(),
        })),
        PickerBuilder: jest.fn().mockImplementation(() => ({
          addView: jest.fn().mockReturnThis(),
          setOAuthToken: jest.fn().mockReturnThis(),
          setDeveloperKey: jest.fn().mockReturnThis(),
          setCallback: jest.fn().mockReturnThis(),
          setSize: jest.fn().mockReturnThis(),
          build: jest.fn().mockReturnValue({
            setVisible: jest.fn(),
          }),
        })),
        ViewId: {
          DOCS: 'docs',
        },
      },
    };

    // Set up env vars for tests
    process.env.VITE_GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.VITE_GOOGLE_API_KEY = 'test-api-key';

    // Reset modules so that module-scoped variables (like loadingScripts and retryCounts)
    // are fresh for every test.
    jest.resetModules();
    const {
      GoogleDriveService: FreshGoogleDriveService,
    } = require('./google_drive_service');
    service = new FreshGoogleDriveService();
    jest.clearAllMocks();
  });

  describe('isGoogleDriveConfigured', () => {
    it('returns true when client ID and API key are configured', () => {
      expect(isGoogleDriveConfigured()).toBe(true);
    });

    it('returns false when client ID is missing', () => {
      process.env.VITE_GOOGLE_CLIENT_ID = '';
      expect(isGoogleDriveConfigured()).toBe(false);
    });
  });

  describe('init', () => {
    it('resolves immediately if not configured', async () => {
      process.env.VITE_GOOGLE_CLIENT_ID = '';
      await expect(service.init()).resolves.not.toThrow();
      expect(initTokenClientSpy).not.toHaveBeenCalled();
    });

    it('successfully initializes scripts and token client', async () => {
      await service.init();

      expect(initTokenClientSpy).toHaveBeenCalledWith({
        client_id: 'test-client-id',
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: expect.any(Function),
      });
      expect(gapi.load).toHaveBeenCalledWith('picker', expect.any(Object));
    });

    it('throws error and clears initPromise on load failure', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {
          // No-op
        });

      const oldGapi = (global as any).gapi;
      delete (global as any).gapi;

      await expect(service.init()).rejects.toThrow();

      (global as any).gapi = oldGapi;

      await expect(service.init()).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getAccessToken', () => {
    it('returns null when no token is cached', () => {
      expect(service.getAccessToken()).toBeNull();
    });

    it('returns null when token is expired', () => {
      sessionStorageMock[GOOGLE_DRIVE_TOKEN_KEY] = 'expired-token';
      sessionStorageMock[GOOGLE_DRIVE_TOKEN_EXPIRES_AT_KEY] = String(
        Date.now() - 1000,
      );

      expect(service.getAccessToken()).toBeNull();
    });

    it('returns token when cached token is valid', () => {
      sessionStorageMock[GOOGLE_DRIVE_TOKEN_KEY] = 'valid-token';
      sessionStorageMock[GOOGLE_DRIVE_TOKEN_EXPIRES_AT_KEY] = String(
        Date.now() + 60000,
      );

      expect(service.getAccessToken()).toBe('valid-token');
    });
  });

  describe('requestToken', () => {
    it('returns cached valid token without initiating login popup', async () => {
      sessionStorageMock[GOOGLE_DRIVE_TOKEN_KEY] = 'valid-token';
      sessionStorageMock[GOOGLE_DRIVE_TOKEN_EXPIRES_AT_KEY] = String(
        Date.now() + 60000,
      );

      const token = await service.requestToken();
      expect(token).toBe('valid-token');
      expect(mockTokenClient.requestAccessToken).not.toHaveBeenCalled();
    });

    it('triggers requestAccessToken when no valid token cached', async () => {
      const tokenPromise = service.requestToken();

      // Wait for async script loaders and GAPI load callback in init() to execute
      await new Promise((resolve) => setTimeout(resolve, 0));

      const callback = initTokenClientSpy.mock.calls[0][0].callback;

      callback({
        access_token: 'new-auth-token',
        expires_in: '3600',
      });

      const token = await tokenPromise;
      expect(token).toBe('new-auth-token');
      expect(sessionStorageMock[GOOGLE_DRIVE_TOKEN_KEY]).toBe('new-auth-token');
      expect(mockTokenClient.requestAccessToken).toHaveBeenCalledWith({
        prompt: '',
      });
    });

    it('rejects previous pending promise when superseded by a forced select request', async () => {
      const firstTokenPromise = service.requestToken(false);
      const secondTokenPromise = service.requestToken(true);

      await expect(firstTokenPromise).rejects.toThrow(
        'Authentication superseded by a new request.',
      );

      const callback = initTokenClientSpy.mock.calls[0][0].callback;
      callback({
        access_token: 'superseded-flow-token',
        expires_in: '3600',
      });

      const secondToken = await secondTokenPromise;
      expect(secondToken).toBe('superseded-flow-token');
    });
  });

  describe('signOut', () => {
    it('revokes the token and clears storage keys', async () => {
      sessionStorageMock[GOOGLE_DRIVE_TOKEN_KEY] = 'my-token';
      sessionStorageMock[GOOGLE_DRIVE_TOKEN_EXPIRES_AT_KEY] = '9999999999999';

      await service.signOut();

      expect(revokeSpy).toHaveBeenCalledWith('my-token', expect.any(Function));
      expect(sessionStorageMock[GOOGLE_DRIVE_TOKEN_KEY]).toBeUndefined();
      expect(
        sessionStorageMock[GOOGLE_DRIVE_TOKEN_EXPIRES_AT_KEY],
      ).toBeUndefined();
    });
  });

  describe('clearGoogleDriveCache', () => {
    it('clears all google-drive: keys except the specified key', () => {
      sessionStorageMock[`${GOOGLE_DRIVE_CACHE_KEY_PREFIX}file1`] = 'data1';
      sessionStorageMock[`${GOOGLE_DRIVE_CACHE_KEY_PREFIX}file2`] = 'data2';
      sessionStorageMock['other-key'] = 'other-data';

      clearGoogleDriveCache(`${GOOGLE_DRIVE_CACHE_KEY_PREFIX}file1`);

      expect(sessionStorageMock[`${GOOGLE_DRIVE_CACHE_KEY_PREFIX}file1`]).toBe(
        'data1',
      );
      expect(
        sessionStorageMock[`${GOOGLE_DRIVE_CACHE_KEY_PREFIX}file2`],
      ).toBeUndefined();
      expect(sessionStorageMock['other-key']).toBe('other-data');
    });

    it('clears all google-drive: keys if no key is excepted', () => {
      sessionStorageMock[`${GOOGLE_DRIVE_CACHE_KEY_PREFIX}file1`] = 'data1';
      sessionStorageMock[`${GOOGLE_DRIVE_CACHE_KEY_PREFIX}file2`] = 'data2';

      clearGoogleDriveCache();

      expect(
        sessionStorageMock[`${GOOGLE_DRIVE_CACHE_KEY_PREFIX}file1`],
      ).toBeUndefined();
      expect(
        sessionStorageMock[`${GOOGLE_DRIVE_CACHE_KEY_PREFIX}file2`],
      ).toBeUndefined();
    });
  });
});
