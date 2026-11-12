import {describe, expect, it} from '@jest/globals';
import {JsonGedcomData} from 'topola';
import {filterByGenerations} from './generation_filter';

/**
 * Four generations:
 *
 *   gp1 + gp2                    (grandparents)
 *       |
 *   ----------
 *   |        |
 *   p1 + p2  uncle               (parents, uncle)
 *      |        |
 *   -------     cousin           (generation 0)
 *   |     |
 *   me    sister
 *   |
 *   child                        (children, with spouse "wife")
 *   |
 *   grandchild
 */
const DATA: JsonGedcomData = {
  indis: [
    {id: 'gp1', fams: ['F1']},
    {id: 'gp2', fams: ['F1']},
    {id: 'p1', famc: 'F1', fams: ['F2']},
    {id: 'p2', fams: ['F2']},
    {id: 'uncle', famc: 'F1', fams: ['F3']},
    {id: 'cousin', famc: 'F3'},
    {id: 'me', famc: 'F2', fams: ['F4']},
    {id: 'wife', fams: ['F4']},
    {id: 'sister', famc: 'F2'},
    {id: 'child', famc: 'F4', fams: ['F5']},
    {id: 'grandchild', famc: 'F5'},
  ],
  fams: [
    {id: 'F1', husb: 'gp1', wife: 'gp2', children: ['p1', 'uncle']},
    {id: 'F2', husb: 'p1', wife: 'p2', children: ['me', 'sister']},
    {id: 'F3', husb: 'uncle', children: ['cousin']},
    {id: 'F4', husb: 'me', wife: 'wife', children: ['child']},
    {id: 'F5', husb: 'child', children: ['grandchild']},
  ],
};

function ids(data: JsonGedcomData) {
  return data.indis.map((indi) => indi.id).sort();
}

function indi(data: JsonGedcomData, id: string) {
  return data.indis.find((i) => i.id === id);
}

function fam(data: JsonGedcomData, id: string) {
  return data.fams.find((f) => f.id === id);
}

describe('filterByGenerations', () => {
  it('returns the data unchanged without limits', () => {
    expect(filterByGenerations(DATA, 'me', {})).toBe(DATA);
  });

  it('returns the data unchanged for an unknown individual', () => {
    expect(filterByGenerations(DATA, 'unknown', {up: 1})).toBe(DATA);
  });

  it('limits generations above', () => {
    const result = filterByGenerations(DATA, 'me', {up: 1});
    expect(ids(result)).toEqual(
      ['child', 'grandchild', 'me', 'p1', 'p2', 'sister', 'wife'].sort(),
    );
    // The parents' family no longer links to the removed grandparents.
    expect(indi(result, 'p1')?.famc).toBeUndefined();
    expect(result.fams.map((fam) => fam.id).sort()).toEqual(['F2', 'F4', 'F5']);
  });

  it('limits generations below', () => {
    const result = filterByGenerations(DATA, 'me', {down: 1});
    expect(ids(result)).not.toContain('grandchild');
    expect(ids(result)).toContain('child');
    // The child's own family is kept, without the grandchild.
    expect(indi(result, 'child')?.fams).toEqual(['F5']);
    expect(fam(result, 'F5')?.children).toEqual([]);
    expect(fam(result, 'F4')?.children).toEqual(['child']);
  });

  it('keeps cousins when their common ancestor is within the limit', () => {
    expect(ids(filterByGenerations(DATA, 'me', {up: 2, down: 0}))).toEqual(
      [
        'cousin',
        'gp1',
        'gp2',
        'me',
        'p1',
        'p2',
        'sister',
        'uncle',
        'wife',
      ].sort(),
    );
    expect(
      ids(filterByGenerations(DATA, 'me', {up: 1, down: 0})),
    ).not.toContain('cousin');
  });

  it('keeps siblings only with their parents', () => {
    expect(ids(filterByGenerations(DATA, 'me', {up: 1}))).toContain('sister');
    expect(ids(filterByGenerations(DATA, 'me', {up: 0}))).not.toContain(
      'sister',
    );
  });

  it('allows zero generations', () => {
    expect(ids(filterByGenerations(DATA, 'me', {up: 0, down: 0}))).toEqual([
      'me',
      'wife',
    ]);
  });

  it('is relative to the selected individual', () => {
    expect(ids(filterByGenerations(DATA, 'grandchild', {up: 1}))).toEqual([
      'child',
      'grandchild',
    ]);
  });
});
