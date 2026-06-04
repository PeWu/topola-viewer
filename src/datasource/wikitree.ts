import {IntlShape} from 'react-intl';
import {analyticsEvent} from '../util/analytics';
import {TopolaError} from '../util/error';
import {normalizeGedcom, TopolaData} from '../util/gedcom_util';
import {DataSource, DataSourceEnum, SourceSelection} from './data_source';
import {buildGedcom} from './gedcom_generator';
import {loadData, PRIVATE_ID_PREFIX} from './wikitree_api';
import {
  convertFams,
  convertIndis,
  convertPersonNames,
} from './wikitree_transformer';

export {PRIVATE_ID_PREFIX};

/**
 * Main entrypoint for loading data from WikiTree and transforming it to Topola format.
 *
 * @param key The person key to load.
 * @param intl Intl shape for localization.
 * @param authcode Optional authentication code.
 * @returns Promise resolving to transformed Topola data.
 */
export async function loadWikiTree(
  key: string,
  intl: IntlShape,
  authcode?: string,
): Promise<TopolaData> {
  const everyone = await loadData(key, authcode);

  const indis = convertIndis(everyone, intl);
  const fams = convertFams(everyone);
  const chartData = normalizeGedcom({indis, fams});

  // Map from human-readable person id to person names
  const personNames = new Map(
    everyone.map((person) => [person.Name, convertPersonNames(person)]),
  );
  // Map from human-readable person id to fullSizeUrl of person photo.
  const fullSizePhotoUrls = new Map(
    everyone
      .filter((person) => person.PhotoData?.path)
      .map((person) => [
        person.Name,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        `https://www.wikitree.com${person.PhotoData!.path}`,
      ]),
  );
  const gedcom = buildGedcom(chartData, fullSizePhotoUrls, personNames);

  return {chartData, gedcom};
}

/**
 * Specification options for querying from the WikiTree data source.
 */
export interface WikiTreeSourceSpec {
  source: DataSourceEnum.WIKITREE;
  authcode?: string;
}

/** Loading data from the WikiTree API. */
export class WikiTreeDataSource implements DataSource<WikiTreeSourceSpec> {
  constructor(private intl: IntlShape) {}

  isNewData(
    newSource: SourceSelection<WikiTreeSourceSpec>,
    oldSource: SourceSelection<WikiTreeSourceSpec>,
    data?: TopolaData,
  ): boolean {
    if (!newSource.selection) {
      return false;
    }
    if (oldSource.selection?.id === newSource.selection.id) {
      // Selection unchanged -> don't reload.
      return false;
    }
    if (
      data &&
      data.chartData.indis.some((indi) => indi.id === newSource.selection?.id)
    ) {
      // New selection exists in current view -> animate instead of reloading.
      return false;
    }
    return true;
  }

  async loadData(
    source: SourceSelection<WikiTreeSourceSpec>,
    _onProgress?: (status: string) => void,
  ): Promise<TopolaData> {
    if (!source.selection) {
      throw new TopolaError(
        'WIKITREE_ID_NOT_PROVIDED',
        'WikiTree id needs to be provided',
      );
    }
    try {
      const data = await loadWikiTree(
        source.selection.id,
        this.intl,
        source.spec.authcode,
      );
      analyticsEvent('wikitree_loaded');
      return data;
    } catch (error) {
      analyticsEvent('wikitree_error');
      throw error;
    }
  }
}
