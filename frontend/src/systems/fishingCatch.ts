/**
 * The fishing spot's catch (설정 「장소」 · 낚시터): a fish for every commit
 * the session made, bigger the more there are. The first three are crucian
 * carp (붕어), then carp (잉어), then mirror carp (향어), and from the tenth
 * on a trophy crucian over a foot long (월척). The tank by the office holds
 * the latest dozen and the catch board counts them all. Pure: no three.js.
 */

export const SPECIES = ["crucian", "carp", "mirror", "trophy"] as const;
export type Species = (typeof SPECIES)[number];

/** The tank by the office holds this many fish. */
export const MAX_TANK = 12;

/** How long a catch is held up for all to see (ms). */
export const CATCH_MS = 2600;

/** The ``nth`` fish of the session (1 the first). */
export function speciesFor(nth: number): Species {
  if (nth <= 3) return "crucian";
  if (nth <= 6) return "carp";
  if (nth <= 9) return "mirror";
  return "trophy";
}

/** The fish swimming in the tank after ``count`` commits: the latest dozen, oldest first. */
export function tankFor(count: number): Species[] {
  const first = Math.max(1, count - MAX_TANK + 1);
  const fish: Species[] = [];
  for (let nth = first; nth <= count; nth++) fish.push(speciesFor(nth));
  return fish;
}

/** How many of each kind ``count`` commits caught, for the catch board. */
export function tally(count: number): Record<Species, number> {
  const counts: Record<Species, number> = {
    crucian: 0,
    carp: 0,
    mirror: 0,
    trophy: 0,
  };
  for (let nth = 1; nth <= count; nth++) counts[speciesFor(nth)] += 1;
  return counts;
}
