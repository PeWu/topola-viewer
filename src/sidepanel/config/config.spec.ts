import {describe, expect, it} from '@jest/globals';
import {configToArgs, DEFALUT_CONFIG, Occupations, Titles} from './config';

describe('configToArgs', () => {
  it('removes occupations and titles from the URL when hidden', () => {
    const args = configToArgs(DEFALUT_CONFIG);
    // null removes a previous value from the URL (see getUrlForArgs).
    expect(args.o).toBeNull();
    expect(args.t).toBeNull();
  });

  it('writes occupations and titles to the URL when shown', () => {
    const args = configToArgs({
      ...DEFALUT_CONFIG,
      occupations: Occupations.SHOW,
      titles: Titles.SHOW,
    });
    expect(args.o).toBe('s');
    expect(args.t).toBe('s');
  });
});
