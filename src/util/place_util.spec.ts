import {describe, expect, it} from '@jest/globals';
import {PlaceDisplay, shortenPlace} from './place_util';

const LONG = 'Cyclone, Keating Township, McKean, Pennsylvania, United States';

describe('shortenPlace', () => {
  it('returns full place unchanged in FULL mode', () => {
    expect(shortenPlace(LONG, PlaceDisplay.FULL)).toBe(LONG);
  });

  it('returns undefined in HIDE mode', () => {
    expect(shortenPlace(LONG, PlaceDisplay.HIDE)).toBeUndefined();
  });

  it('defaults to 2 components in SHORT mode', () => {
    expect(shortenPlace(LONG, PlaceDisplay.SHORT)).toBe('Cyclone, Keating Township');
  });

  it('keeps first N components when count is specified', () => {
    expect(shortenPlace(LONG, PlaceDisplay.SHORT, 1)).toBe('Cyclone');
    expect(shortenPlace(LONG, PlaceDisplay.SHORT, 3)).toBe(
      'Cyclone, Keating Township, McKean',
    );
  });

  it('leaves place unchanged when it has fewer parts than count', () => {
    expect(shortenPlace('Berlin, Germany', PlaceDisplay.SHORT, 3)).toBe(
      'Berlin, Germany',
    );
  });

  it('leaves single-component place unchanged in SHORT mode', () => {
    expect(shortenPlace('Germany', PlaceDisplay.SHORT)).toBe('Germany');
  });

  it('handles undefined place', () => {
    expect(shortenPlace(undefined, PlaceDisplay.SHORT)).toBeUndefined();
  });

  it('handles empty string', () => {
    expect(shortenPlace('', PlaceDisplay.SHORT)).toBe('');
  });

  it('is idempotent — applying SHORT twice with same count gives same result', () => {
    const once = shortenPlace(LONG, PlaceDisplay.SHORT, 2);
    expect(shortenPlace(once, PlaceDisplay.SHORT, 2)).toBe(once);
  });
});
