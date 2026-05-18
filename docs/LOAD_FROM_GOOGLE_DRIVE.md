# Load from Google Drive

## Problem Statement
Currently, Topola Viewer operates primarily on local file uploads, external HTTP URLs, or integrations with APIs like WikiTree. However, users who maintain their genealogy files (such as `.ged` and `.gdz` files) on cloud storage platforms like Google Drive face significant friction when trying to view, share, or collaborate on their family trees. The lack of integrated cloud storage support makes sharing interactive trees between collaborators cumbersome, requiring them to manually download and re-upload files. Integrating Google Drive directly into Topola Viewer as a secure, read-only storage provider will allow users to seamlessly load their trees from the cloud and easily collaborate using direct shared links.

## The Technical Plan

To support Google Drive files, the application needs to orchestrate authentication, file selection, and download. The integration consists of five main components working together:

### Major Components

1. **Google Drive Service**: This is a helper component that manages the connection to Google's APIs. It loads the Google libraries, triggers the login popup, caches the authorization token, and opens the Google Picker file selector.
2. **Google Drive Data Source**: A data loader that is registered in Topola's data source system. When the app is asked to load a file ID, this component uses the active authorization token to download the raw file content directly from Google Drive's secure servers.
3. **App Router / Shell**: The main orchestrator of the application. It parses parameters from the URL (like `fileId` and `source=google-drive`) and initiates the loading process. If the file download fails due to access issues, it manages the state of the fallback dialog.
4. **Access Authorization Modal**: A fallback dialog that displays when a user clicks a shared link to a Google Drive file that they do not yet have permission to view. It guides them to authenticate and select the target file using the Google Picker, which dynamically grants the app permission to access that file.
5. **Google Drive Menu**: A button added to Topola Viewer's menu bar that allows users to connect their Google account and browse their Drive files.

## Alternatives Considered and Rejected

During the design phase, several alternative approaches were considered but rejected due to security, privacy, or complexity concerns:

### 1. Using the Broad `drive.readonly` Scope
*   **Alternative**: Requesting permission to read any file in the user's Google Drive so that shared links could be opened immediately without additional user interaction.
*   **Why Rejected**: Google classifies `drive.readonly` as a restricted scope. Publishing an app using this scope requires an annual third-party security assessment (CASA audit) which is prohibitively expensive for an open-source, non-profit project. Using the `drive.file` scope keeps the application within the non-sensitive tier while protecting user privacy by only granting access to files the user explicitly selects.

### 2. Anonymous Downloads for Publicly Shared Files
*   **Alternative**: Attempting to download files shared with "anyone with the link" directly using standard public URLs without requiring a Google sign-in.
*   **Why Rejected**: Public Google Drive URLs do not reliably support browser CORS headers for anonymous requests, and larger files trigger virus-warning pages that return HTML rather than raw file contents. Requiring a Google login for all Google Drive operations allows the app to fetch via the official API with an authorization token, which avoids both CORS and virus-scan issues and simplifies the code.

### 3. Routing Google Drive Traffic Through a CORS Proxy
*   **Alternative**: Using the existing `topolaproxy.bieda.it` proxy to download files in order to bypass CORS restrictions.
*   **Why Rejected**: Routing traffic through a third-party proxy poses a severe security risk because it would require transmitting the user's Google OAuth access token to an external service. Additionally, family tree files contain sensitive personal information, and routing them through an unauthenticated proxy violates privacy-first principles. Direct client-side requests to `googleapis.com` ensure all traffic remains securely encrypted between the user's browser and Google.

### 4. Implementing Write/Edit Support
*   **Alternative**: Allowing users to modify their family trees and write back the changes directly to Google Drive.
*   **Why Rejected**: Topola Viewer is architected as a read-only visualization tool. Implementing full write support would require developing a robust GEDCOM and GEDZIP serialization engine, state mutation synchronization, and conflict resolution mechanisms. Limiting this feature to read-only viewing aligns with the application's core purpose and avoids significant, high-risk complexity.

## Detailed Implementation Plan

This section outlines every file that will be created or modified to implement the Google Drive storage feature, along with the technical rationale for each change.

---

### 1. Build and Dependencies Setup

#### [MODIFY] [package.json](../package.json)
*   **Rationale**: Type safety is critical for global variables introduced by Google scripts.
*   **Changes**: Add the following type definitions to `devDependencies`:
    *   `@types/gapi` for the legacy Google API client.
    *   `@types/google.picker` for the Google Picker API.
    *   `@types/google.accounts` for the modern Google Identity Services (GIS) token client.

*Note: In contrast to the initial design where GAPI and GIS scripts were loaded statically in `index.html`, the final implementation loads these scripts dynamically on demand using the custom `loadScript()` helper function in `google_drive_service.ts` to improve performance and only download third-party assets when the user interacts with Google Drive.*


---

### 2. Data Source Layer

#### [MODIFY] [src/datasource/data_source.ts](../src/datasource/data_source.ts)
*   **Rationale**: Topola Viewer abstracts data loading using the `DataSource` interface and `DataSourceEnum`. We must register the Google Drive type here.
*   **Changes**: Add a `GOOGLE_DRIVE` entry to the `DataSourceEnum` export.

#### [MODIFY] [src/datasource/load_data.ts](../src/datasource/load_data.ts)
*   **Rationale**: Restructure file loading logic so that Google Drive datasource can parse file content and perform initial caching without code duplication.
*   **Changes**: Export a new helper function, `loadAndPrepareFile(blob: Blob, cacheId: string): Promise<TopolaData>`, which calls `loadFile()` and `prepareData()` inside a try-catch block, handling `revokeObjectUrls()` in case of parsing errors.

#### [NEW] [src/datasource/google_drive.ts](../src/datasource/google_drive.ts)
*   **Rationale**: Defines the logic for checking and loading Google Drive files.
*   **Changes**:
    *   Define the interface `GoogleDriveSourceSpec` that contains the `fileId` and a `source` field mapped to `DataSourceEnum.GOOGLE_DRIVE`.
    *   Create `GoogleDriveAuthError` (extends `Error`) to signal authentication failures or access denial back to the App controller.
    *   Implement the `GoogleDriveDataSource` class matching the `DataSource` interface. The `loadData` function:
        1. Checks `sessionStorage` under `google-drive:{fileId}` to see if the parsed file is already cached (avoiding network requests on page refresh).
        2. If not cached, gets the active access token from `googleDriveService`. If missing or expired, throws `GoogleDriveAuthError`.
        3. Executes a direct `fetch` to Google's REST endpoint (`https://www.googleapis.com/drive/v3/files/{fileId}?alt=media`) using the token.
        4. Inspects response status: if 401, 403, or 404, throws `GoogleDriveAuthError`; if any other non-200 code, throws a standard `Error`.
        5. Parses the downloaded blob using `loadFile` (reusing existing GEDCOM/GEDZIP zip parsing).

#### [NEW] [src/datasource/google_drive_service.ts](../src/datasource/google_drive_service.ts)
*   **Rationale**: Keeps all interactions with Google Identity Services and GAPI initialization isolated, protecting the core app from dependency leakage.
*   **Changes**:
    *   Create a singleton `googleDriveService` class.
    *   Implement an initialization method `init()` that dynamically loads GAPI and GIS scripts using a helper function `loadScript(src)`. It then loads GAPI's `picker` library via `gapi.load('picker', ...)`. Access `window.gapi` and `window.google` using direct global references or `(window as any)` casting to prevent TypeScript compilation errors.
    *   Handle OAuth initialization via `google.accounts.oauth2.initTokenClient` and store the access token in memory. Cache the token and its computed absolute expiration timestamp (`Date.now() + expires_in * 1000`) in `sessionStorage` to survive page refreshes in the same tab.
    *   **Asynchronous Initialization**: Store the initialization Promise as `this.initPromise` (which resolves when global scripts are loaded and GAPI/GIS are initialized). All public service methods must await `this.initPromise` before executing to prevent race conditions and runtime errors.
    *   **Promise-based OAuth Request**: Since `initTokenClient` accepts a single static callback, `requestToken` should store the current Promise's `resolve` and `reject` handlers on the service instance (`this.pendingAuthResolve` and `this.pendingAuthReject`) and invoke them inside the GIS callback.
    *   Provide helper methods:
        *   `getAccessToken()`: Returns the cached token if it has not expired (checked against the absolute expiration timestamp stored in `sessionStorage`).
        *   `requestToken(forceAccountSelect)`: Returns a Promise that resolves when the Google Identity Services popup completes auth. If `forceAccountSelect` is true, sets the GIS configuration `prompt` parameter to `'select_account'` (critical for switching accounts on 403 errors).
        *   `showPicker(onPicked, onCancel)`: Calculates display dimensions based on the window size (`Math.min` bounds) to ensure responsiveness on mobile, then builds and opens the Google Picker.
            *   Set the developer API key via `.setDeveloperKey(import.meta.env.VITE_GOOGLE_API_KEY)` on the `PickerBuilder`.
            *   Configure `DocsView` using `google.picker.ViewId.DOCS` and restrict it to files matching `.setMimeTypes('application/x-gedcom,text/vnd.familysearch.gedcom,application/x-zip')` to cover `.ged` and `.gdz` formats.
            *   Set the origin using `.setOrigin(window.location.origin)` to prevent cross-origin issues between the Picker iframe and the viewer page.
            *   In the Picker callback, check for `data.action === google.picker.Action.PICKED` and retrieve the file ID via `data[google.picker.Response.DOCUMENTS][0][google.picker.Document.ID]`, triggering `onPicked`.
            *   If `data.action === google.picker.Action.CANCEL`, trigger the `onCancel` callback (if provided) to handle dialog closing gracefully.
        *   `signOut()`: Revokes the token using `google.accounts.oauth2.revoke`, clears memory and `sessionStorage` tokens, and resets local state.

#### [NEW] [src/datasource/test_helpers.ts](../src/datasource/test_helpers.ts)
*   **Rationale**: Provides a mock `sessionStorage` utility for test environments.
*   **Changes**:
    *   Define `mockSessionStorage()` which mocks `global.sessionStorage` with a key-value dictionary and returns it for inspection.

#### [NEW] [tests/import_meta_transformer.js](../tests/import_meta_transformer.js)
*   **Rationale**: Translates Vite's `import.meta.env` to `process.env` so that tests running in Jest (a Node environment) can correctly access configuration properties.

#### [MODIFY] [jest.config.ts](../jest.config.ts)
*   **Rationale**: Registers the custom `import_meta_transformer.js` for TS and TSX files.

#### [NEW] [src/datasource/google_drive.spec.ts](../src/datasource/google_drive.spec.ts)
*   **Rationale**: Unit testing for the `GoogleDriveDataSource` class, verifying that the data source is instantiated, fetches, and parses data correctly, handles cached items, and throws authentication errors when expected.

#### [NEW] [src/datasource/google_drive_service.spec.ts](../src/datasource/google_drive_service.spec.ts)
*   **Rationale**: Unit testing for the `GoogleDriveService` class including script loading, token caching, account selection, token revocation, and cache clearing.


---

### 3. User Interface Integration

#### [NEW] [src/menu/google_drive_menu.tsx](../src/menu/google_drive_menu.tsx)
*   **Rationale**: Provides the user entry point in the navigation bar to open files.
*   **Changes**:
    *   Implement `GoogleDriveMenu` using the `MenuItem` abstraction.
    *   When clicked, it requests an OAuth access token via `googleDriveService`. If successful, it launches the Google Picker.
    *   When a file is selected, it extracts the ID and navigates to `/view` with search query params set to `source=google-drive&fileId={id}`.

#### [MODIFY] [src/menu/top_bar.tsx](../src/menu/top_bar.tsx)
*   **Rationale**: TopBar contains open actions for uploads, URL loading, and WikiTree. We must inject the Google Drive options here.
*   **Changes**:
    *   Add props: `onGoogleSignOut?: () => void`, `hasGoogleToken: boolean`, and `onGoogleTokenAcquired?: () => void`.
    *   Check if `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_API_KEY` exist in the build environment.
    *   If present, render `GoogleDriveMenu` alongside other menus in the desktop and mobile file selectors.
    *   Inject a **Google Drive Sign Out / Disconnect** button into the top bar in the same location where WikiTree login/logout options appear (on the right-aligned side of the menu for desktop, and list for mobile), rendering only if `hasGoogleToken` is true. Clicking it triggers a sign-out flow that:
        1. Calls the `onGoogleSignOut` callback.

#### [NEW] [src/menu/google_auth_modal.tsx](../src/menu/google_auth_modal.tsx)
*   **Rationale**: Essential for private file sharing support under `drive.file` and bypasses browser popup blockers.
*   **Changes**:
    *   Define props interface:
        *   `failedFileId: string`: The ID of the file that failed to load.
        *   `onAuthSuccess: (fileId: string) => void`: Callback triggered when permission is successfully granted or a file is picked.
        *   `onCancel: () => void`: Callback triggered when the user cancels the modal.
    *   Create a modal view overlay displayed in the center of the screen.
    *   Prompt: "Google Drive Access Required".
    *   Provides a button to initiate connection. The modal implements a two-tier strategy tailored to `drive.file` constraints:
        1. Clicking the button first runs a quick OAuth request (`googleDriveService.requestToken()`) and attempts to download the target file ID. Due to `drive.file` limitations, this direct request will fail (with 403 or 404) on the first try if the app has not been authorized for this file yet in the user's Google Drive.
        2. In case of access failure (403/404), the modal UI will display detailed instructions guiding the user to select the file manually using the Google Picker. Selecting the file in the Picker explicitly grants the app permission to read it.
        3. **Shared Link Constraint**: If the file was shared via "Anyone with the link can view", it may not appear in the user's Picker search or "Shared with me" list until they open the link once in Google Drive or add a shortcut to "My Drive". The modal should document this instruction to guide users opening shared links.
    *   **Popup Blocker Handling**: The OAuth popup is only triggered when the user explicitly clicks the "Connect" button (a direct user gesture). The modal must never attempt to open the OAuth popup automatically on mount.
    *   **Non-blocking Loader**: When the login flow is pending, show a spinner on the button itself or a cancelable loader. Do not show an un-cancelable full-screen loading overlay, as Google Identity Services does not notify the app if the user closes the sign-in popup. The connect button must not be permanently disabled while loading; it should allow the user to click it again to retry or provide a manual reset/timeout in case they closed the login popup.
    *   **Switch Account Button**: Provides a "Switch Account" button that allows users to authenticate with a different Google account directly from the modal dialog. In the implementation, this button is rendered conditionally once picker instructions are visible (after a failed direct download attempt).
    *   **Cancel Action**: Provide a "Cancel" button. If clicked, calls `props.onCancel()` which redirects the user back to the homepage `/` (Intro).


---

### 4. Main App Orchestration

#### [MODIFY] [src/app.tsx](../src/app.tsx)
*   **Rationale**: The central application container responsible for routing, state tracking, error displaying, and data orchestration.
*   **Changes**:
    *   **Type & Registration**: Add `GoogleDriveSourceSpec` to the `DataSourceSpec` union. Instantiate `googleDriveDataSource` via `const googleDriveDataSource = new GoogleDriveDataSource();` and register it in both the `loadData()` and `isNewData()` switch statements in `app.tsx`.
    *   **Credentials Check & Error Handling**: During data loading, if `source=google-drive` but `VITE_GOOGLE_CLIENT_ID` or `VITE_GOOGLE_API_KEY` is missing from the environment, throw an error signaling that Google Drive integration is not configured.
    *   **"Open with" Query Parameter**: Add a root-level `useEffect` or route handler to inspect the `state` query parameter using React Router's `location.search` hook. If present:
        1. Wrap the query parsing logic in a `try/catch` block to handle cases where the `state` parameter is not valid JSON (e.g. from other OAuth providers).
        2. Check that the parsed JSON contains Google Drive specific keys (`action === 'open'` and a non-empty `ids` array) before triggering the redirect.
        3. If valid, extract the first file ID (`ids[0]`) from the array and ignore any other IDs. Perform a client-side redirect (soft navigate) to `/view?source=google-drive&fileId={fileId}` using `{ replace: true }` so it does not pollute the browser history and break the back button.
        4. Clear the `state` query parameter from the URL by performing the client-side redirect using `{ replace: true }`, which replaces the URL in the history and implicitly clears the `state` parameter to prevent infinite redirect loops on subsequent rendering and routing cycles.
    *   **Argument Parsing**: Update `getArguments()` to support `source=google-drive` and `fileId` query params, returning a `GoogleDriveSourceSpec`.
    *   **Google Auth State**: Add React state for showing the `<GoogleAuthModal />`, storing the `failedFileId`, and tracking `hasGoogleToken` (updated upon successful login or logout to ensure proper reactivity in `TopBar`).
    *   **Catching Auth Errors**: Update the main `useEffect` data loading sequence. If `loadData()` throws `GoogleDriveAuthError`, do *not* set `state` to `AppState.ERROR` (which shows a scary red error banner). Instead, keep a clean background (e.g. keep `AppState.LOADING` or transition to a non-error background) and set `showAuthModal` to true.
    *   **Resolving Auth Fallback (Avoiding Deadlock)**:
        *   If the user selects a *new* file in the Picker, perform a soft `navigate` to update the URL parameters, triggering `isNewData` and initiating a normal reload.
        *   If the user successfully authorizes and selects the *same* file ID (matching `failedFileId`), do *not* navigate (as the URL matches and would result in a no-op). Instead, explicitly reset `state` to `AppState.INITIAL`. This forces the `useEffect` to execute the load sequence again using the newly acquired access token.
    *   If the user successfully selects the target file in the auth modal's callback, trigger url updating to refresh the page and successfully render the chart.
    *   **Disconnect Callback**: Pass `onGoogleSignOut` to `TopBar` that:
        1. Revokes the token using `googleDriveService.signOut()`.
        2. Clears the active `data` and `selection` state in `App` and revokes all media Object URLs.
        3. Clears the active `sessionStorage` cache (all keys starting with `google-drive:`) to prevent unauthorized access by subsequent users on shared/public devices.
        4. Redirects the user back to the home route `/` (Intro).

---

### 5. Localization Integration

#### [MODIFY] [src/translations/*.json](../src/translations) and [src/app.tsx](../src/app.tsx)
*   **Rationale**: Ensure all user-facing Google Drive integration UI strings are fully translated and localized.
*   **Changes**: Add translation keys for the new UI elements across all 7 localization files (`bg.json`, `cs.json`, `de.json`, `fr.json`, `it.json`, `pl.json`, `ru.json`). For the default English catalog, declare messages using the `defaultMessage` prop in components or as arguments in `intl.formatMessage` calls. Use a `TopolaError` with code `'GOOGLE_DRIVE_NOT_CONFIGURED'` to propagate configuration errors so they can be parsed and translated by `getI18nMessage()`.
    *   `menu.load_from_google_drive`: "Load from Google Drive" (or language equivalent)
    *   `menu.google_sign_out`: "Disconnect Google Drive" / "Sign out"
    *   `google_auth.title`: "Google Drive Access Required"
    *   `google_auth.instructions`: "To view this file, you must authenticate and select the file from your Google Drive to grant permissions."
    *   `google_auth.grant_button`: "Grant Access & Select File"
    *   `google_auth.cancel`: "Cancel"
    *   `google_auth.picker_instructions_header`: "Permissions Required"
    *   `google_auth.picker_instructions`: "The application does not have permission to read this file. Please select it in the file browser popup to grant access. If this is a shared file that doesn't show up, try adding a shortcut to your Drive first."
    *   `google_auth.switch_account_button`: "Switch Account"
    *   `error.GOOGLE_DRIVE_NOT_CONFIGURED`: "Google Drive integration is not configured."

---

## Google Cloud Platform Setup Guide

To support authentication and file picking, Topola Viewer must be connected to a Google Cloud Platform (GCP) project. Below are the step-by-step instructions to configure the GCP resources, credentials, and Workspace Marketplace listings.

### Step 1: Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top navigation and select **New Project**.
3. Enter a name (e.g., `Topola Viewer`) and click **Create**.

### Step 2: Enable Required APIs
1. Navigate to **APIs & Services** $\rightarrow$ **Library**.
2. Search for and enable the following APIs:
   *   **Google Drive API** (for file downloading).
   *   **Google Picker API** (for the file browser popup).
   *   **Google Workspace Marketplace SDK** (required to enable the "Open with" context menu inside Google Drive).

### Step 3: Configure the OAuth Consent Screen
1. Navigate to **APIs & Services** $\rightarrow$ **OAuth consent screen**.
2. Select **External** for User Type (so any Google user can log in) and click **Create**.
3. Complete the **App information** (App name, Support email, Developer contact information) and click **Save and Continue**.
4. In the **Scopes** step, click **Add or Remove Scopes**:
   *   Add the scope: `https://www.googleapis.com/auth/drive.file`
   *   This scope is classified as non-sensitive, meaning Topola Viewer does *not* require expensive security reviews or CASA audits to be verified by Google.
5. Save and continue to finish the configuration.

### Step 4: Create OAuth 2.0 Credentials
1. Navigate to **APIs & Services** $\rightarrow$ **Credentials**.
2. Click **Create Credentials** $\rightarrow$ **OAuth client ID**.
3. Set the **Application type** to **Web application**.
4. Under **Authorized JavaScript origins**, add the domains where the app is deployed, as well as local environments:
   *   `https://pewu.github.io` (Production)
   *   `https://apps.wikitree.com` (Wikitree Integration)
   *   `http://localhost:3000` (Local testing and development)
   > [!IMPORTANT]
   > Google's OAuth validation is strict. In local development, ensure you access the application via `http://localhost:3000` rather than `http://127.0.0.1:3000`, as using the raw IP address will result in origin authorization failures unless `http://127.0.0.1:3000` is also explicitly added to this list.
5. Click **Create**. Copy the generated **Client ID** to use in the app environment variables (`VITE_GOOGLE_CLIENT_ID`).

### Step 5: Create an API Key (for Google Picker)
1. On the **Credentials** screen, click **Create Credentials** $\rightarrow$ **API key**.
2. Edit the newly created API key to add restrictions:
   *   **Application restrictions**: Choose **HTTP referrers (web sites)**.
   *   Add the authorized referrers:
       *   `https://pewu.github.io/topola/viewer/*`
       *   `https://apps.wikitree.com/apps/wiech13/topola-viewer/*`
       *   `http://localhost:3000/*`
   *   **API restrictions**: Restrict the key to only allow requests to **both** the **Google Picker API** and the **Google Drive API** (the Picker component queries user files via the Drive API under the hood; restricting it strictly to the Picker API will cause requests to fail).
3. Save the key. Copy the generated **API Key** to use in the app environment variables (`VITE_GOOGLE_API_KEY`).

### Step 6: Configure the Workspace Marketplace SDK ("Open with" Integration)
1. Navigate to **APIs & Services** $\rightarrow$ **Enabled APIs & Services**, and select the **Google Workspace Marketplace SDK**.
2. Click **App Integration** $\rightarrow$ **Configuration**.
3. Enable the **Drive Extension** integration check.
4. Configure the **Open URL**:
   *   URL: `https://pewu.github.io/topola-viewer/` (or the corresponding deploy URL).
5. Set up **File Handlers**:
   *   Under **Default File Extensions**, register `.ged` and `.gdz`.
6. (Optional) Configure the **Store Listing** to publish the extension to the public Google Workspace Marketplace, making it searchable and installable for anyone.

## Testing Strategy

Due to the dependency on third-party external Google APIs and credentials, testing this feature is divided into automated mocking (for CI environments and unit tests) and manual verification (for local development).

### 1. Automated Unit Testing

All automated unit tests are run via **Jest**. Since Node environments do not load Google's external CDN scripts, we must isolate and mock these dependencies.

#### Mocking Global Scripts
Create a mock utility in the tests setup file to intercept calls to the global `google` and `gapi` interfaces:
```typescript
global.gapi = {
  load: jest.fn((api: string, callback: () => void) => callback()),
};

global.google = {
  accounts: {
    oauth2: {
      initTokenClient: jest.fn(() => ({
        requestAccessToken: jest.fn(),
      })),
    },
  },
  picker: {
    PickerBuilder: jest.fn(() => ({
      addView: jest.fn().mockReturnThis(),
      setOAuthToken: jest.fn().mockReturnThis(),
      setDeveloperKey: jest.fn().mockReturnThis(),
      setCallback: jest.fn().mockReturnThis(),
      build: jest.fn(() => ({
        setVisible: jest.fn(),
      })),
    })),
    DocsView: jest.fn().mockImplementation(() => ({
      setMimeTypes: jest.fn().mockReturnThis(),
      setQuery: jest.fn().mockReturnThis(),
    })),
    ViewId: {
      DOCS: 'doc',
      SHARED_WITH_ME: 'shared-with-me',
    },
  },
};
```

#### Data Source Tests
In `src/datasource/google_drive.spec.ts` [NEW]:
*   **Verify `isNewData()`**: Confirm it returns true only when the `fileId` changes.
*   **Verify `loadData()` Success**: Mock `window.fetch` to return a mock blob, mock `getAccessToken()` to return a dummy token, and verify the data source parses the file stream correctly.
*   **Verify `loadData()` Auth Failure**: Mock `getAccessToken()` to return `null` or configure `window.fetch` to return `403 Forbidden`, and assert that `GoogleDriveAuthError` is thrown.

#### URL Parsing & Orchestration Tests
In existing test suites or manual validation:
*   Verify that URL query arguments containing `source=google-drive&fileId=XYZ` are parsed into the correct `GoogleDriveSourceSpec`.
*   Verify that if `loadData()` throws `GoogleDriveAuthError`, the application transitions state, avoids setting a global error message, and triggers the rendering of the `<GoogleAuthModal />` fallback popup.

---

### 2. Manual Verification Checklist

Manual testing should be performed locally to verify the full OAuth loop and UI presentation:

| Test Case | Action | Expected Result |
| :--- | :--- | :--- |
| **Missing Credentials** | Run the app with empty `VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_API_KEY` values. | The Google Drive option is completely hidden from the TopBar menus; local file upload and WikiTree operations continue working normally. |
| **Picker Load** | Click "Load from Google Drive" in the menu, log in when prompted, select a `.ged`/`.gdz` file. | Google Picker popup closes, selected file is fetched directly from Google APIs, URL hash updates, and the family chart renders. |
| **Shared Link Auth Fallback** | Load: `http://localhost:3000/#/view?source=google-drive&fileId=UNAUTHORIZED_ID` | The "Google Drive Access Required" modal overlays the screen, preventing rendering. |
| **Grant Access Flow** | Click "Grant Access" in the fallback modal, authenticate, and pick the matching file from "Shared with me". | Modal closes, OAuth token gets authorized for the specific file ID, tree downloads and renders successfully. |
| **Google Drive UI Open** | Navigate to: `http://localhost:3000/?state={"ids":["FILE_ID"],"action":"open"}` | The app detects the `state` param, automatically prompts Google authentication, downloads the file, and opens the chart. |
| **Invalid Selection** | Pick a non-matching file from the fallback modal's picker. | App detects the mismatch, updates the URL to the new file's ID, downloads the newly picked file, and displays the tree. |

---

### 3. Continuous Integration (CI) Safety

*   In CI pipelines (e.g. GitHub Actions workflows), Google API keys are not present in the environment.
*   Because the feature checks for the presence of environment variables at compile/build time, the Google Drive menus are automatically omitted.
*   This ensures that visual regression tests (`npm run test:visual`) and E2E test runs (`npm run test:e2e`) pass without requiring live OAuth secrets or mock servers.

---

## Build and Deployment CI/CD Configuration

To enable the Google Drive integration on the official public deployments, the Google API credentials must be injected during the automated build process in GitHub Actions.

### Required GitHub Secrets
You must configure the following repository secrets in your GitHub project settings:
1.  `GOOGLE_CLIENT_ID`: The official OAuth Client ID for `pewu.github.io` / `apps.wikitree.com`.
2.  `GOOGLE_API_KEY`: The official Google Picker API Key.

### Workflow Modifications

The build step (`npm run build`) in the deployment workflows must receive these secrets as environment variables.

#### 1. Deployment to GitHub Pages (`.github/workflows/deploy-gh-pages.yml`)
Pass the secrets to the build step:
```yaml
    - run: npm run build
      env:
        VITE_GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
        VITE_GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
```

#### 2. Deployment to WikiTree Apps (`.github/workflows/deploy-wikitree-apps.yml`)
Pass the secrets to the build step:
```yaml
    - run: npm run build
      env:
        VITE_GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
        VITE_GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
```

#### 3. Reusable Workflow Inheritance (`.github/workflows/deploy-everywhere.yml`)
Enable secret inheritance on jobs calling these workflows to ensure secrets are propagated:
```yaml
  deploy-gh-pages:
    uses: ./.github/workflows/deploy-gh-pages.yml
    secrets: inherit
```

---

## Security and Privacy

Since Topola Viewer is a purely client-side application that manages sensitive genealogical data, security and user privacy are core design pillars for this integration.

### 1. Protection of Public API Credentials
The application's client-side architecture requires compiling the public Google `Client ID` and `API Key` directly into the JavaScript bundle. These values are protected from abuse using Google Cloud Platform constraints:
*   **OAuth Domain Whitelisting**: The `Client ID` restricts **Authorized JavaScript Origins** and **Redirect URIs** to `https://pewu.github.io`, `https://apps.wikitree.com`, and `http://localhost:3000`. Google's authorization server will automatically block login attempts initiated from any other domains.
*   **API Key Restrictions**: The `API Key` enforces **HTTP Referrer Restrictions** matching the authorized domains. Additionally, the key is scoped via **API Restrictions** to only permit requests to the **Google Picker API** and **Google Drive API**, preventing its use on other Google Cloud services.
*   **No Secrets Compiled**: The application never utilizes or compiles an OAuth `Client Secret`, which is only required for server-side integrations.

### 2. Data Privacy & Zero-Server Architecture
*   **Direct Client-to-Google Communication**: All requests to Google Drive APIs are initiated directly from the user's browser.
*   **No Third-Party Proxies**: To prevent token leakage and maintain data confidentiality, Google Drive downloads **never** route through the `topolaproxy.bieda.it` CORS proxy.
*   **Local Parsing**: The fetched GEDCOM or GEDZIP file content is parsed entirely within the browser using local JavaScript. No family data, files, or access tokens are ever transmitted to, processed by, or stored on external servers.
*   **Short-Lived Auth Tokens**: The application uses short-lived access tokens that expire automatically. No persistent refresh tokens are requested or stored.
*   **Session Storage Cache Security**: To optimize load times, parsed tree data is cached in `sessionStorage` under `google-drive:{fileId}`. To protect user privacy on shared or public computers, signing out or disconnecting Google Drive explicitly purges all `google-drive:*` keys from the browser's `sessionStorage`.

### 3. Principle of Least Privilege (OAuth Scopes)
Instead of requesting the broad `drive.readonly` scope, which grants visibility into a user's entire Google Drive, this feature utilizes the restrictive `drive.file` scope. Under this scope:
*   The application only has permission to view files that the user has explicitly opened with the app (either by selecting the file in the Google Picker or opening it via the "Open with" Google Drive UI option).
*   Topola Viewer remains blind to all other files and directories in the user's Google Drive.

## Known Limitations

1. **Image Loading from Plain `.ged` Files**: Only `.gdz` archives are supported for viewing media files from Google Drive. Plain `.ged` files will only display genealogical data, and any relative/external image paths will render as broken images because standard HTML `<img>` tags cannot transmit the `Authorization` header required for private Google Drive requests.
2. **Iframe Embedding (WikiTree)**: Running Google Drive authentication and loading files from Google Drive inside an embedding iframe (such as on `apps.wikitree.com`) can fail due to iframe popup sandboxing and origin mismatch restrictions. This configuration is not actively supported.
3. **Session Refresh Cache**: When a page is refreshed, zipped images cached in `sessionStorage` might have invalid Object URLs. We choose to ignore this problem until it becomes a visible UX issue.
4. **Access Modal Lockout**: If a user logs into a Google account that does not have permissions to read the file, they are prompted with the "Access Required" modal. Since this modal blocks the viewport, they cannot click the top-bar "Disconnect" button to switch Google accounts, requiring them to click "Cancel" to return to the homepage first.

---

## Future Improvements

1. **Self-Hosting Runtime Configuration Support**: Read `google-client-id` and `google-api-key` from HTML `<meta>` tags at runtime (similar to `topola-static-url`), allowing self-hosters to deploy and configure Google Drive support without rebuilding the static assets.
2. **Fetch Cancellation & Race Condition Mitigation**: Implement an `AbortController` or active boolean flag cancellation check in `app.tsx`'s `useEffect` loader to ensure slow background downloads do not overwrite newer datasets if a user changes the source/file before the previous request finishes.

