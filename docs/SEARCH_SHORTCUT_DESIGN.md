# Global Search Keyboard Shortcut Design

## Business Problem

When exploring large family trees in Topola Genealogy, users frequently need to locate specific individuals quickly using the search feature. Currently, accessing the search box requires moving the hand to the mouse or trackpad, navigating the cursor to the top bar, and clicking the input field, which breaks the flow of keyboard-driven navigation. This document proposes introducing a global keyboard shortcut (the `/` key) to instantly focus the search input, allowing users to search without manual mouse interaction. By streamlining this transition, the application provides a faster, more accessible, and premium keyboard-centric workflow for power users navigating complex genealogical data.

---

## Technical Plan

The shortcut mechanism is designed to be lightweight, modular, and resilient against responsive layout duplication. Rather than introducing complex third-party shortcut libraries, the feature leverages standard web browser event handling, custom React hooks, standard accessibility attributes, and a centralized input registry.

### Major Components and Workflow

1.  **The Encapsulated Hook (`useSearchShortcut`):** The keyboard shortcut logic is encapsulated within a custom hook `useSearchShortcut` (`src/menu/use_search_shortcut.ts`). Rather than being called by individual `SearchBar` components, the hook is invoked once at the layout level in `TopBar` (`src/menu/top_bar.tsx`). Individual `SearchBar` instances register their underlying `<input>` DOM elements in a centralized module-level registry (`registeredSearchInputs` `Set`). This ensures a single `window` `keydown` event listener manages focus across all responsive search bar instances.
2.  **The Modifier Guard:** To prevent conflicts with system-level and browser-level shortcuts (such as `Cmd + /` for help or extensions, or `Ctrl + /` for toggling comments), the listener ignores keydown events with `Cmd/Meta`. It also ignores `Ctrl` or `Alt` unless both are pressed simultaneously (`Ctrl + Alt`), allowing `AltGr` combinations on international keyboards to function properly.
3.  **The IME Composition & Default Prevented Guard:** To avoid hijacking keystrokes when international users are typing using an Input Method Editor (IME) for CJK (Chinese, Japanese, Korean) languages or when another event handler has already intercepted the keypress, the listener ignores keydown events when `event.isComposing === true` or `event.defaultPrevented === true`.
4.  **The Smart Filter (Collision, Repeat & Modal Guards):** Before taking action, the listener verifies `event.key === '/'` and checks three conditions:
    *   **Collision Guard (`isTextEditable`):** It extracts the event path (supporting Shadow DOM encapsulation via `event.composedPath()`) and traverses all nodes in the path to check for `<input>`, `<textarea>`, `<select>`, `<button>`, elements with `contenteditable` active, or elements with `role="textbox"`, `role="searchbox"`, `role="spinbutton"`, or `role="combobox"`. This guarantees that typing `/` or pressing `/` while focused inside form controls, rich text editors, or ARIA fields does not trigger the shortcut.
    *   **Repeat Guard:** It checks if the key event is repeated (`event.repeat === true`). If so, it ignores it to prevent key-repeat cycles.
    *   **Modal Guard:** It inspects both the main `document` and the event target's `getRootNode()` for active modal dialogs (`dialog[open], .ui.modal.visible.active`) and ignores any modal with `aria-hidden="true"`. It verifies visibility (`checkVisibility() || getBoundingClientRect().width > 0`) without forcing synchronous layout recalculations (simple dropdown menus are not blocked). If an active visible modal is open, the shortcut is ignored to prevent stealing focus.
    If all guards pass and a visible search input is found, the listener intercepts the keypress (using `event.preventDefault()`) and initiates the focus transition.
5.  **The Centralized Search Input Registry:** Because `@artsy/fresnel` mounts both the desktop and mobile top bar menus in the DOM simultaneously, two separate instances of the `SearchBar` component exist concurrently.
    To avoid duplicate IDs in the DOM, `id="search"` is removed from the component. When mounted, each `SearchBar` registers its underlying HTML `<input>` element in a module-level `Set` (`registeredSearchInputs`) via `registerSearchInput` / `unregisterSearchInput`. When the shortcut is triggered, `useSearchShortcut` iterates through the registered inputs and identifies the active instance by checking if it is visible in the viewport (`input.checkVisibility() || input.getBoundingClientRect().width > 0`). Once found, it focuses and selects it:
    *   Focus is requested with `{ preventScroll: true }` to avoid jarring page shifts.
    *   `select()` is called on the HTML `<input>` element to highlight all existing text, allowing the user to immediately overwrite it with a new query.
6.  **The Translation Engine (Full Placeholder Localization):** To keep translation keys clean and avoid runtime string concatenation issues across different languages, two complete placeholder strings are defined: `"menu.search.placeholder"` (`"Search for people"`) and `"menu.search.placeholder_with_shortcut"` (`"Search for people (press '/')"`).
    *   On desktop (where `hideShortcutHint` is false or omitted), `SearchBar` uses `placeholder_with_shortcut`.
    *   On mobile (where `hideShortcutHint` is true), `SearchBar` uses `placeholder`, saving screen space on touch devices.
7.  **Accessibility (a11y):** The search input is decorated with the standard `aria-keyshortcuts="/"` attribute to declare the global shortcut to screen readers and assistive technologies.

### Component Interaction Diagram

```mermaid
graph TD
    A["Web Browser (Global Window)"] -->|1. Keyboard Event ('/')| B["Shared Listener (handleKeyDown)"]
    B -->|2. Check Repeat, Composing, DefaultPrevented & Modifiers| C{"Valid Keypress?"}
    C -->|No| D["Ignore Event"]
    C -->|Yes| E{"3. Check Active Modals & isTextEditable(event)?"}
    E -->|Yes (Modal Active or Typing)| D
    E -->|No| F{"4. Iterate registeredSearchInputs for visible instance?"}
    F -->|No visible input| D
    F -->|Yes| G["5. Intercept event (preventDefault)"]
    G --> H["6. Focus (preventScroll) & Select"]
    H --> I["HTML Input Element"]
```

---

## Alternatives Considered

### 1. Per-Component Event Listeners in `SearchBar`
*   **Alternative:** Invoke `useSearchShortcut` inside each `SearchBar` instance so that each component attaches its own `window` `keydown` event listener.
*   **Why Rejected:** Attaching multiple window event listeners concurrently (one for desktop, one for mobile) can lead to duplicate event handling or race conditions. Instead, `useSearchShortcut` is called once at the layout level in `TopBar`, while individual `SearchBar` components register their DOM `<input>` nodes in a shared module-level `Set` (`registeredSearchInputs`).

### 2. Using React Refs to Focus the Input
*   **Alternative:** Pass a React `ref` to `<Search>` and call `focus()` or `getBoundingClientRect()` directly on it.
*   **Why Rejected:** Semantic UI React's `Search` / `Input` components are class components or wrappers where refs do not consistently return the raw HTML `<input>` DOM node required for calling `select()`. Querying the wrapper element (`wrapperRef.current.querySelector('input')`) reliably targets the underlying HTML input element for registration.

---

## Detailed Implementation

### Affected Files and Rationales

#### 1. [use_search_shortcut.ts](file:///home/pwiech/personal/github/topola-viewer/src/menu/use_search_shortcut.ts)
*   **Rationale:** New custom hook and registry file. Implements `registerSearchInput` / `unregisterSearchInput` to manage mounted search input instances in a module-level `Set`. Implements `isTextEditable(event)` to guard against input hijacking across standard form controls (`<input>`, `<textarea>`, `<select>`, `<button>`) and ARIA text fields (`textbox`, `searchbox`, `spinbutton`, `combobox`) by traversing all nodes in the composed path. Implements `isModalActive(event)` to verify active visible modals (`dialog[open], .ui.modal.visible.active`) across main document and Shadow DOM roots (ignoring `aria-hidden="true"`). Implements `useSearchShortcut()` to attach a single window `keydown` listener (matching `event.key === '/'` with `AltGr` support), iterate registered inputs to identify the visible instance, intercept events with `preventDefault()`, and focus/select the search input.

#### 2. [search.tsx](file:///home/pwiech/personal/github/topola-viewer/src/menu/search.tsx)
*   **Rationale:** Remove `id="search"` to comply with HTML specs. Register and unregister the underlying `<input>` DOM node in `registeredSearchInputs` upon mount/unmount. Select between `"menu.search.placeholder"` and `"menu.search.placeholder_with_shortcut"` based on the `hideShortcutHint` prop. Add `aria-keyshortcuts="/"` to the input shorthand.

#### 3. [top_bar.tsx](file:///home/pwiech/personal/github/topola-viewer/src/menu/top_bar.tsx)
*   **Rationale:** Invoke `useSearchShortcut()` at the layout level. Pass `hideShortcutHint={true}` to the mobile `SearchBar` instance rendered inside `mobileMenus()`.

#### 4. Localized Translation Files:
*   [de.json](file:///home/pwiech/personal/github/topola-viewer/src/translations/de.json)
*   [pl.json](file:///home/pwiech/personal/github/topola-viewer/src/translations/pl.json)
*   [fr.json](file:///home/pwiech/personal/github/topola-viewer/src/translations/fr.json)
*   [it.json](file:///home/pwiech/personal/github/topola-viewer/src/translations/it.json)
*   [ru.json](file:///home/pwiech/personal/github/topola-viewer/src/translations/ru.json)
*   [bg.json](file:///home/pwiech/personal/github/topola-viewer/src/translations/bg.json)
*   [cs.json](file:///home/pwiech/personal/github/topola-viewer/src/translations/cs.json)
*   **Rationale:** Define `"menu.search.placeholder_with_shortcut"` with localized translations across all supported languages.

#### 5. [search.spec.ts](file:///home/pwiech/personal/github/topola-viewer/tests/search.spec.ts)
*   **Rationale:** Playwright E2E test suite validating:
    *   Shortcut focus and text selection upon pressing `/`.
    *   Viewport switching where search query is preserved when resizing between desktop and mobile.
    *   Collision safety when typing `/` into active modal inputs (e.g., "Load from URL").
    *   Modal safety preventing focus theft when a modal is open and blurred.
    *   Form control protection preventing focus theft when focused on buttons.
    *   Modifier key exclusion (`Ctrl+/`, `Alt+/`, `Meta+/`).
    *   Landing page safety where no search bar is rendered.
    *   Question mark safety ensuring pressing `?` (`Shift+/`) does not trigger the shortcut.
    *   Dropdown menu safety allowing the shortcut to focus the search bar while a dropdown menu is open.
    *   Combobox wrapper interaction where clicking inside the search wrapper and pressing `/` focuses the input.
    *   AltGr compatibility ensuring international keyboard combinations (`Ctrl+Alt+/`) trigger the shortcut.
