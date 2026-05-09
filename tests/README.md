# End-to-End & Visual Testing Suite (`tests`)

This directory houses all automated test specifications and validation fixtures for validating the **Topola Genealogy Viewer** application. The tests are powered by the modern Playwright framework to offer robust, type-safe end-to-end (E2E) user flows and pixel-perfect visual regression validations.

## Test Design Reference Documents

Before writing new or adjusting existing tests, developers should review their corresponding systems design guidelines under the `docs/` directory to align with established conventions and paradigms:
*   **[PLAYWRIGHT_DESIGN.md](file:///home/pwiech/personal/github/topola-viewer/docs/PLAYWRIGHT_DESIGN.md)**: Explains overall Playwright orchestration, server hooks, mock GEDCOM network intercept routines, tracking blockages, and in-memory iframe environments.
*   **[SCREENSHOT_TESTS_DESIGN.md](file:///home/pwiech/personal/github/topola-viewer/docs/SCREENSHOT_TESTS_DESIGN.md)**: Outlines visual testing strategies, viewport locks, dynamic footer/changelog sanitization overrides in virtual DOMs, threshold sensitivities, and local baseline update policies.

---

## Test Specs Registry

Tests are strategically partitioned into standard functional E2E specs and isolated visual regression specs (which are tagged and grouped into targeted Playwright projects).

### 1. Functional E2E Specs
Verify functional correctness, route parameters, drawer side-panels, dynamic autocomplete searching, and external/bidirectional event loops.
*   **[chart_view.spec.ts](chart_view.spec.ts)**: Asserts core tree rendering from mock network parameters, navigation shifts, transition handling, and card node interaction.
*   **[embedded.spec.ts](embedded.spec.ts)**: Tests embedded iframe operations using virtual server postMessage listeners to execute proper parent-child synchronizations.
*   **[intro.spec.ts](intro.spec.ts)**: Checks base landing layouts, instructions panels, menu existence, and responsive header navigation buttons.
*   **[search.spec.ts](search.spec.ts)**: Targets autocompletion components using robust search locators to verify input debouncing and focus updates.
*   **[webmcp.spec.ts](webmcp.spec.ts)**: Evaluates out-of-process browser calls from Model Context Protocol tool registrations and action assertions.

### 2. Visual Regression / Screenshot Specs
Capture pixel-perfect layout comparisons against preserved snapshots to detect subtle structural overlaps or rendering discrepancies.
*   **[charts_visual.spec.ts](charts_visual.spec.ts)**: Loops through multiple layouts (`Hourglass`, `Relatives`, `Donatso`) using a local GEDCOM dataset to ensure aesthetic layout alignments.
*   **[config_visual.spec.ts](config_visual.spec.ts)**: Asserts full-window UI synchronization states while settings choices (like colored genders, hidden node IDs, or compact profiles) are toggled.
*   **[details_visual.spec.ts](details_visual.spec.ts)**: Checks that intricate information templates (e.g., complex multiline fact headers, embedded picture borders, and source list grids) are structured beautifully under edge cases.
*   **[intro_visual.spec.ts](intro_visual.spec.ts)**: Validates static landing layouts. Pre-evaluates dynamic sections (e.g. version/commit logs) to replace them with fixed test markers for baseline durability.

---

## Supporting Infrastructure

To enable lightweight, reproducible, and offline executions, tests rely on the following configuration, definitions, and test data structures:

*   **[fixtures/embedded_frame.html](fixtures/embedded_frame.html)**: HTML template for serving cross-origin iframe wrapper mockups virtually to the browser container.
*   **[global.d.ts](global.d.ts)**: TypeScript declarations defining window overrides (like AI registration pointers `window.__registeredTools`) to bypass compiler warnings.
*   **[helpers.ts](helpers.ts)**: Unified routing utilities:
    *   `blockTracking()`: Intercepts and halts metrics and analytical HTTP queries during spec executions.
    *   `setupGedcomRoute()`: Re-routes standard genealogy payload network paths directly to load standard local datasets on-the-fly (`src/datasource/testdata/test.ged`).
*   **[tsconfig.json](tsconfig.json)**: Typecheck preferences custom to the Playwright runner environment to avoid compilation type collisions.
*   **`[spec_name]-snapshots/`**: Directory structure containing expected baseline references and image comparison files.

---

## Running the Tests

Automated scripts to run and update tests are integrated into standard workspace npm configurations:

```bash
# Run standard functional E2E tests (fast verification)
npm run test:e2e

# Run screenshot visual verification tests
npm run test:visual

# Update screenshot baselines when visual changes are accepted
npm run test:visual:update
```
