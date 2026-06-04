import {describe, expect, it} from '@jest/globals';
import {fileFingerprint} from './file_fingerprint';

const makeFile = (
  name: string,
  size: number,
  lastModified: number,
): Pick<File, 'name' | 'size' | 'lastModified'> => ({name, size, lastModified});

describe('fileFingerprint()', () => {
  const file = makeFile('family.ged', 10_000, 1_700_000_000_000);

  it('returns a non-empty string', () => {
    expect(fileFingerprint(file, '0 HEAD\n0 TRLR', '')).toMatch(
      /^[a-f0-9]{32}$/,
    );
  });

  it('produces the same hash for the same inputs', () => {
    const a = fileFingerprint(file, '0 HEAD\n0 TRLR', '');
    const b = fileFingerprint(file, '0 HEAD\n0 TRLR', '');
    expect(a).toBe(b);
  });

  it('differs when file name changes', () => {
    const other = makeFile('other.ged', 10_000, 1_700_000_000_000);
    expect(fileFingerprint(file, '0 HEAD\n0 TRLR', '')).not.toBe(
      fileFingerprint(other, '0 HEAD\n0 TRLR', ''),
    );
  });

  it('differs when file size changes', () => {
    const bigger = makeFile('family.ged', 20_000, 1_700_000_000_000);
    expect(fileFingerprint(file, '0 HEAD\n0 TRLR', '')).not.toBe(
      fileFingerprint(bigger, '0 HEAD\n0 TRLR', ''),
    );
  });

  it('differs when content differs beyond the 4KB sample boundary', () => {
    const base = '0 HEAD\n' + 'X'.repeat(8192) + '\n0 TRLR';
    const diff = '0 HEAD\n' + 'Y'.repeat(8192) + '\n0 TRLR';
    expect(fileFingerprint(file, base, '')).not.toBe(
      fileFingerprint(file, diff, ''),
    );
  });

  it('differs when image file names change', () => {
    const a = fileFingerprint(file, '0 HEAD\n0 TRLR', 'photo.jpg');
    const b = fileFingerprint(file, '0 HEAD\n0 TRLR', '');
    expect(a).not.toBe(b);
  });
});
