import {describe, expect, it} from '@jest/globals';
import {JsonGedcomData} from 'topola';
import {
  findRelationshipPath,
  getAncestors,
  getDescendants,
  getFileName,
  getImageFileEntry,
  getName,
  getNonImageFileEntry,
  idToFamMap,
  idToIndiMap,
  isBrowserLoadable,
  isImageFile,
  normalizeGedcom,
  resolveFileUrl,
} from './gedcom_util';

describe('normalizeGedcom()', () => {
  it('sorts children', () => {
    const data = {
      indis: [
        {
          id: 'I3',
          birth: {date: {year: 1901}},
          famc: 'F1',
        },
        {
          id: 'I2',
          birth: {date: {year: 1902, month: 7}},
          famc: 'F1',
        },
        {
          id: 'I1',
          birth: {date: {year: 1902, month: 8}},
          famc: 'F1',
        },
      ],
      fams: [
        {
          id: 'F1',
          children: ['I1', 'I2', 'I3'],
        },
      ],
    };
    const normalized = normalizeGedcom(data);
    expect(normalized.fams[0].children).toEqual(['I3', 'I2', 'I1']);
  });

  it('sorts spouses', () => {
    const data = {
      indis: [
        {id: 'I1', fams: ['F1']},
        {id: 'I2', fams: ['F2']},
        {id: 'I3', fams: ['F3']},
        {id: 'I4', fams: ['F1', 'F2', 'F3']},
      ],
      fams: [
        {
          id: 'F3',
          marriage: {date: {year: 1901}},
          husband: 'I4',
          wife: 'I3',
        },
        {
          id: 'F2',
          marriage: {date: {year: 1902, month: 7}},
          husband: 'I4',
          wife: 'I2',
        },
        {
          id: 'F1',
          marriage: {date: {year: 1902, month: 8}},
          husband: 'I4',
          wife: 'I1',
        },
      ],
    };
    const normalized = normalizeGedcom(data);
    expect(normalized.indis.find((i) => i.id === 'I4')?.fams).toEqual([
      'F3',
      'F2',
      'F1',
    ]);
  });
});

describe('getName()', () => {
  it('returns undefined with no name available', () => {
    const person = {
      level: 1,
      pointer: '',
      tag: 'INDI',
      data: '',
      tree: [],
    };
    expect(getName(person)).toBe(undefined);
  });

  it('returns first name available', () => {
    const person = {
      level: 1,
      pointer: '',
      tag: 'INDI',
      data: '',
      tree: [
        {level: 2, pointer: '', tag: 'NAME', data: 'First /Name/', tree: []},
        {level: 2, pointer: '', tag: 'NAME', data: 'Second /Name/', tree: []},
      ],
    };
    expect(getName(person)).toBe('First Name');
  });

  it('prefers a name without TYPE=married', () => {
    const person = {
      level: 1,
      pointer: '',
      tag: 'INDI',
      data: '',
      tree: [
        {
          level: 2,
          pointer: '',
          tag: 'NAME',
          data: 'First /Name/',
          tree: [
            {level: 3, pointer: '', tag: 'TYPE', data: 'married', tree: []},
          ],
        },
        {level: 2, pointer: '', tag: 'NAME', data: 'Second /Name/', tree: []},
      ],
    };
    expect(getName(person)).toBe('Second Name');
  });

  it('picks a TYPE=married name if no other is available', () => {
    const person = {
      level: 1,
      pointer: '',
      tag: 'INDI',
      data: '',
      tree: [
        {
          level: 2,
          pointer: '',
          tag: 'NAME',
          data: 'Only /Name/',
          tree: [
            {level: 3, pointer: '', tag: 'TYPE', data: 'married', tree: []},
          ],
        },
      ],
    };
    expect(getName(person)).toBe('Only Name');
  });
});

describe('Relationship algorithms', () => {
  const sampleData: JsonGedcomData = {
    indis: [
      {id: 'I1', fams: ['F1']},
      {id: 'I2', fams: ['F1'], famc: 'F2'},
      {id: 'I3', famc: 'F1'},
      {id: 'I4', famc: 'F2'},
    ],
    fams: [
      {id: 'F1', husb: 'I1', wife: 'I2', children: ['I3']},
      {id: 'F2', children: ['I2', 'I4']},
    ],
  };

  const indiMap = idToIndiMap(sampleData);
  const famMap = idToFamMap(sampleData);

  it('findRelationshipPath finds direct paths', () => {
    const path = findRelationshipPath('I1', 'I3', indiMap, famMap);
    expect(path).toEqual(['I1', 'I3']);
  });

  it('findRelationshipPath finds sibling paths', () => {
    const path = findRelationshipPath('I2', 'I4', indiMap, famMap);
    expect(path).toEqual(['I2', 'I4']);
  });

  it('getAncestors respects generations bounds', () => {
    const ancestors = getAncestors('I3', 1, indiMap, famMap);
    expect(ancestors).toContain('I1');
    expect(ancestors).toContain('I2');
    expect(ancestors).not.toContain('I4');
  });

  it('getDescendants respects generations bounds', () => {
    const descendants = getDescendants('I2', 1, indiMap, famMap);
    expect(descendants).toContain('I3');
  });
});

describe('Media Resolution and Utilities', () => {
  describe('isImageFile()', () => {
    it('returns true for common images', () => {
      expect(isImageFile('test.jpg')).toBe(true);
      expect(isImageFile('test.png')).toBe(true);
      expect(isImageFile('test.gif')).toBe(true);
      expect(isImageFile('test.webp')).toBe(true);
    });

    it('returns false for non-images', () => {
      expect(isImageFile('test.pdf')).toBe(false);
      expect(isImageFile('test.txt')).toBe(false);
    });

    it('ignores query parameters and hashes', () => {
      expect(isImageFile('test.jpg?version=123')).toBe(true);
      expect(isImageFile('test.png#anchor')).toBe(true);
      expect(isImageFile('test.webp?a=1&b=2#h')).toBe(true);
      expect(isImageFile('test.pdf?img=test.jpg')).toBe(false);
    });

    it('treats blob: and data:image URLs as images', () => {
      expect(isImageFile('blob:https://example.org/0-1-2-3')).toBe(true);
      expect(isImageFile('data:image/avif;base64,AAAA')).toBe(true);
      expect(isImageFile('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    });

    it('does not treat non-image extensionless URLs as images', () => {
      expect(isImageFile('data:application/pdf;base64,AAAA')).toBe(false);
      expect(isImageFile('https://example.org/photo')).toBe(false);
    });
  });

  describe('isBrowserLoadable()', () => {
    it('returns true for browser loadable protocols', () => {
      expect(isBrowserLoadable('http://example.com/a.jpg')).toBe(true);
      expect(isBrowserLoadable('https://example.com/a.jpg')).toBe(true);
      expect(isBrowserLoadable('blob:http://localhost:3000/uuid')).toBe(true);
      expect(isBrowserLoadable('data:image/png;base64,abc')).toBe(true);
      expect(isBrowserLoadable('//example.com/a.jpg')).toBe(true);
    });

    it('returns false for relative local paths', () => {
      expect(isBrowserLoadable('photos/a.jpg')).toBe(false);
      expect(isBrowserLoadable('C:\\Users\\a.jpg')).toBe(false);
    });
  });

  describe('getFileName()', () => {
    it('prefers TITL and FORM if present', () => {
      const entry = {
        level: 2,
        pointer: '',
        tag: 'FILE',
        data: 'photos/ignored.jpg',
        tree: [
          {level: 3, pointer: '', tag: 'TITL', data: 'myphoto', tree: []},
          {level: 3, pointer: '', tag: 'FORM', data: 'png', tree: []},
        ],
      };
      expect(getFileName(entry)).toBe('myphoto.png');
    });

    it('falls back to data path name if TITL/FORM is missing', () => {
      const entry = {
        level: 2,
        pointer: '',
        tag: 'FILE',
        data: 'photos/realname.jpg?width=100',
        tree: [],
      };
      expect(getFileName(entry)).toBe('realname.jpg');
    });
  });

  describe('resolveFileUrl()', () => {
    it('passes through browser loadable URLs', () => {
      expect(resolveFileUrl('https://example.com/img.jpg')).toBe(
        'https://example.com/img.jpg',
      );
      expect(resolveFileUrl('blob:uuid')).toBe('blob:uuid');
    });

    it('matches path case-insensitively from images map', () => {
      const images = new Map([['photos/img.jpg', 'blob:resolved']]);
      expect(resolveFileUrl('photos/img.jpg', images)).toBe('blob:resolved');
      expect(resolveFileUrl('PHOTOS\\IMG.JPG', images)).toBe('blob:resolved');
    });

    it('does not match base filename from images map', () => {
      const images = new Map([['img.jpg', 'blob:resolved-base']]);
      expect(resolveFileUrl('photos/IMG.JPG', images)).toBe('photos/IMG.JPG');
    });

    it('falls back to normalized path if no match found', () => {
      expect(resolveFileUrl('photos\\img.jpg')).toBe('photos/img.jpg');
    });
  });

  describe('findFileEntries() via getters', () => {
    const objectEntry = {
      level: 1,
      pointer: '@O1@',
      tag: 'OBJE',
      data: '',
      tree: [
        {level: 2, pointer: '', tag: 'FILE', data: 'photos/a.jpg', tree: []},
        {level: 2, pointer: '', tag: 'FILE', data: 'documents/b.pdf', tree: []},
        {
          level: 2,
          pointer: '',
          tag: 'FILE',
          data: 'https://example.com/c.png',
          tree: [],
        },
      ],
    };

    it('extracts images including relative and web URLs', () => {
      const image = getImageFileEntry(objectEntry);
      expect(image?.data).toBe('photos/a.jpg');
    });

    it('extracts non-images', () => {
      const nonImage = getNonImageFileEntry(objectEntry);
      expect(nonImage?.data).toBe('documents/b.pdf');
    });
  });
});
