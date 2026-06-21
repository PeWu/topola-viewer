import {beforeEach, describe, expect, it} from '@jest/globals';
import {storeGedcom} from './gedcom_store';
import {loadGedcom} from './load_data';
import {mockSessionStorage} from './test_helpers';

// Minimal GEDCOM with 1 individual and 1 family so convertGedcom succeeds.
const MINIMAL_GEDCOM = [
  '0 HEAD',
  '1 CHAR UTF-8',
  '0 @I1@ INDI',
  '1 NAME Test /Person/',
  '1 SEX M',
  '1 FAMS @F1@',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '0 TRLR',
].join('\n');

describe('loadGedcom()', () => {
  it('throws ERROR_LOADING_UPLOADED_FILE when hash is not in store', async () => {
    await expect(loadGedcom('nonexistent-hash')).rejects.toMatchObject({
      code: 'ERROR_LOADING_UPLOADED_FILE',
    });
  });

  it('loads GEDCOM from the in-memory store', async () => {
    const hash = 'test-store-hash';
    storeGedcom(hash, MINIMAL_GEDCOM, new Map());
    const data = await loadGedcom(hash);
    expect(data.chartData.indis).toHaveLength(1);
    expect(data.chartData.fams).toHaveLength(1);
  });

  it('calls onProgress at each parse step', async () => {
    const hash = 'test-progress-hash';
    storeGedcom(hash, MINIMAL_GEDCOM, new Map());
    const steps: string[] = [];
    await loadGedcom(hash, (status) => steps.push(status));
    expect(steps).toEqual([
      'Step 1/4: parsing GEDCOM…',
      'Step 2/4: building family graph…',
      'Step 3/4: sorting & normalizing…',
      'Step 4/4: indexing records…',
    ]);
  });
});

describe('loadGedcom() session cache', () => {
  let sessionStorageMock: {[key: string]: string};

  beforeEach(() => {
    sessionStorageMock = mockSessionStorage();
  });

  it('caches prepared data in sessionStorage by default', async () => {
    const hash = 'cache-default-hash';
    storeGedcom(hash, MINIMAL_GEDCOM, new Map());
    await loadGedcom(hash);
    expect(sessionStorageMock[hash]).toBeDefined();
  });

  it('ignores and preserves the cache when useSessionCache is false', async () => {
    const hash = 'cache-disabled-hash';
    sessionStorageMock[hash] = JSON.stringify({stale: true});
    storeGedcom(hash, MINIMAL_GEDCOM, new Map());

    const data = await loadGedcom(hash, undefined, {useSessionCache: false});

    // Returned from the in-memory store, not the stale cache.
    expect(data.chartData.indis).toHaveLength(1);
    // The stale entry is neither served nor overwritten with fresh data.
    expect(sessionStorageMock[hash]).toBe(JSON.stringify({stale: true}));
  });
});
