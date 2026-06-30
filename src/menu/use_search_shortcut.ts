import {useEffect} from 'react';

const registeredSearchInputs = new Set<HTMLInputElement>();

/** Registers a search input DOM element to receive global '/' shortcut focus. */
export function registerSearchInput(input: HTMLInputElement) {
  registeredSearchInputs.add(input);
}

/** Unregisters a search input DOM element. */
export function unregisterSearchInput(input: HTMLInputElement) {
  registeredSearchInputs.delete(input);
}

/**
 * Checks whether an element is visible without short-circuiting dead code
 * or failing on position: fixed elements.
 */
function isElementVisible(el: HTMLElement): boolean {
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility();
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Checks if the user is currently typing inside a text-editable element or form control.
 * Traverses all nodes in the composed path (supporting Shadow DOM) to ensure
 * nested child elements inside rich text editors or ARIA textfields do not
 * trigger false negatives. Protects all inputs, textareas, selects, and buttons.
 */
function isTextEditable(event: KeyboardEvent): boolean {
  const path =
    typeof event.composedPath === 'function'
      ? event.composedPath()
      : [event.target];

  for (const node of path) {
    if (!node || !(node instanceof Element)) {
      continue;
    }

    if (node instanceof HTMLElement && node.isContentEditable) {
      return true;
    }

    const tagName = node.tagName.toUpperCase();
    if (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT' ||
      tagName === 'BUTTON'
    ) {
      return true;
    }

    const role = node.getAttribute('role');
    if (
      role === 'textbox' ||
      role === 'searchbox' ||
      role === 'spinbutton' ||
      role === 'combobox'
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if any open modal dialog is visible in the main document or Shadow DOM.
 */
function isModalActive(event: KeyboardEvent): boolean {
  const roots = new Set<Document | ShadowRoot>([document]);
  const targetRoot = (event.target as Element | null)?.getRootNode();
  if (
    targetRoot &&
    (targetRoot instanceof Document || targetRoot instanceof ShadowRoot)
  ) {
    roots.add(targetRoot);
  }

  for (const root of roots) {
    const modals = root.querySelectorAll(
      'dialog[open], .ui.modal.visible.active',
    );

    for (const modal of Array.from(modals)) {
      if (!(modal instanceof HTMLElement)) {
        continue;
      }
      if (modal.getAttribute('aria-hidden') === 'true') {
        continue;
      }
      if (isElementVisible(modal)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Hook that registers a centralized global '/' keyboard shortcut to focus the visible search input.
 */
export function useSearchShortcut() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== '/') {
        return;
      }
      if (event.repeat || event.isComposing || event.defaultPrevented) {
        return;
      }
      // Block metaKey (Cmd). Block Ctrl or Alt unless both are pressed (AltGr).
      if (
        event.metaKey ||
        (event.ctrlKey && !event.altKey) ||
        (!event.ctrlKey && event.altKey)
      ) {
        return;
      }

      if (isModalActive(event) || isTextEditable(event)) {
        return;
      }

      for (const input of registeredSearchInputs) {
        if (isElementVisible(input)) {
          event.preventDefault();
          input.focus({preventScroll: true});
          input.select();
          break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
