import {DetailedRenderer, IndiDetails} from 'topola';

type DetailItem = {symbol: string; text: string};

// Cast base class to bypass TypeScript's private-member restriction on getIndiDetails.
// At runtime this is normal prototype-based inheritance.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class NotesDetailedRenderer extends (DetailedRenderer as any) {
  /** Set to false to suppress notes from chart boxes (controlled by Settings). */
  static showNotes = true;

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
}
