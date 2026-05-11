# Immediate Family Section Design

## Problem

Topola Viewer renders an interactive graphical family tree centered on a selected individual, displaying connected nodes for ancestors, descendants, and spouses. However, as family structures expand or users zoom in for detail, directly related family members frequently flow off the visible screen boundaries, requiring tedious canvas manipulation to locate and select them. To improve navigation efficiency and provide clear relational context at a glance, the application needs a dedicated layout block in the side panel that consolidates and displays the focused person's parents, spouses, and children. Providing these primary relationships as direct clickable links ensures users can rapidly transition focus between immediate family members regardless of their current viewport position on the graphical canvas.

## Technical Plan

To introduce the immediate family view without disrupting existing features, the implementation introduces a focused visual component that acts as an intermediary between the raw genealogy data and the user interface. 

The system relies on three primary components working together:
1. **Genealogy Data Store**: The core repository containing all parsed individuals and family records. It provides lookup utilities to resolve cross-references between children and their parents or spouses.
2. **Immediate Family Component**: A dedicated new interface element embedded directly inside the side panel. It queries the data store for the currently selected person, extracts their primary set of parents, and groups all associated children under their respective spouses or partners.
3. **Navigation Module**: When a user clicks on any parent, spouse, or child link within the new block, this module updates the application's active web address with the chosen relative's identifier. This action instantly re-centers both the side panel and the primary visual tree onto the newly selected family member.

## Alternatives

During the initial design discussions, several alternative implementation strategies were evaluated and ultimately ruled out to ensure optimal user experience and maintainability:

### 1. Integrating Relationships into the Event Timeline
* **Concept**: Interweave parents and children directly into the chronologically sorted lifecycle event list (e.g., rendering children as "Child Born" timeline events and placing parents near the target person's birth event).
* **Reason for Rejection**: Structural relationships are fundamentally distinct from point-in-time events. Forcing them into an event-driven layout scatters family members across the full vertical height of the panel, creating severe timeline clutter and undermining the core goal of rapid navigation.

### 2. Removing the Timeline Spouse Link
* **Concept**: Strip out the standalone spouse navigation link from the chronological marriage event entries to prevent duplicating the link in both the timeline and the new Immediate Family block.
* **Reason for Rejection**: Detaching the spouse link from the timeline breaks historical context, separating the marriage ceremony record from the actual partner involved. Maintaining both preserves event completeness while establishing a centralized navigation block.

### 3. Rendering a Flat List of Children
* **Concept**: Consolidate all children into a single flat list ordered strictly by birth date, omitting spousal boundaries.
* **Reason for Rejection**: Fails to represent blended families clearly. Explicitly grouping children under their respective spouse or partner headers makes full-sibling versus half-sibling structures immediately obvious to the user.

### 4. Uniformly Showing or Hiding Unknown Spouses
* **Concept**: Apply a blanket rule to either always display an "Unknown Spouse" header for single-parent records or entirely hide unknown headers across all scenarios.
* **Reason for Rejection**: Always showing the header adds unnecessary visual noise to standard single-family layouts. Always hiding it obscures complex relationship boundaries when an individual has children across multiple partners where some partner names are unrecorded. The conditional approach dynamically cleans up single-family displays while preserving vital structural boundaries for multi-partner families.

### 5. Supporting Multiple Sets of Parents Immediately
* **Concept**: Query all associated `FAMC` records to display biological, adoptive, and foster parent sets side-by-side from day one.
* **Reason for Rejection**: Introduces substantial UI complexity for labeling pedigree types (`PEDI` sub-tags) and requires wider structural refactoring of active focus state handling across the core canvas layout. Deferring to a single primary parent set keeps the initial feature scope robust and achievable.

## Detailed Implementation

Executing this feature requires clean extensions across the side panel architecture. To maintain high code quality and ensure strict boundaries, the implementation avoids modifying shared core state or event logic directly, instead isolating rendering responsibilities into modular layers. 

Below is the exhaustive file-by-file breakdown enumerating every file that will be created or modified, accompanied by detailed implementation step guidelines and specific technical rationale.

### 1. Component Creation
#### [NEW] [immediate-family.tsx](../src/sidepanel/details/immediate-family.tsx)
* **Rationale**: Encapsulating the new feature inside a dedicated component file separates concerns, avoids bloating the orchestration component ([details.tsx](../src/sidepanel/details/details.tsx)), and centralizes specialized rendering logic for single parent sets, childless spouses, conditional unknown headers, and chronologically sorted child groupings.
* **Implementation Steps**:
  1. **Imports**: Import React elements, Semantic UI layout wrappers (`Item`, `Header`), navigation routing dependencies (`Link`, `useLocation` from `react-router`, `query-string`), localization wrappers (`FormattedMessage`, `useIntl` from `react-intl`), and GEDCOM utility functions from `../../util/gedcom_util` ([dereference](../src/util/gedcom_util.ts#L171-L183), [getName](../src/util/gedcom_util.ts#L292-L302), [pointerToId](../src/util/gedcom_util.ts#L42-L44), [resolveDate](../src/util/gedcom_util.ts#L339-L342)).
  2. **Relative Link Helper**: Define an internal component (e.g., `RelativeLink`) that renders an individual relative profile as a `<Link>`. It extracts the target relative's plain ID directly from the raw sub-entry string via `pointerToId(subEntry.data)` before dereferencing to prevent runtime crashes on broken references. It parses `location.search` using `useLocation()`, sets the `indi` query parameter to the target ID, stringifies the search parameters, routes to `/view`, and outputs the resolved display name via `getName` (falling back to localized unknown string if undefined).
  3. **Parents Block Renderer**: Implement a rendering method that extracts the active individual's tree array. Find the first sub-entry where `tag === 'FAMC'`. Guard against `undefined` if parents are unrecorded. Safely dereference this pointer against the repository's family mapping array to locate the parental family record. Scan the resolved family entry for all `HUSB` and `WIFE` sub-entries. Extract plain IDs via `pointerToId(subEntry.data)` and dereference each against the repository's individual mapping array to resolve profile records. Conditionally output localized sub-headers (e.g., "Father", "Mother") accompanied by clickable `RelativeLink` instances only for present parent records.
  4. **Spouses and Children Block Renderer**: Implement a rendering method that iterates over all `FAMS` tags within the active individual's tree. Dereference each entry to fetch its corresponding family record. For each family record, extract the partner/spouse pointers (`HUSB` or `WIFE` tags ensuring `!subEntry.data.includes(props.indi)` to prevent extracting the focused person as their own spouse) and extract all child records (`CHIL`).
  5. **Child Record Dereferencing and Sorting**: Explicitly dereference each extracted `CHIL` sub-entry against `gedcom.indis` to access child profile records. Extract their birth dates using `resolveDate` and sort the children array chronologically by birth date before outputting to ensure correct relational flow.
  6. **Conditional Unknown Spouse Logic**: Prior to outputting headers, evaluate the total length of the mapped `FAMS` array. Guard against incomplete/empty family entries by suppressing groups containing neither a valid spouse pointer nor children. If a spouse profile pointer is absent and total `FAMS` equals `1`, suppress the spouse header output. If a spouse pointer is absent and total valid `FAMS` groups exceed `1`, output a visible "Spouse: Unknown" block header to clearly define half-sibling boundaries.
  7. **Sequential Group Output**: Output each valid spousal family group as an encapsulated sub-block. Render childless spouses as complete standalone items. Output the resolved, sorted children collection as relative links below their respective spouse/partner header.
  8. **Container Wrapper**: Export the primary `ImmediateFamily` component wrapper. If active parent, spouse, or child nodes exist, wrap the consolidated layout blocks inside a single Semantic UI `<Item>` container structured with `<Item.Content>`. If no immediate family members exist, return `null` to prevent empty dividers in the side panel DOM.

### 2. Orchestration Layer Modification
#### [MODIFY] [details.tsx](../src/sidepanel/details/details.tsx)
* **Rationale**: Acts as the root layout orchestrator for the side panel info tab. Needs to import and render the new view block near the top of the component flow to guarantee primary relational links are visible above the fold without requiring users to scroll past massive event timelines.
* **Implementation Steps**:
  1. Import the `ImmediateFamily` component from `./immediate-family`.
  2. Locate the main [Details](../src/sidepanel/details/details.tsx#L338-L387) component export function.
  3. Identify the execution block rendering `{getSectionForEachMatchingEntry(entries, props.gedcom, ['OBJE'], imageDetails)}` (line 350-355).
  4. Directly below this block, and strictly *before* the `<Events>` timeline rendering execution line, embed `<ImmediateFamily gedcom={props.gedcom} indi={props.indi} />` directly within the `<Item.Group divided>` flow. Rely on the component's internal conditional logic to render the outer item bounds.

### 3. Registry and Documentation Updates
#### [MODIFY] [README.md](../src/sidepanel/details/README.md)
* **Rationale**: Functions as the official index cataloging all available component views within the side panel details sub-package. Documenting the new file preserves architectural readability.
* **Implementation Steps**:
  1. Locate the alphabetical files registry list.
  2. Insert a descriptive entry for `immediate-family.tsx`, explaining its role as a dedicated side panel module for grouping and displaying parents, spouses, and children as rapid-navigation links.

### 4. Localization Contracts
#### [MODIFY] Translation JSON Files (`src/translations/*.json`)
* **Rationale**: Guarantees that every new UI header label introduced by the feature supports multi-language localization cleanly across all supported international environments.
* **Implementation Steps**:
  1. Establish explicit string descriptor keys to be mapped across all JSON locale files (e.g., `src/translations/en.json`, `de.json`, `pl.json`, `fr.json`, `it.json`, etc.) to avoid production fallback leakage:
     * `"family.immediate_family": "Immediate Family"`
     * `"family.parents": "Parents"`
     * `"family.father": "Father"`
     * `"family.mother": "Mother"`
     * `"family.spouse": "Spouse"`
     * `"family.unknown_spouse": "Unknown Spouse"`
     * `"family.children": "Children"`
  2. Ensure corresponding `<FormattedMessage>` invocations inside `immediate-family.tsx` reference these specific string descriptor keys.
