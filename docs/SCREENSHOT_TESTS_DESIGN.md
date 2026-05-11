# Screenshot Testing Design Document

## 1. Problem Statement

Topola Viewer is a highly interactive, visual genealogy exploration tool that renders family trees using complex SVG layouts and D3 configurations. As the codebase evolves, minor updates to CSS styles, React components, or underlying layout algorithms can easily introduce subtle visual regressions—such as overlapping text labels, misaligned parent-child connector lines, or broken formatting in the side panels—that standard text-based DOM tests cannot detect. To prevent these visual bugs from reaching production, we are introducing an automated screenshot (visual regression) testing suite using Playwright. This testing suite will capture pixel-perfect snapshots of critical interface states, automatically flag unintended visual changes, and guarantee a consistently polished, premium user experience across all releases.

## 2. The Technical Plan

To consistently verify the user interface without introducing complex setups, the screenshot testing framework is built on a local-first, self-contained execution model. It operates by launching a virtual web browser, running the Topola Viewer application inside it, and checking it against stored master images (baselines).

This setup consists of four major parts working in harmony:

1. **The Test Orchestrator (Playwright):** This acts as the central manager. It starts our local web server, launches virtual browser instances, automates user actions (such as clicking buttons or navigation links), captures the screenshots, and does the pixel-by-pixel comparison against our baseline master images.
2. **The Local Web Server:** A background web server hosting the Topola Viewer application code. It serves the frontend interface directly to the virtual browser so that the test context runs identically to our actual user deployments.
3. **The Network Traffic Controller (Route Interceptor):** An in-memory network router managed by the orchestrator. When the browser attempts to download a genealogy file (e.g., `family.ged`) or load a person's photo, the router intercepts that request and immediately answers it with tiny, predefined test datasets (fixtures). This guarantees that the test runs completely offline, remains blazingly fast, and has absolute visual predictability.
4. **The Environment Sanitizer:** A tiny automated script executed directly inside the browser window right before a screenshot is snapped. Its only job is to locate and overwrite dynamic or shifting text elements (like Git commit hashes or changelog dates) with fixed placeholders, ensuring they do not trigger false test failures.

## 3. Alternatives Considered & Rejected

To prevent future developer friction, avoid redundant debugging cycles, and establish firm design guardrails, the following technical alternatives were evaluated and rejected:

### Alternative A: Global Animation Freezing (`freeze=true` Query Parameter)
* **Considered:** Forcing Topola's SVG engine to completely freeze all animations globally in E2E tests to prevent visual capturing mismatches.
* **Why Rejected:** Topola Viewer's initial chart mounting is entirely static; D3 transitions are only triggered during interactive navigation (e.g., clicking to shift focus to a child node). Since the target snapshots capture the initial mount of a chart or isolated panel element, introducing a complex global animation freezing hook is redundant. Instead, utilizing Playwright's standard auto-waiting mechanism (which pauses until the SVG is fully loaded and stationary) provides flawless, stable captures naturally.

### Alternative B: Monolithic Reference GEDCOM File (`rich_details.ged`)
* **Considered:** Maintaining a single, massive master `.ged` file containing a wide collection of custom individuals (with complex names, nested attributes, attached photos, and custom events) to serve all tests.
* **Why Rejected:** Monolithic test fixtures introduce severe coupling and high maintenance overhead. If a developer tweaks a birth record to debug an event-layout test, it can unintentionally shift elements in unrelated parts of the tree, failing baselines for name-formatting or photo rendering. Instead, creating microscopic, ad-hoc GEDCOM strings inline within each test case guarantees complete visual isolation, makes test intents instantly readable, and speeds up parsing.

### Alternative C: Build-Time Environment Variable Overrides (Git SHA/Time)
* **Considered:** Overriding `VITE_GIT_TIME` and `VITE_GIT_SHA` at build time specifically for E2E testing.
* **Why Rejected:** In production gating pipelines (such as GitHub Actions), the application is built and packaged into production-ready assets before the E2E job begins execution. Re-compiling Vite assets solely to inject static E2E values is slow, resource-intensive, and violates the rule of testing the exact binary that will be deployed. Instead, executing an in-browser DOM override (`page.evaluate`) right before screenshot execution is lightweight, self-contained, and requires zero alterations to the build flow or production bundle.

### Alternative D: Strict Pixel-Perfect Matching (Zero-Tolerance)
* **Considered:** Requiring absolute, 100% visual equivalence with zero pixel mismatch allowed.
* **Why Rejected:** Slight discrepancies in font rendering, subpixel antialiasing, and color blending are unavoidable across different operating systems (macOS developers vs. Linux CI agents). Enforcing zero-tolerance leads to extremely brittle tests that fail constantly due to harmless system-level rendering differences. Instead, setting relaxed thresholds (`maxDiffPixelRatio: 0.05` and `threshold: 0.2`) filters out system noise while aggressively catching genuine layout bugs, overlapping elements, and formatting failures.

## 4. Detailed Implementation Plan

This section defines the granular, step-by-step implementation steps and enumerates every file that will be created or modified to complete this visual regression framework.

### A. Enumeration of Files

#### 1. Files to [MODIFY]

*   **[playwright.config.ts](../playwright.config.ts)**
    *   *Rationale:* Isolate visual regression tests into a separate Playwright project (separate from standard functional E2E tests). This allows applying dedicated visual settings (like viewport locking, automatic scrollbar hiding, and custom screenshot mismatch thresholds) exclusively to visual tests without polluting standard E2E runs. Threshold settings are configured globally under `expect.toHaveScreenshot`.
*   **[package.json](../package.json)**
    *   *Rationale:* Add dedicated npm script commands to target the standard E2E project (`--project=e2e`) and the isolated visual testing project (`--project=visual`), preventing slow screenshot tests from bloating standard developer verification cycles.

#### 2. Files to [NEW]

*   **`tests/helpers.ts`**
    *   *Rationale:* Provide shared E2E/visual testing helper utilities. Features `setupHermeticEnvironment()` to abort external tracking requests and embed local fonts (ensuring offline hermetic execution) and `setupGedcomRoute()` to serve a standard mock `.ged` dataset.
*   **`tests/intro_visual.spec.ts`**
    *   *Rationale:* Verify the landing page layout, copy block positions, and logo alignments. Employs an in-browser DOM script to overwrite dynamic footer versioning and dynamic changelog blocks prior to capture, ensuring baseline immunity.
*   **`tests/charts_visual.spec.ts`**
    *   *Rationale:* Verify chart canvas boundaries, nodes, colors, and connections. Iterates over three of the supported layouts (`Hourglass`, `Relatives`, `Donatso`) using a simple tree, and captures screenshots of the stabilized D3 canvas.
*   **`tests/details_visual.spec.ts`**
    *   *Rationale:* Verify details panel formats, image margins, fact headers, and sources. Defines tiny, ad-hoc mock GEDCOM inline strings for individual edge cases (long multi-part names, attached images, nested events) and serves pre-existing photo assets (e.g. `docker/examples/photos/photos/I1.jpg`) to render photos without broken image layouts.
*   **`tests/config_visual.spec.ts`**
    *   *Rationale:* Verify the visual synchronization between Side Panel settings checkboxes/radio inputs and the SVG canvas. Captures full-viewport screenshots (at 1280x720) across the three curated configuration combinations.

### B. Step-by-Step Execution Plan

#### Step 1: Visual Project Isolation & Script Provisioning
1. Open `playwright.config.ts` and configure separate projects within the projects array:
   * Define an `e2e` project using desktop Chrome settings that matches all `.spec.ts` files (`testMatch`) but excludes `*_visual.spec.ts` files (`testIgnore`).
   * Define a dedicated `visual` project that matches only `*_visual.spec.ts` files (`testMatch`), and locks the browser viewport to a width of `1280` and height of `720` pixels in the `use` configuration.
2. Configure custom visual expectation thresholds globally under `expect.toHaveScreenshot` (specifically setting `maxDiffPixelRatio` to `0.05`, `threshold` to `0.2`, and `animations` to `'disabled'`).
3. Open `package.json` and update the scripts to target standard and visual projects respectively:
   * `"test:e2e": "playwright test --project=e2e"` to run functional E2E tests exclusively.
   * `"test:visual": "playwright test --project=visual"` to run visual regression tests exclusively.
   * `"test:visual:update": "playwright test --project=visual --update-snapshots"` to automatically regenerate baseline reference files.

#### Step 2: Landing Page Visual Validation Spec (`tests/intro_visual.spec.ts`)
1. Define a test block marked with the `@visual` tag, utilizing `setupHermeticEnvironment` helper in `beforeEach`.
2. Instruct the browser to navigate to the root path `/`.
3. Right before assertion, trigger `page.evaluate` to clean dynamic elements:
   * Target the `.version` class element and set `.innerText = "version: 2026-01-01 00:00 (testcommit)"`.
   * Target the changelog element (the container immediately following the "What's new" heading) and replace its HTML with a static placeholder change entry.
4. Snap the screenshot using `expect(page).toHaveScreenshot('intro-page.png')`.

#### Step 3: Core SVG Canvas Layouts Spec (`tests/charts_visual.spec.ts`)
1. Set up a `beforeEach` block that initializes `setupGedcomRoute(context)` from `helpers.ts` to intercept `**/family.ged` requests and fulfill them with raw GEDCOM test data.
2. Write tests with the `@visual` tag iterating through the 3 supported layouts (`hourglass`, `relatives`, `donatso`):
   * Set browser route to `/#/view?url=https://example.org/family.ged&view=[hourglass|relatives|donatso]`.
   * Determine the appropriate container selector: `#dotatsoSvgContainer` if the view is `donatso`, otherwise `#svgContainer`.
   * Locate the container element, and call `locator.waitFor()` to ensure the element is fully attached and visible.
   * Wait for D3 rendering and layout stabilization using a brief layout-specific timeout (`waitTime`: `500ms` for hourglass/relatives, `1500ms` for donatso).
   * Capture the isolated canvas screenshot: `expect(container).toHaveScreenshot('chart-[type].png')`.

#### Step 4: Details Panel Layouts Spec (`tests/details_visual.spec.ts`)
1. Set up a `beforeEach` block to establish hermetic routes via `setupHermeticEnvironment(context)`.
2. Define isolated test blocks with the `@visual` tag, each loading its own dedicated inline micro-GEDCOM dataset:
   * **Complex Names Test:**
     * Mock `**/family.ged` with a GEDCOM string containing prefix/suffix/rufname tags.
     * Navigate to the view route with `sidePanel=true`, locate the side panel container `#sidebar`.
     * Assert sidebar visual representation: `expect(page.locator('#sidebar')).toHaveScreenshot('details-complex-name.png')`.
   * **Image / Photo Rendering Test:**
     * Mock `**/family.ged` containing an `OBJE` tag pointing to a photo path (e.g. `photos/I1.jpg`).
     * Intercept requests for `**/photos/I1.jpg` and fulfill the request by serving the project asset `docker/examples/photos/photos/I1.jpg`.
     * Navigate, wait for the image load handler to complete (`img.waitFor({state: 'visible'})` and checking `image.complete` status).
     * Assert sidebar visual representation: `expect(page.locator('#sidebar')).toHaveScreenshot('details-photo-render.png')`.
   * **Custom Facts & Citations Test:**
     * Mock `**/family.ged` containing complex nested fact (`FACT`), source (`SOUR`), and note (`NOTE`) trees.
     * Select the individual and wait for `#sidebar` to load.
     * Assert sidebar visual representation: `expect(page.locator('#sidebar')).toHaveScreenshot('details-events-sources.png')`.
   * **Immediate Family Rendering Test:**
     * Mock `**/family.ged` containing an individual with explicit parental links (`FAMC`) and multi-partner spousal families (`FAMS`) to display biological parents, spouses, and chronologically sorted children blocks.
     * Select the individual and wait for `#sidebar` to load.
     * Assert sidebar visual representation: `expect(page.locator('#sidebar')).toHaveScreenshot('details-immediate-family.png')`.

#### Step 5: Configurations Integration Spec (`tests/config_visual.spec.ts`)
1. Define a test block tagged `@visual` with a locked browser window viewport size of `1280x720` via `playwright.config.ts`.
2. In `beforeEach`, mock `**/family.ged` using `setupGedcomRoute(context)`, load `/view?sidePanel=true`, wait for `#sidebar` and `#content` to be visible, and click the "Settings" tab (`await page.getByText('Settings', {exact: true}).click();`) to expose config fields.
3. Assert the **Default Configuration (State 1)**:
   * Verify that both the checkbox states and the corresponding generation-colored SVG boxes are in alignment.
   * Assert the entire integrated screen: `expect(page).toHaveScreenshot('config-state-default.png')`.
4. Automate panel clicks: Scope locators using `page.locator('form.details .item')` to target the "Colors" and "IDs" section items. Select the "by sex" color radio button and select the "hide" IDs option.
5. Wait for updates (`page.waitForTimeout(300)`) and assert the **Sex Colors & No IDs Configuration (State 2)**:
   * Assert the entire integrated screen: `expect(page).toHaveScreenshot('config-state-gender-no-ids.png')`.
6. Automate panel clicks: Scope locators using `page.locator('form.details .item')` to target the "Colors" and "Sex" section items. Select the "none" color radio button and select the "hide" sex option.
7. Wait for updates (`page.waitForTimeout(300)`) and assert the **Minimalist Configuration (State 3)**:
   * Assert the entire integrated screen: `expect(page).toHaveScreenshot('config-state-minimalist.png')`.

## 5. CI/CD Pipeline Integration

To ensure that no visual regressions are introduced into the master branch, the visual testing suite is integrated into the GitHub Actions CI/CD workflow ([node.js.yml](../.github/workflows/node.js.yml)) alongside existing tests.

### Pipeline Configuration
Visual tests run sequentially after standard E2E tests. The workflow executes the following steps:
1. **Install Dependencies:** Resolves Node.js package dependencies and installs/caches Playwright browser binaries (specifically `chromium`).
2. **Run E2E Tests:** Runs standard functional tests using `npm run test:e2e`.
3. **Run Visual Tests:** Runs visual regression tests using `npm run test:visual`.

### Playwright HTML Reports in CI
To prevent test reports from overwriting each other, the HTML reports for the different testing suites are output to distinct subdirectories within the `playwright-report` folder:
* **E2E Tests:** Saved to `playwright-report/e2e` by setting the `PLAYWRIGHT_HTML_REPORT` environment variable.
* **Visual Tests:** Saved to `playwright-report/visual` by setting the `PLAYWRIGHT_HTML_REPORT` environment variable.

Both reports are bundled and uploaded as a single workflow artifact (`playwright-report-${{ matrix.node-version }}`) on completion, allowing easy review of failures.

