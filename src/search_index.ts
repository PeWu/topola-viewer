import naturalSort from 'javascript-natural-sort';
import lunr from 'lunr';
import {GedcomData} from './gedcom_util';
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
    return a.score - b.score;
  }
  return naturalSort(a.ref, b.ref);
}

class LunrSearchIndex implements SearchIndex {
  private index: lunr.Index;

  public constructor(private gedcom: GedcomData) {
    this.index = lunr(function() {
      this.ref('id');
      this.field('id');
      this.field('name');
      this.field('normalizedName');

      for (let id in gedcom.indis) {
        const name = gedcom.indis[id].tree
          .filter((entry) => entry.tag === 'NAME')
          .map((entry) => entry.data)
          .join(' ');
        this.add({id, name, normalizedName: normalize(name)});
      }
    });
  }

  public search(input: string) {
    const query = input
      .split(' ')
      .filter((s) => !!s)
      .map((s) => `+${s}*`)
      .join(' ');
    const results = this.index.search(query);
    return results
      .sort(compare)
      .slice(0, MAX_RESULTS)
      .map((result) => ({id: result.ref, indi: this.gedcom.indis[result.ref]}));
  }
}

/** Builds a search index from data. */
export function buildSearchIndex(gedcom: GedcomData): SearchIndex {
  return new LunrSearchIndex(gedcom);
}
