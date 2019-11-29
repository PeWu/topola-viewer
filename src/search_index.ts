import naturalSort from 'javascript-natural-sort';
import lunr from 'lunr';
import {GedcomData, pointerToId} from './gedcom_util';
import {GedcomEntry} from 'parse-gedcom';

const MAX_RESULTS = 8;

export interface SearchResult {
  id: string;
  indi: GedcomEntry;
}

export interface SearchIndex {
  search(input: string): SearchResult[];
}

/** Removes accents from letters, e.g. ó->o, ę->e. */
function normalize(input: string) {
  return input
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0142/g, 'l'); // Special case: ł is not affected by NFD.
}

/** Comparator to sort by score first, then by id. */
function compare(a: lunr.Index.Result, b: lunr.Index.Result) {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  return naturalSort(a.ref, b.ref);
}

/** Returns all last names of all husbands as a space-separated string. */
function getHusbandLastName(indi: GedcomEntry, gedcom: GedcomData): string {
  return indi.tree
    .filter((entry) => entry.tag === 'FAMS')
    .map((entry) => gedcom.fams[pointerToId(entry.data)])
    .filter((entry) => !!entry)
    .map((entry) => {
      const husband = entry.tree.find((entry) => entry.tag === 'HUSB');
      const husbandId = husband && pointerToId(husband.data);
      return (
        husbandId &&
        husbandId !== pointerToId(indi.pointer) &&
        gedcom.indis[husbandId]
      );
    })
    .filter((entry) => !!entry)
    .flatMap((husband) =>
      (husband as GedcomEntry).tree
        .filter((entry) => entry.tag === 'NAME')
        .map((entry) => {
          const names = entry.data.split('/');
          return names.length >= 2 ? names[1] : '';
        }),
    )
    .join(' ');
}

class LunrSearchIndex implements SearchIndex {
  private index: lunr.Index | undefined;

  constructor(private gedcom: GedcomData) {}

  initialize() {
    const self = this;
    this.index = lunr(function() {
      this.ref('id');
      this.field('id');
      this.field('name', {boost: 10});
      this.field('normalizedName', {boost: 8});
      this.field('spouseLastName', {boost: 2});
      this.field('normalizedSpouseLastName', {boost: 2});

      for (let id in self.gedcom.indis) {
        const indi = self.gedcom.indis[id];
        const name = indi.tree
          .filter((entry) => entry.tag === 'NAME')
          .map((entry) => entry.data)
          .join(' ');
        const spouseLastName = getHusbandLastName(indi, self.gedcom);
        this.add({
          id,
          name,
          normalizedName: normalize(name),
          spouseLastName,
          normalizedSpouseLastName: normalize(spouseLastName),
        });
      }
    });
  }

  public search(input: string) {
    const query = input
      .split(' ')
      .filter((s) => !!s)
      .map((s) => `+${s}*`)
      .join(' ');
    const results = this.index!.search(query);
    return results
      .sort(compare)
      .slice(0, MAX_RESULTS)
      .map((result) => ({id: result.ref, indi: this.gedcom.indis[result.ref]}));
  }
}

/** Builds a search index from data. */
export function buildSearchIndex(gedcom: GedcomData): SearchIndex {
  const index = new LunrSearchIndex(gedcom);
  index.initialize();
  return index;
}
