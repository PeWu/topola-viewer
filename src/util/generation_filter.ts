import {JsonFam, JsonGedcomData, JsonIndi} from 'topola';
import {idToFamMap, idToIndiMap} from './gedcom_util';

/**
 * Maximum number of generations to show above (ancestors) and below
 * (descendants) the selected individual. `undefined` means no limit.
 */
export interface GenerationLimits {
  up?: number;
  down?: number;
}

/**
 * Returns the generation of each individual relative to the start individual:
 * +1 for parents, -1 for children, 0 for spouses, and so on. Individuals are
 * reached only through parent, child and spouse links without leaving the
 * [-down, +up] range, so relatives are kept only if the ancestor they share
 * with the start individual is within the limit (siblings need the parents,
 * cousins need the grandparents).
 */
export function getRelativeGenerations(
  startId: string,
  indiMap: Map<string, JsonIndi>,
  famMap: Map<string, JsonFam>,
  limits: GenerationLimits,
): Map<string, number> {
  const up = limits.up ?? Infinity;
  const down = limits.down ?? Infinity;
  const generations = new Map<string, number>([[startId, 0]]);
  const queue = [startId];

  const visit = (id: string | undefined, generation: number) => {
    if (
      id &&
      !generations.has(id) &&
      indiMap.has(id) &&
      generation <= up &&
      generation >= -down
    ) {
      generations.set(id, generation);
      queue.push(id);
    }
  };

  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    const generation = generations.get(id);
    const indi = indiMap.get(id);
    if (generation === undefined || !indi) {
      continue;
    }

    const parents = indi.famc ? famMap.get(indi.famc) : undefined;
    if (parents) {
      visit(parents.husb, generation + 1);
      visit(parents.wife, generation + 1);
    }
    indi.fams?.forEach((famId) => {
      const fam = famMap.get(famId);
      if (!fam) {
        return;
      }
      visit(fam.husb, generation);
      visit(fam.wife, generation);
      fam.children?.forEach((child) => visit(child, generation - 1));
    });
  }
  return generations;
}

/**
 * Returns the data restricted to the individuals within the given number of
 * generations above and below the start individual. Links to removed
 * individuals and families are removed as well. Returns the data unchanged
 * when there is no limit.
 */
export function filterByGenerations(
  data: JsonGedcomData,
  startId: string,
  limits: GenerationLimits,
): JsonGedcomData {
  if (limits.up === undefined && limits.down === undefined) {
    return data;
  }
  const indiMap = idToIndiMap(data);
  if (!indiMap.has(startId)) {
    return data;
  }
  const famMap = idToFamMap(data);
  const kept = getRelativeGenerations(startId, indiMap, famMap, limits);

  // A family is kept when at least one of its spouses is kept.
  const fams: JsonFam[] = [];
  for (const fam of data.fams) {
    const husb = fam.husb && kept.has(fam.husb) ? fam.husb : undefined;
    const wife = fam.wife && kept.has(fam.wife) ? fam.wife : undefined;
    if (!husb && !wife) {
      continue;
    }
    const {husb: _husb, wife: _wife, children, ...rest} = fam;
    fams.push({
      ...rest,
      ...(husb ? {husb} : {}),
      ...(wife ? {wife} : {}),
      ...(children ? {children: children.filter((id) => kept.has(id))} : {}),
    });
  }
  const keptFams = new Set(fams.map((fam) => fam.id));

  const indis: JsonIndi[] = [];
  for (const indi of data.indis) {
    if (!kept.has(indi.id)) {
      continue;
    }
    const {famc, fams: indiFams, ...rest} = indi;
    indis.push({
      ...rest,
      ...(famc && keptFams.has(famc) ? {famc} : {}),
      ...(indiFams ? {fams: indiFams.filter((id) => keptFams.has(id))} : {}),
    });
  }
  return {...data, indis, fams};
}
