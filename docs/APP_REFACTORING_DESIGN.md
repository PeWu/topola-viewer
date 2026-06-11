# Refactoring App.tsx Design Document

## Problem Description
The main application component, [App](../src/app.tsx), has grown into a large and complex monolith that coordinates URL routing, query parameter synchronization, asynchronous data fetching, UI layout rendering, and external integrations like the WebMCP bridge. Because these distinct responsibilities are combined within a single file, the codebase has become difficult to navigate, test, and safely modify without introducing unintended regressions. This refactoring effort aims to systematically decouple these concerns by decomposing the monolith into small, single-responsibility modules, separating the page-level UI layouts, and establishing the URL query parameters as the single source of truth for viewer state.

## The Technical Plan

At a high level, the refactored architecture splits user interface representation from business logic and external connections. Instead of a single central orchestrator holding all states, the app relies on the browser's URL to drive the active view and delegates sub-features (like data fetching, authentication, and external syncing) to dedicated hooks and services.

### Explanatory Overview

*   **Routing & Page Views:** The root [App](../src/app.tsx) component will serve purely as a routing switch, but will retain the Google Drive "Open with" flow redirection logic. It decides whether to display the landing screen (`IntroPage`) or the visual family tree explorer (`ViewPage`). It is also responsible for stripping external authorization query parameters (like `state` and `authcode`) from the browser window's URL.
*   **Layout Nesting (TopBar & SidePanel):** Rather than having a global layout shell wrapping all pages, each page will compose its own layout explicitly. This allows the `ViewPage` to pass live chart selection data, configuration, and export triggers directly to its own rendered `TopBar`, while the `IntroPage` remains clean and completely decoupled from viewer states. To prevent locking the user interface on loading errors, `ViewPage` will render the `TopBar` even when in loading or error states.
*   **URL as Single Source of Truth (SSOT):** Rather than keeping user settings (like the selected person, active chart view, and display preferences) in temporary React memory and continuously syncing them to the URL, the application will read these properties directly from the URL query string on every render. This includes the detail selection sidebar state (`detailIndi` will map to `?detail=...`). Changing a setting now simply updates the browser's URL, and React automatically updates the view.
*   **Data Service Layer:** All logic involved in downloading, caching, and parsing GEDCOM or WikiTree files from different sources is fully isolated from the user interface, triggered via a unified API spec on the `ViewPage`.
*   **WebMCP & Auth Hooks:** Third-party integrations and security layers (like the WebMCP developer bridge and Google Drive sign-in states) are extracted into custom React hooks. These hooks manage side effects independently, removing clutter from the layout rendering code.

## Alternatives Considered

### 1. Global State / Prop Drilling in Root Component
*   **Approach:** Keep all the viewer and configuration state inside the root `App` component and pass them down as props to the nested components (such as `IntroPage` and `ViewPage`).
*   **Why Rejected:** This would fail to address the core problem. The root `app.tsx` file would remain a massive state-managing monolith containing dozens of hooks and effects, making it just as hard to maintain and test as before.

### 2. React Context for Viewer Session
*   **Approach:** Create a global React Context (e.g., `GenealogySessionContext`) that holds the active viewer's data, parameters, and callback handlers, and wrap the application root in a Context Provider.
*   **Why Rejected:** While a valid pattern, introducing Context adds boilerplate and can lead to unnecessary re-renders. Explicit page-level nesting—where `ViewPage` and `IntroPage` each explicitly render their own `TopBar` headers—is a simpler and more isolated design. It allows components to consume direct, local props without global state providers.

### 3. React-State-to-URL Syncing (Bidirectional Sync)
*   **Approach:** Maintain React state variables (`useState`) for the selected individual, chart view type, and configuration, and keep them synchronized with the URL query parameters using `useEffect` loops.
*   **Why Rejected:** Bidirectional synchronization is extremely error-prone and a frequent cause of infinite rendering loops and race conditions (especially with async network requests). Transitioning to the **URL as the Single Source of Truth** (deriving all active states directly from the URL on render) completely removes the sync hooks and ensures browser back/forward buttons work correctly out of the box.

### 4. Component-First Refactoring (Extracting Visual Leaf Nodes)
*   **Approach:** Start by extracting pure UI layout leaf nodes (such as the chart display wrappers or sidebar layouts) before addressing the business logic.
*   **Why Rejected:** The primary complexity in `app.tsx` lies in the lifecycle management and side effects, not the JSX markup size. Starting with leaf components leaves the complex state orchestrations untouched. Instead, we prioritized extracting utility modules, isolated background hooks (like `WebMcpBridge`), and transitioning states to the URL before separating UI pages.

## Detailed Implementation

To refactor `app.tsx` safely and maintain continuous code correctness, we will modify one file and create eight new ones. This section maps out the role of each file and the step-by-step implementation plan.

### Affected Files and Rationale

#### 1. [MODIFY] `src/app.tsx`
*   **Role:** Will be stripped down to a lightweight Router component that only defines page-level paths, coordinates Google Drive "Open with" redirection synchronously on render, and renders `<IntroPage />` or `<ViewPage />`.
*   **Rationale:** Eliminates the monolithic coordinator by delegating view orchestration, state synchronization, and page rendering to dedicated page components and hooks, while retaining initial payload interception.

#### 2. [NEW] `src/components/error_display.tsx`
*   **Role:** Will contain the presentational components `ErrorMessage` and `ErrorPopup`.
*   **Rationale:** Keeps simple UI leaf components separated from the main business logic and state coordinates.

#### 3. [NEW] `src/datasource/instances.ts`
*   **Role:** Declares and exports global datasource class instances (`uploadedDataSource`, `gedcomUrlDataSource`, `embeddedDataSource`, `googleDriveDataSource`).
*   **Rationale:** Avoids declaring stateful data service instances inside layout and view components, improving separation of concerns.

#### 4. [NEW] `src/util/url_args.ts`
*   **Role:** Exports `getStaticUrl`, `getParamFromSearch`, and `getArguments` utility functions, along with their related TypeScript interfaces (`Arguments`, `DataSourceSpec`), including support for the `detail` query parameter. It also provides a pure helper function (`getUrlForArgs`) that accepts current/new arguments and returns a path/query object suitable for passing to React Router's `navigate` function.
*   **Rationale:** Moves parsing and decoding logic for query strings out of the React components, allowing this code to be tested independently in isolation.

#### 5. [NEW] `src/util/url_args.spec.ts`
*   **Role:** Jest unit tests verifying the correctness of `getArguments` under different query configurations (e.g. WikiTree authcodes, Google Drive file IDs, static URLs, local uploads).
*   **Rationale:** URL parsing acts as the gateway to all loader code; ensuring this logic is 100% correct via unit testing prevents regressions during URL SSOT changes.

#### 6. [NEW] `src/hooks/use_webmcp_bridge.ts`
*   **Role:** Custom React hook `useWebMcpBridge(data, detailIndi, onSelection)` called in `ViewPage` encapsulating the WebMCP bridge creation, tool registration, state synchronization, and cleanup effects.
*   **Rationale:** Isolates external developer tools syncing from the UI components.

#### 7. [NEW] `src/hooks/use_google_auth.ts`
*   **Role:** Custom React hook `useGoogleAuth()` encapsulating access to the global `googleDriveService` authentication token, session storage cache clearing, and login/logout trigger states.
*   **Rationale:** Provides shared authentication state that can be consumed by the `TopBar` headers of both page components without needing parent state lifting.

#### 8. [NEW] `src/pages/view_page.tsx`
*   **Role:** The page view orchestrating the chart visualizer workspace. It handles asynchronous loader triggers, keeps local data loading states, derives view configurations from the URL, and renders the Sidebar, SidePanel, and its own explicit `TopBar` (including rendering on loading/error states). It also hosts the state and rendering for `<GoogleAuthModal>` to handle Google Drive auth errors caught during data loading, handles memoization of `WikiTreeDataSource` (due to its react-intl context requirement), performs Object URL cleanup on unmount, and runs `updateChartWithConfig` synchronously during the render pass to synchronize URL-derived configuration settings with the in-memory mutated chart data.
*   **Rationale:** Consolidates the chart workspace state and render tree away from the root router component.

#### 9. [NEW] `src/pages/intro_page.tsx`
*   **Role:** The landing page component wrapping the `Intro` presentation and rendering its own simple `TopBar`.
*   **Rationale:** Decouples the landing screen structure from the chart visualizer's stateful layout shell.

---

### Step-by-Step Execution Plan

#### Phase 1: Pure Component and Utility Extraction
*   [x] **Step 1.1:** Create `src/components/error_display.tsx` and move `ErrorMessage` and `ErrorPopup` from `src/app.tsx`. Update imports in `src/app.tsx`.
*   [x] **Step 1.2:** Create `src/datasource/instances.ts` and move data source class instantiations. Update references in `src/app.tsx`. Refactor `EmbeddedDataSource` to clean up its message event listener when the loading promise resolves or rejects (or track listener state) to prevent duplicate event listener leaks on multiple page mounts.
*   [x] **Step 1.3:** Create `src/util/url_args.ts` (the parsing utility) and `src/util/url_args.spec.ts` (its Jest unit test suite) together. Extract URL query parameter parsing functions and types from `src/app.tsx`, write comprehensive tests, update imports in `src/app.tsx`, and run `npm test` to verify.
*   [x] **Step 1.4:** Modify `src/menu/top_bar.tsx` to make chart-specific props and event handlers optional (e.g. `data`, `allowAllRelativesChart`, `allowPrintAndDownload`, `eventHandlers`, etc.), preparing the component for rendering on the landing screen without dummy properties.

#### Phase 2: WebMCP Bridge Extraction
*   [x] **Step 2.1:** Create `src/hooks/use_webmcp_bridge.ts` wrapping WebMCP registration and synchronization effects.
*   [x] **Step 2.2:** Replace the inline WebMCP logic and `useEffect` blocks in `src/app.tsx` with a single call to the custom `useWebMcpBridge` hook. Verify using `npm test`. Note: During Phase 4, this hook call will be moved from `src/app.tsx` into `src/pages/view_page.tsx` where the layout state is relocated.

#### Phase 3: Shifting to URL as Single Source of Truth
We will gradually eliminate React state variables in `src/app.tsx` and derive them (including settings like `standalone`, `showWikiTreeMenus`, and `freezeAnimation`) directly from the `useLocation()` search query parameters on render:
*   [x] **Step 3.1a:** Shift `chartType` to URL as SSOT. Derive it using `useMemo` from search parameters, replace calls to `setChartType` with URL updates, and remove the React state variable and sync effect.
*   [x] **Step 3.1b:** Shift `standalone` to URL as SSOT. Derive it directly from search parameters on render and remove its React state variable.
*   [x] **Step 3.1c:** Shift `showWikiTreeMenus` to URL as SSOT. Derive it directly from search parameters on render and remove its React state variable.
*   [x] **Step 3.1d:** Shift `freezeAnimation` to URL as SSOT. Derive it directly from search parameters on render and remove its React state variable.
*   [x] **Step 3.2:** Extract `selection` and `detailIndi` state. Parse them directly from URL params (`indi`, `gen`, and `detail`); update display selectors. Remove React states. Ensure that chart selection changes (`onSelection` callback) explicitly clear or update the `detail` query parameter to match the new selection to avoid getting stuck on the old details viewport. Also update the detail-only selection handler (`onDetailSelection`) to update the `detail` query parameter in the URL.
*   [x] **Step 3.3:** Extract `showSidePanel` state. Derive state directly from `?sidePanel=` parameter. Remove React state. Enhance URL args helpers to allow generating path/query target objects with replaced values, and ensure layout settings (`sidePanel`) and configuration changes use `replace: true` to prevent polluting the browser history stack.
*   [ ] **Step 3.4:** Extract `config` state. Parse display settings on render using `argsToConfig` helper. Remove state. In `ViewPage`, run `updateChartWithConfig(config, data)` synchronously during the render pass (e.g. in the `useMemo` that derives query parameters/config) to update the in-memory chart data before it is rendered by the `<Chart>` child component. Run E2E and visual tests to verify no rendering regressions occurred.

#### Phase 4: Structural Page Nesting
*   [ ] **Step 4.1:** Create `src/hooks/use_google_auth.ts` to manage Google Drive authentication token updates. Remove `hasGoogleToken` state from `src/app.tsx`.
*   [ ] **Step 4.2:** Create `src/pages/view_page.tsx` containing layout rendering (`renderMainArea`), asynchronous data loaders, view state management, `revokeObjectUrls` cleanups, and `<GoogleAuthModal>` error fallback state and rendering.
*   [ ] **Step 4.3:** Create `src/pages/intro_page.tsx` rendering the landing screen and its own local header.
*   [ ] **Step 4.4:** Refactor `src/app.tsx` to serve as a pure routing switch routing to `<IntroPage />` or `<ViewPage />`. In `App`, handle Google Drive redirection synchronously during the render pass by returning a `<Navigate replace />` element (preventing render flashing), and ensure the redirection parser checks both the router `location.search` and the external `window.location.search` to handle HashRouter query structure robustly. Once external parameters (like `state` or `authcode`) are detected, they must be stripped from `window.location.search` using `window.history.replaceState` to prevent redirection loops on page refresh. Remove all layout state logic from the root file, including moving the `useWebMcpBridge` hook invocation into `<ViewPage />`. Run final verification scripts (`npm run check:all`).

## Future Considerations

### 1. Image Object URL Memory Management
*   Instead of managing image revocation inside the component lifecycle (which can break back-navigation since the `ViewPage` unmounts and revokes URLs), we will explore having the global datasource singletons in `instances.ts` (such as `UploadedDataSource` and `GoogleDriveDataSource`) manage the lifetime of their image URL maps. When `loadData` is called on a datasource, it will check if it has a reference to a previous image map and explicitly revoke it before loading the new dataset.

### 2. TopBar Layout Refactoring
*   Refactor `top_bar.tsx` to make all chart-specific event handlers and properties optional, or split the header layout from the stateful workspace menus. This will eliminate passing dummy or empty handlers from the `IntroPage`.




