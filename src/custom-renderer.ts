import { select } from 'd3-selection';
import { DetailedRenderer, IndiDetails } from 'topola';

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

  render(enter: any, update: any): void {
    super.render(enter, update);
    this.applyGenOrder(enter);
    this.applyGenOrder(update);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyGenOrder(sel: any): void {
    const showGen = NotesDetailedRenderer.showGeneration;
    const showOrd = NotesDetailedRenderer.showSiblingOrder;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataProvider = (this as any).options?.data;

    sel.each(function(this: Element, treeNode: any) {
      const indiId: string | undefined = treeNode?.indi?.id;
      if (!indiId) return;

      const idSel = select(this).select('text.id');
      if (idSel.empty()) return;

      const indiDetails = dataProvider?.getIndi(indiId);
      const baseText = indiDetails?.showId() ? indiId : '';

      let suffix = '';
      if (showGen) {
        const gen = NotesDetailedRenderer.generationMap.get(indiId);
        if (gen !== undefined) suffix += String(gen);
      }
      if (showOrd) {
        const ord = NotesDetailedRenderer.siblingOrderMap.get(indiId);
        // Convert 1-based index to letter: 1→A, 2→B, ... (up to 26 siblings)
        if (ord !== undefined) suffix += String.fromCharCode(64 + ord);
      }

      idSel.text(baseText ? (suffix ? baseText + ' ' + suffix : baseText) : suffix);
    });
  }
}
