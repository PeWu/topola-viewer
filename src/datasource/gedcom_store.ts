/**
 * In-memory store for uploaded GEDCOM content, keyed by file fingerprint.
 *
 * Avoids passing the raw GEDCOM string through history.pushState (640KB limit
 * in Firefox, ~512KB in Safari) while keeping the content available for
 * within-tab navigation.
 *
 * Bounded to 1 entry: uploading a new file evicts the previous one.
 * A typical session involves one active file; bounding prevents unbounded
 * memory growth when users upload multiple large files in one session.
 */
let currentHash: string | null = null;
let currentEntry: {gedcom: string; images: Map<string, string>} | null = null;

export function storeGedcom(
  hash: string,
  gedcom: string,
  images: Map<string, string>,
): void {
  currentHash = hash;
  currentEntry = {gedcom, images};
}

export function getStoredGedcom(
  hash: string,
): {gedcom: string; images: Map<string, string>} | undefined {
  return currentHash === hash && currentEntry ? currentEntry : undefined;
}
