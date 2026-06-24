import {describe, expect, it} from '@jest/globals';
import {Blob, Buffer} from 'buffer';
import {zipSync} from 'fflate';
import {readFileSync} from 'fs';
import {loadFile} from './load_data';

describe('loadFile', () => {
  global.URL.createObjectURL = jest.fn();

  it('loads GEDCOM file', async () => {
    const file = readFileSync('src/datasource/testdata/test.ged');
    const blob = new Blob([file]) as globalThis.Blob;
    const {gedcom, images} = await loadFile(blob);
    // File length may differ between Linux and Windows due to line endings (\n vs \r\n)
    // So, check for a set of values instead of exactly one value
    expect([4549, 4909]).toContain(gedcom.length);
    expect(images).toEqual(new Map());
  });

  it('loads GEDZIP file', async () => {
    const file = zipSync({
      'test.ged': readFileSync('src/datasource/testdata/test.ged'),
      'topola.jpg': readFileSync('src/datasource/testdata/topola.jpg'),
    });
    const blob = new Blob([Buffer.from(file)]) as globalThis.Blob;
    const {gedcom, images} = await loadFile(blob);
    expect([4549, 4909]).toContain(gedcom.length);
    expect(images.size).toBe(1);
  });
});
