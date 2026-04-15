import {DetailedRenderer, getLength, IndiDetails} from 'topola';

type DetailItem = {symbol: string; text: string};

// Cast base class to bypass TypeScript's private-member restriction on getIndiDetails.
// At runtime this is normal prototype-based inheritance.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class NotesDetailedRenderer extends (DetailedRenderer as any) {
  /** Set to false to suppress notes from chart boxes (controlled by Settings). */
  static showNotes = true;
  /** Set to false to suppress generation number from chart boxes. */
  static showGeneration = true;
  /** Set to false to suppress sibling order letter from chart boxes. */
  static showSiblingOrder = true;
  /** Map from individual ID to absolute generation number. */
  static generationMap: Map<string, number> = new Map();
  /** Map from individual ID to 1-based sibling index within their parent family. */
  static siblingOrderMap: Map<string, number> = new Map();

  getIndiDetails(indi: IndiDetails): DetailItem[] {
    const details: DetailItem[] = super.getIndiDetails(indi);
    if (!NotesDetailedRenderer.showNotes) return details;
    const notes = indi.getNotes() ?? [];
    for (const note of notes) {
      const firstLine = note.trim().split('\n')[0].trim();
      if (!firstLine) continue;
      const text =
        firstLine.length > 40 ? firstLine.substring(0, 37) + '\u2026' : firstLine;
      details.push({symbol: '\u201c', text});
    }
    return details;
  }

  getPreferredIndiSize(id: string): [number, number] {
    const [width, height]: [number, number] = super.getPreferredIndiSize(id);

    const showGen = NotesDetailedRenderer.showGeneration;
    const showOrd = NotesDetailedRenderer.showSiblingOrder;
    if (!showGen && !showOrd) return [width, height];

    let suffix = '';
    if (showGen) {
      const gen = NotesDetailedRenderer.generationMap.get(id);
      if (gen !== undefined) suffix += String(gen);
    }
    if (showOrd) {
      const ord = NotesDetailedRenderer.siblingOrderMap.get(id);
      if (ord !== undefined) suffix += String.fromCharCode(64 + ord);
    }
    if (!suffix) return [width, height];

    // The gen+order text is centred between [ID] (x=9) and [sex symbol] (right edge).
    // Minimum width so the centred gen+order doesn't overlap the ID on the left:
    //   9 + idW + 4gap + goW/2  ≤  width/2
    //   → width ≥ 2*(9 + idW + 4) + goW
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const indi = (this as any).options.data.getIndi(id);
    const idW = indi?.showId() ? getLength(id, 'id') : 0;
    const goW = getLength(suffix, 'id');
    const minWidth = 2 * (9 + idW + 4) + goW;

    return [Math.max(width, minWidth), height];
  }
}
