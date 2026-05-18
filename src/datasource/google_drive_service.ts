const GOOGLE_IDENTITY_SERVICES_SCRIPT =
  'https://accounts.google.com/gsi/client';
const GOOGLE_API_CLIENT_SCRIPT = 'https://apis.google.com/js/api.js';

/** Mapping of dynamically loaded script URLs to the global variables they export on window. */
const SCRIPT_GLOBALS: Record<string, string> = {
  [GOOGLE_IDENTITY_SERVICES_SCRIPT]: 'google',
  [GOOGLE_API_CLIENT_SCRIPT]: 'gapi',
};

/** Keys used for sessionStorage storage of Google Drive state and credentials. */
export const GOOGLE_DRIVE_TOKEN_KEY = 'google-drive-token';
export const GOOGLE_DRIVE_TOKEN_EXPIRES_AT_KEY =
  'google-drive-token-expires-at';
export const GOOGLE_DRIVE_CACHE_KEY_PREFIX = 'google-drive:';

/** Cache of script loading promises to prevent duplicate fetch operations for the same script. */
const loadingScripts = new Map<string, Promise<void>>();

/** Helper to load a script dynamically. */
function loadScript(src: string): Promise<void> {
  const cachedPromise = loadingScripts.get(src);
  if (cachedPromise) {
    return cachedPromise;
  }

  // If a script tag with this URL is already present in the DOM, check if it loaded successfully.
  // If the script's global export is initialized on window, we can reuse it immediately.
  // Otherwise (e.g. if script loading was blocked or failed), remove the stale script element
  // so we can attempt a clean reload.
  const existingScript = document.querySelector(`script[src="${src}"]`);
  if (existingScript) {
    const globalVar = SCRIPT_GLOBALS[src];
    if (
      globalVar &&
      (window as unknown as Record<string, unknown>)[globalVar]
    ) {
      return Promise.resolve();
    }
    existingScript.remove();
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      loadingScripts.delete(src);
      script.remove();
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });

  loadingScripts.set(src, promise);
  return promise;
}

/** Centralized helper to check if Google Drive is configured. */
export function isGoogleDriveConfigured(): boolean {
  return (
    !!import.meta.env.VITE_GOOGLE_CLIENT_ID &&
    !!import.meta.env.VITE_GOOGLE_API_KEY
  );
}

/** Clears cached Google Drive files from sessionStorage, except for the specified key. */
export function clearGoogleDriveCache(exceptKey?: string): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (
        key &&
        key.startsWith(GOOGLE_DRIVE_CACHE_KEY_PREFIX) &&
        key !== exceptKey
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch (err) {
    console.warn(
      'Failed to clear Google Drive cache from session storage:',
      err,
    );
  }
}

const SUPPORTED_MIME_TYPES = [
  'application/x-gedcom',
  'text/vnd.familysearch.gedcom',
  'application/x-zip',
].join(',');

export class GoogleDriveService {
  /** Cached promise for the SDK initialization flow. */
  private initPromise: Promise<void> | null = null;
  /** Google accounts OAuth2 TokenClient instance used to request an access token. */
  private tokenClient: google.accounts.oauth2.TokenClient | null = null;

  /** Resolve callback for a pending authentication promise. */
  private pendingAuthResolve: ((token: string) => void) | null = null;
  /** Reject callback for a pending authentication promise. */
  private pendingAuthReject: ((error: unknown) => void) | null = null;
  /** Cached promise for a pending authentication request to prevent concurrent popup triggers. */
  private pendingAuthPromise: Promise<string> | null = null;

  /** Initialize Google Drive integration if client ID and API Key are present. */
  init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    if (!isGoogleDriveConfigured()) {
      this.initPromise = Promise.resolve();
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        // Dynamically load scripts if not present
        await Promise.all([
          loadScript(GOOGLE_IDENTITY_SERVICES_SCRIPT),
          loadScript(GOOGLE_API_CLIENT_SCRIPT),
        ]);

        if (!window.gapi || !window.google) {
          throw new Error(
            'Google SDK scripts loaded but global variables are missing.',
          );
        }

        // Load GAPI Picker client
        await new Promise<void>((resolve, reject) => {
          gapi.load('picker', {
            callback: resolve,
            onerror: () =>
              reject(new Error('Failed to load Google Picker API')),
          });
        });

        // Initialize modern GIS Token Client
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: (response) => {
            if (response.error) {
              if (this.pendingAuthReject) {
                this.pendingAuthReject(response);
              }
              return;
            }
            if (response.access_token) {
              // Cache in sessionStorage to persist page refreshes.
              const expiresAt = Date.now() + Number(response.expires_in) * 1000;
              sessionStorage.setItem(
                GOOGLE_DRIVE_TOKEN_KEY,
                response.access_token,
              );
              sessionStorage.setItem(
                GOOGLE_DRIVE_TOKEN_EXPIRES_AT_KEY,
                String(expiresAt),
              );

              if (this.pendingAuthResolve) {
                this.pendingAuthResolve(response.access_token);
              }
            } else {
              if (this.pendingAuthReject) {
                this.pendingAuthReject(new Error('No access token returned.'));
              }
            }
          },
        });
      } catch (err) {
        console.error('Error during Google SDK initialization:', err);
        this.initPromise = null; // Clear cached promise on failure to allow retry.
        throw err;
      }
    })();

    return this.initPromise;
  }

  /** Gets cached access token if still valid. */
  getAccessToken(): string | null {
    const token = sessionStorage.getItem(GOOGLE_DRIVE_TOKEN_KEY);
    const expiresAtStr = sessionStorage.getItem(
      GOOGLE_DRIVE_TOKEN_EXPIRES_AT_KEY,
    );
    if (token && expiresAtStr) {
      const expiresAt = Number(expiresAtStr);
      if (Date.now() < expiresAt) {
        return token;
      }
    }
    return null;
  }

  /** Triggers the Google OAuth popup to request a new access token. */
  async requestToken(forceAccountSelect = false): Promise<string> {
    await this.init();
    if (!this.tokenClient) {
      throw new Error(
        'Google Identity Services not initialized or credentials missing.',
      );
    }

    // Check if we already have a valid token in cache
    const cachedToken = this.getAccessToken();
    if (cachedToken && !forceAccountSelect) {
      return cachedToken;
    }

    if (this.pendingAuthPromise) {
      if (forceAccountSelect) {
        if (this.pendingAuthReject) {
          this.pendingAuthReject(
            new Error('Authentication superseded by a new request.'),
          );
        }
        this.pendingAuthPromise = null;
        this.pendingAuthResolve = null;
        this.pendingAuthReject = null;
      } else {
        return this.pendingAuthPromise;
      }
    }

    const authPromise = new Promise<string>((resolve, reject) => {
      this.pendingAuthResolve = (token) => {
        this.pendingAuthPromise = null;
        this.pendingAuthResolve = null;
        this.pendingAuthReject = null;
        resolve(token);
      };
      this.pendingAuthReject = (err) => {
        this.pendingAuthPromise = null;
        this.pendingAuthResolve = null;
        this.pendingAuthReject = null;
        reject(err);
      };

      const tokenClient = this.tokenClient;
      if (tokenClient) {
        tokenClient.requestAccessToken({
          prompt: forceAccountSelect ? 'select_account' : '',
        });
      }
    });

    if (!forceAccountSelect) {
      this.pendingAuthPromise = authPromise;
    }
    return authPromise;
  }

  /** Shows the responsive Google Picker to select a .ged or .gdz file. */
  async showPicker(
    onPicked: (fileId: string) => void,
    onCancel?: () => void,
  ): Promise<void> {
    await this.init();
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('User not authenticated.');
    }

    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key is missing.');
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const appId = clientId ? clientId.split('-')[0] : '';

    // Compute dimensions based on window size
    const viewWidth = Math.min(800, window.innerWidth - 40);
    const viewHeight = Math.min(600, window.innerHeight - 40);

    const docsView = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setMimeTypes(SUPPORTED_MIME_TYPES)
      .setMode(google.picker.DocsViewMode.LIST);

    const picker = new google.picker.PickerBuilder()
      .addView(docsView)
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .setAppId(appId)
      .setSize(viewWidth, viewHeight)
      .setOrigin(window.location.origin)
      .setCallback((data: unknown) => {
        const responseObj = data as Record<string, unknown>;
        if (responseObj.action === google.picker.Action.PICKED) {
          const docs = responseObj[google.picker.Response.DOCUMENTS] as Record<
            string,
            unknown
          >[];
          const doc = docs[0];
          const fileId = doc[google.picker.Document.ID] as string;
          onPicked(fileId);
        } else if (responseObj.action === google.picker.Action.CANCEL) {
          if (onCancel) {
            onCancel();
          }
        }
      })
      .build();

    picker.setVisible(true);
  }

  /** Revokes current token and purges tokens from local memory and sessionStorage. */
  async signOut(): Promise<void> {
    await this.init();
    const token = this.getAccessToken();
    if (token) {
      try {
        google.accounts.oauth2.revoke(token, () => {
          // Callback required by Google API, no action needed on token revocation completion.
        });
      } catch (err) {
        console.warn('Failed to revoke Google OAuth token:', err);
      }
    }
    sessionStorage.removeItem(GOOGLE_DRIVE_TOKEN_KEY);
    sessionStorage.removeItem(GOOGLE_DRIVE_TOKEN_EXPIRES_AT_KEY);
  }
}

export const googleDriveService = new GoogleDriveService();
