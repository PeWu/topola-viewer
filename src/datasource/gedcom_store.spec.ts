import {describe, expect, it} from '@jest/globals';
import {getStoredGedcom, storeGedcom} from './gedcom_store';

// Reset module state between tests by re-importing fresh; since Jest caches
// modules we instead test the observable contract directly.

describe('gedcom_store', () => {
  const images = new Map<string, string>();

  it('returns undefined for an unknown hash', () => {
    expect(getStoredGedcom('unknown')).toBeUndefined();
  });

  it('stores and retrieves a GEDCOM by hash', () => {
    storeGedcom('hash-a', '0 HEAD', images);
    const result = getStoredGedcom('hash-a');
    expect(result?.gedcom).toBe('0 HEAD');
    expect(result?.images).toBe(images);
  });

  it('evicts the previous entry when a new one is stored', () => {
    storeGedcom('hash-b', 'file b content', images);
    storeGedcom('hash-c', 'file c content', images);
    // Old hash is gone.
    expect(getStoredGedcom('hash-b')).toBeUndefined();
    // New hash is retrievable.
    expect(getStoredGedcom('hash-c')?.gedcom).toBe('file c content');
  });

  it('returns undefined for a hash that was evicted', () => {
    storeGedcom('hash-d', 'first', images);
    storeGedcom('hash-e', 'second', images);
    expect(getStoredGedcom('hash-d')).toBeUndefined();
  });

  it('returns the same entry on repeated gets', () => {
    storeGedcom('hash-f', 'data', images);
    expect(getStoredGedcom('hash-f')).toBe(getStoredGedcom('hash-f'));
  });
});
