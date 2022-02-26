import {getName, normalizeGedcom} from './gedcom_util';

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
    expect(normalized.indis.find((i) => i.id === 'I4')!.fams).toEqual([
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
