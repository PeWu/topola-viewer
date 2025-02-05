import naturalSort from 'javascript-natural-sort';
import lunr, {PipelineFunction} from 'lunr';
import lunrDe from 'lunr-languages/lunr.de';
import lunrFr from 'lunr-languages/lunr.fr';
import lunrIt from 'lunr-languages/lunr.it';
import lunrRu from 'lunr-languages/lunr.ru';
import lunrStemmer from 'lunr-languages/lunr.stemmer.support';
import {JsonFam, JsonGedcomData, JsonIndi} from 'topola';
import {idToFamMap, idToIndiMap} from '../util/gedcom_util';

lunrStemmer(lunr);
lunrDe(lunr);
lunrFr(lunr);
lunrIt(lunr);
lunrRu(lunr);

const MAX_RESULTS = 8;

export interface SearchResult {
  id: string;
  indi: JsonIndi;
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
function getHusbandLastName(
  indi: JsonIndi,
  indiMap: Map<String, JsonIndi>,
  famMap: Map<string, JsonFam>,
): string {
  return (indi.fams || [])
    .map((famId) => famMap.get(famId))
    .map((fam) => fam && fam.husb)
    .map((husbId) => husbId && indiMap.get(husbId))
    .map((husband) => husband && husband.lastName)
    .join(' ');
}

class LunrSearchIndex implements SearchIndex {
  private index: lunr.Index | undefined;
  private indiMap: Map<string, JsonIndi>;
  private famMap: Map<string, JsonFam>;

  constructor(data: JsonGedcomData) {
    this.indiMap = idToIndiMap(data);
    this.famMap = idToFamMap(data);
  }

  initialize() {
    const self = this;
    this.index = lunr(function () {
      //Trimmer will break non-latin characters, so custom multilingual implementation must be used
      self.initMultiLingualLunrWithoutTrimmer(this, [
        'de',
        'en',
        'fr',
        'it',
        'ru',
      ]);
      this.ref('id');
      this.field('id');
      this.field('name', {boost: 10});
      this.field('normalizedName', {boost: 8});
      this.field('spouseLastName', {boost: 2});
      this.field('normalizedSpouseLastName', {boost: 2});

      self.indiMap.forEach((indi) => {
        const name = [indi.firstName, indi.lastName].join(' ');
        const spouseLastName = getHusbandLastName(
          indi,
          self.indiMap,
          self.famMap,
        );
        this.add({
          id: indi.id,
          name,
          normalizedName: normalize(name),
          spouseLastName,
          normalizedSpouseLastName: normalize(spouseLastName),
        });
      });
    });
  }

  private initMultiLingualLunrWithoutTrimmer(
    lunrInstance: any,
    languages: string[],
  ): void {
    let wordCharacters = '';
    const pipelineFunctions: PipelineFunction[] = [];
    const searchPipelineFunctions: PipelineFunction[] = [];
    languages.forEach((language) => {
      // @ts-ignore
      const lunrLanguage = lunr[language];
      if (language === 'en') {
        wordCharacters += '\\w';
        pipelineFunctions.unshift(lunr.stopWordFilter);
        pipelineFunctions.push(lunr.stemmer);
        searchPipelineFunctions.push(lunr.stemmer);
      } else {
        wordCharacters += lunrLanguage.wordCharacters;
        if (lunrLanguage.stopWordFilter) {
          pipelineFunctions.unshift(lunrLanguage.stopWordFilter);
        }
        if (lunrLanguage.stemmer) {
          pipelineFunctions.push(lunrLanguage.stemmer);
          searchPipelineFunctions.push(lunrLanguage.stemmer);
        }
      }
    });
    lunrInstance.pipeline.reset();
    lunrInstance.pipeline.add.apply(lunrInstance.pipeline, pipelineFunctions);

    if (lunrInstance.searchPipeline) {
      lunrInstance.searchPipeline.reset();
      lunrInstance.searchPipeline.add.apply(
        lunrInstance.searchPipeline,
        searchPipelineFunctions,
      );
    }
  }

  public search(input: string): SearchResult[] {
    const query = input
      .split(' ')
      .filter((s) => !!s)
      .map((s) => `${s} ${s}*`)
      .join(' ');
    const results = this.index!.search(query);
    return results
      .sort(compare)
      .slice(0, MAX_RESULTS)
      .map((result) => ({
        id: result.ref,
        indi: this.indiMap.get(result.ref)!,
      }));
  }
}

/** Builds a search index from data. */
export function buildSearchIndex(data: JsonGedcomData): SearchIndex {
  const index = new LunrSearchIndex(data);
  index.initialize();
  return index;
}
