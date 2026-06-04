export enum PlaceDisplay {
  FULL,
  SHORT,
  HIDE,
}

export const DEFAULT_PLACE_DISPLAY_COUNT = 2;

/**
 * Shortens a GEDCOM place string for display in chart nodes.
 *
 * GEDCOM places are comma-separated from most-specific to least-specific,
 * e.g. "Cyclone, McKean, Pennsylvania, United States".
 * SHORT keeps the first `count` components (most-specific).
 * HIDE removes the place entirely.
 */
export function shortenPlace(
  place: string | undefined,
  mode: PlaceDisplay,
  count: number = DEFAULT_PLACE_DISPLAY_COUNT,
): string | undefined {
  if (!place || mode === PlaceDisplay.FULL) {
    return place;
  }
  if (mode === PlaceDisplay.HIDE) {
    return undefined;
  }
  const parts = place
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= count) {
    return place;
  }
  return parts.slice(0, count).join(', ');
}
