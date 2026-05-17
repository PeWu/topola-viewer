# Displaying Uploaded Images and Documents in the Details Side Panel

## Problem

When users upload genealogy data using GEDCOM ZIP (GDZ) files or by selecting local images alongside a GEDCOM file, the images display correctly on the family tree chart nodes. However, these same photos, as well as any other uploaded document attachments, fail to render in the details side panel and events list. This occurs because the side panel reads directly from the raw GEDCOM entries, which only contain relative local file paths that the browser cannot resolve. The goal of this feature is to pass the mapped local object URLs to the details panel and resolve these paths dynamically, ensuring a consistent and complete viewing experience for all uploaded media.

## The Technical Plan

To make uploaded images and files visible in the side panel, we will connect the loaded browser URL mapping to the components that display individual details and event lists.

The plan involves four major areas:
1. **Data Model Augmentation**: We will store the temporary file mapping (`images` map) in the main `TopolaData` container so it is available alongside the parsed GEDCOM data.
2. **Propagating the Mapping**: The main `App` component holds the loaded `TopolaData`. We will pass the `images` map as a prop to the `SidePanel` component, which will in turn pass it down to `Details` and `Events`.
3. **Resolving Relative Paths**: We will introduce a utility function that looks up relative paths or filenames in the `images` map. If a relative path is referenced in the GEDCOM, we will replace it with the resolved browser URL.
4. **Permissive File Extraction**: We will modify the parser utility to stop filtering out non-web paths (paths that do not start with `http`), allowing the application to process relative file paths.

## Alternatives Considered

### 1. Pre-resolving URLs Directly in the Raw GEDCOM Data Model
We considered modifying the parsed `GedcomData` object to replace relative file paths with `blob:` URLs at load time, similar to how we pre-process `chartData`.
* **Why Rejected**: `GedcomData` is designed to be a raw, immutable representation of the source GEDCOM file structure. Directly mutating this tree could break features that expect raw tag data (such as exports, raw view logs, or metadata parsing). Keeping the `images` resolver map separate maintains a clean separation of concerns and preserves the integrity of the original GEDCOM entries.

### 2. Base64-Encoding and Persisting Images in Session Storage
We considered serializing the local file contents as Base64 strings so they could be saved in `sessionStorage` and survive page reloads.
* **Why Rejected**: Browser `sessionStorage` is typically limited to 5MB. Genealogy ZIP archives can easily contain tens or hundreds of megabytes of media files, which would instantly exceed this quota and cause the application to crash. The performance cost of encoding and decoding large files in session storage is also prohibitive.

### 3. Rendering Placeholders for Unresolved Local Media References
We considered rendering warning cards or broken image placeholders for relative paths that cannot be resolved (i.e., when a GEDCOM lists a photo that wasn't included in the uploaded files/ZIP).
* **Why Rejected**: GEDCOM files created by desktop software often contain references to hundreds of local photos stored on the user's computer. Since users typically upload only the GEDCOM file (or a zip containing a subset of files), displaying error panels or placeholders for every missing image would clutter the UI. Returning `null` to gracefully hide missing media keeps the side panel clean and focused on available information.

### 4. Storing both full relative path and base filename in the `images` map
We considered storing files under both their full path (e.g. `photos/person.jpg`) and their base filename (e.g. `person.jpg`) inside the `images` map to handle cases where the GEDCOM file does not preserve the folder name.
* **Why Rejected**: We assume the GEDCOM file references files preserving the folder name as exported by the source application. Storing both keys could also lead to collisions if two different folders contain files with the same name.

## Detailed Implementation

This section lists every file that will be created or changed, the step-by-step changes, and the technical rationale.

### 1. [gedcom_util.ts](../src/util/gedcom_util.ts)
#### Proposed Changes:
* Update `TopolaData` interface to add `images?: Map<string, string>;`.
* In `convertGedcom`, return the input `images` map in the output object.
* Remove `entry.data.startsWith('http')` check inside `findFileEntry` and ensure `entry.data` is a non-empty string before running predicate checks to avoid crashes.
* Add `.webp` to the `IMAGE_EXTENSIONS` list to support modern image formats.
* Update `isImageFile` to strip query parameters (`?`) and hashes (`#`) from the path/URL before verifying the extension.
* Centralize filename extraction inside `getFileName`: if `TITL` or `FORM` is missing, extract the filename from `fileEntry.data` (normalizing backslashes to forward slashes and stripping query parameters or hashes first).
* Implement and export `isBrowserLoadable(url: string): boolean` which returns `true` if the URL starts with `http://`, `https://`, `blob:`, `data:`, or `//`.
* Implement and export `resolveFileUrl(url: string, images?: Map<string, string>): string`. This function:
  1. Returns the input URL immediately if it is browser-loadable (checked via `isBrowserLoadable`).
  2. Replaces all backslashes (`\`) with forward slashes (`/`).
  3. Checks the `images` map for the normalized lowercase path first, then for the lowercase base filename.
  4. Returns the mapped `blob:` URL if found; otherwise, returns the original normalized URL.
  * *Robustness check*: The function will safely check if `images` is a valid `Map` (using `images instanceof Map`) to avoid runtime errors when data is loaded from session storage.
* Refactor `getImageFileEntry` and `getNonImageFileEntry` to `getImageFileEntries` and `getNonImageFileEntries` to return all matching file entries within an `OBJE` tag, supporting multimedia objects with multiple file attachments.
* Update `filterImage` inside `gedcom_util.ts` to resolve the URL using the new `resolveFileUrl` helper, ensuring case-insensitive lookups for chart node images.

#### Rationale:
Extending the model interface `TopolaData` binds the lifetime of the `images` map to the active loaded dataset. Removing `startsWith('http')` allows extracting relative paths. Centralizing the loadability check, URL decoding, case normalization, and base filename extraction helpers avoids code duplication. Supporting multiple file entries per `OBJE` record aligns with the GEDCOM multimedia specifications.

### 2. [load_data.ts](../src/datasource/load_data.ts)
#### Proposed Changes:
* In `prepareData`, pass the `images` map parameter to `convertGedcom` and return it inside the resulting data object.
* Ensure that the `images` map is *not* stored in `sessionStorage` by explicitly deleting or omitting the `images` key before calling `JSON.stringify(data)` in `prepareData`. This guarantees that `data.images` will be `undefined` (and not a plain empty object `{}`) when restored from `sessionStorage`.
* In `loadGedzip`, store the unzipped files in the `images` map using lowercase keys and normalizing backslashes to forward slashes to ensure case-insensitive lookup.
* Wrap the unzipping/extraction loop in `loadGedzip` in a `try-catch` block. If extraction fails or no GEDCOM file is found, revoke all `blob:` URLs created so far in the loop.
* Implement `try-catch` cleanup blocks in both `loadGedcom` and `loadFromUrl` to ensure that if file loading or parsing throws an error, all `blob:` URLs in the `images` map are immediately revoked to prevent memory leaks.

#### Rationale:
Connects the ingestion pipeline to the `TopolaData` model. Deleting `images` prior to `sessionStorage` serialization prevents restoring a broken plain object `{}`. Adding try-catch blocks to cleanup `images` on loading or parsing failures prevents memory leaks from unrevoked `blob:` URLs.

### 3. [side-panel.tsx](../src/sidepanel/side-panel.tsx)
#### Proposed Changes:
* Locate `<Details>` rendering block inside the `tabs` definition.
* Pass the map to the details panel: `images={data.images}`.

#### Rationale:
Acts as the intermediary component that forwards data properties from the root application state to the details view pane.

### 4. [details.tsx](../src/sidepanel/details/details.tsx)
#### Proposed Changes:
* Update the `Props` interface for `Details` to accept `images?: Map<string, string>;`.
* Pass `props.images` to `imageDetails` and `fileDetails` (using inline arrow functions inside `getSectionForEachMatchingEntry` and `combineAllMatchingEntriesIntoSingleSection`), and `<Events ... images={props.images} />`.
* In `imageDetails`, retrieve all image file entries using `getImageFileEntries`. For each, resolve the URL using `resolveFileUrl(..., images)` and render `WrappedImage` with the resolved URL and its filename.
* In `fileDetails`, retrieve all non-image file entries using `getNonImageFileEntries`. For each, resolve the URL using `resolveFileUrl(..., images)` and pass the resolved URLs to `AdditionalFiles`.

#### Rationale:
Directly resolves image and non-image document URLs from the loaded files list. Iterating over all resolved files from `getImageFileEntries` and `getNonImageFileEntries` supports multiple attachments per object record.

### 5. [events.tsx](../src/sidepanel/details/events.tsx)
#### Proposed Changes:
* Update the `Props` interface for `Events` to accept `images?: Map<string, string>;`.
* Pass `images` to `toEvent` -> `toIndiEvent` & `toFamilyEvents` -> `eventImages` & `eventFiles`.
* In `eventImages(entry, gedcom, images)`, extract all image files using `getImageFileEntries`. For each, resolve the URL using `resolveFileUrl` and add to the returned array.
* In `eventFiles(entry, gedcom, images)`, extract all non-image files using `getNonImageFileEntries`. For each, resolve the URL using `resolveFileUrl` and add to the returned array.

#### Rationale:
Allows life events to load, resolve, and render all associated media files, supporting multiple files and case-insensitive resolution.

### 6. [additional-files.tsx](../src/sidepanel/details/additional-files.tsx)
#### Proposed Changes:
* Map file extensions to Semantic UI icons (e.g. `file pdf outline` for PDF, `file image outline` for images, etc.) to improve the design aesthetics.
* Add the `download` attribute to the `<a>` tag for `blob:` URLs to trigger a file download instead of triggering browser security blocks on top-level navigations:
  ```typescript
  download={file.url.startsWith('blob:') ? file.filename || true : undefined}
  ```
* Update `AdditionalFiles` component to check if the file is browser-loadable using `isBrowserLoadable(file.url)`. For non-loadable URLs:
  - Do not render the `<a>` link (thus preventing download/navigation actions).
  - Render the filename as grayed-out plain text with an italicized `(File not uploaded)` helper message.

#### Rationale:
Implements premium file icon layouts based on file types. Adding the `download` attribute is critical to bypass browser-level blocks on opening `blob:` URLs in new tabs. Checking loadability prevents users from navigating to broken local paths.

### 7. [wrapped-image.tsx](../src/sidepanel/details/wrapped-image.tsx)
#### Proposed Changes:
* Update `WrappedImage` to check if `props.url` is browser-loadable using `isBrowserLoadable`. If not, immediately render a clean gray card placeholder (displaying the image icon, the title or filename, and a "File not uploaded" badge) without rendering the `<img>` tag or trying to load the image.

#### Rationale:
Prevents browser 404/CORS console errors when attempting to load raw local relative paths as images, presenting a consistent and clean "File not uploaded" message to the user instead.

### 8. [app.tsx](../src/app.tsx)
#### Proposed Changes:
* Add a `useEffect` cleanup hook in the `App` component that monitors changes to the active `data` state. When `data` changes, it iterates over the old `data.images` map and calls `URL.revokeObjectURL(url)` for all `blob:` URLs.
* In the path routing `useEffect` of the `App` component, if the path is not `/view`, explicitly reset the `data` state to `undefined`. This triggers the cleanup hook to revoke all active `blob:` URLs when leaving the chart viewer (e.g. going back to the landing page).

#### Rationale:
Prevents browser memory leaks from unrevoked object URLs when users upload and switch between different genealogy files, or navigate away from the viewer.

### 9. [upload_menu.tsx](../src/menu/upload_menu.tsx)
#### Proposed Changes:
* Update the file input `accept` attribute to allow selecting `.webp` images.
* Remove the local `isImageFileName` helper function and import `isImageFile` from `gedcom_util.ts` to ensure consistent file extension support.
* Convert individually uploaded filenames to lowercase when storing them as keys in the `images` map to ensure case-insensitive matching:
  ```typescript
  images.set(file.name.toLowerCase(), URL.createObjectURL(file));
  ```

#### Rationale:
Extends modern image format support and unifies the image extension logic across the codebase. Storing keys as lowercase enables case-insensitive lookups for individually uploaded files.

### 10. [Translation JSON Files](../src/translations/)
#### Proposed Changes:
* Add the localization key `"media.not_uploaded"` to all translation files (`bg.json`, `cs.json`, `de.json`, `fr.json`, `it.json`, `pl.json`, `ru.json`).

#### Rationale:
Ensures the new "File not uploaded" text badge is localized in all supported languages of the application.

## Verification Plan

We will verify the changes using automated unit tests, end-to-end regression checks, and manual visual testing.

### Automated Unit Tests
We will run and add unit tests to ensure correct data resolution:
1. **Existing Test Verification**: Run `npm test` to verify all current unit tests pass.
2. **`resolveFileUrl` Unit Tests**: Add tests in `src/util/gedcom_util.spec.ts` to verify:
   - Resolving a relative path that matches a key in the `images` map returns the correct `blob:` URL.
   - Resolving a filename that matches a key in the `images` map returns the correct `blob:` URL.
   - Resolving a URL that doesn't exist in the `images` map returns the original URL unchanged.
3. **`findFileEntry` Permissive Extract**: Add tests in `src/util/gedcom_util.spec.ts` to verify that `findFileEntry` matches and returns local relative `FILE` entries (e.g., `images/photo.jpg`), which were previously filtered out.
4. **Session cache recovery verification**: Add a test that verifies reloading the page correctly loads data from `sessionStorage` when `data.images` is `undefined`, ensuring no crashes occur.

### Playwright Visual & E2E Tests
We will add automated verification of the upload flow and visual rendering:
1. **Add visual test**: Create a new test case in `tests/details_visual.spec.ts`:
   - Start at `/`.
   - Setup Playwright's `filechooser` listener.
   - Trigger the file upload menu, select and upload the `src/datasource/testdata/test.gdz` file.
   - Click the node for the individual that contains the photo (e.g., Radobod).
   - Wait for the side panel to open and the image to load.
   - Match sidebar screenshot against a visual regression baseline (`details-uploaded-gdz-photo.png`).
2. **Add missing file placeholder test**: Verify that if a linked attachment is missing, a "File not uploaded" label or placeholder card renders in the details pane, matching a baseline screenshot.
3. Run `npm run test:visual` to confirm tests execute and pass.

### Manual / Visual Verification
We will manually verify the visual rendering on a local development server:
1. Run `npm run dev` to launch the local application.
2. Prepare a test GDZ file: Zip the contents of the `docker/examples/photos` directory (which contains `family.ged` referencing relative photo paths under a `photos` subfolder).
3. Upload the resulting GDZ file to the application.
4. Verify that:
   - The primary individual's photo displays correctly in the side panel Details tab.
   - Any documents or images linked to events (such as birth or marriage events) are rendered correctly in the event info cards.
   - GEDCOM files referencing missing images render "File not uploaded" placeholders gracefully instead of breaking or showing broken image icons.

## Future Considerations

### IndexedDB for Upload Persistence
Currently, we reject persisting images in `sessionStorage` due to the 5MB size limit. In the future, we could consider using **IndexedDB** to store the zipped `.gdz` archives or the extracted file blobs. Since IndexedDB supports much larger storage quotas (typically hundreds of megabytes or more), this would allow uploaded genealogy trees and their media attachments to persist across page reloads and browser restarts, providing a much smoother user experience.

