// Data type definitions for the parse-gedcom library.
declare module 'parse-gedcom' {
  interface GedcomEntry {
    level: number;
    pointer: string;
    tag: string;
    data: string;
    tree: GedcomEntry[];
  }

  export function parse(input: string): GedcomEntry[];
}
