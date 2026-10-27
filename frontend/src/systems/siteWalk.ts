/**
 * How people get about the construction site (설정 「장소」 · 건설 현장):
 * which kind of work sends them where, the way round the building, a walk
 * a step at a time, and how many floors the building has for the commits
 * made. Pure: no three.js.
 */

import {
  BUILDING,
  DETOURS,
  MAX_FLOORS,
  type WorkSpot,
} from "@/constants/sitePlan";
import type { Activity } from "@/types";

/** Where each kind of tool sends someone. */
export const SPOT_FOR_ACTIVITY: Record<Activity, WorkSpot> = {
  reading: "plans",
  editing: "build",
  running: "machines",
  browsing: "yard",
  planning: "board",
  asking: "owner",
};

export interface Point {
  x: number;
  z: number;
}

const distance = (a: Point, b: Point): number =>
  Math.hypot(b.x - a.x, b.z - a.z);

/** Whether a straight walk from ``a`` to ``b`` keeps ``margin`` clear of the building. */
export function clearOfBuilding(a: Point, b: Point, margin = 1.2): boolean {
  const steps = Math.ceil(distance(a, b) / 0.4);
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    const inside =
      x > BUILDING.x - margin &&
      x < BUILDING.x + BUILDING.w + margin &&
      z > BUILDING.z - margin &&
      z < BUILDING.z + BUILDING.d + margin;
    if (inside) return false;
  }
  return true;
}

/**
 * The way from ``a`` to ``b``: straight when that misses the building,
 * else by the front corner (or both) that keeps it shortest.
 */
export function routeTo(a: Point, b: Point): Point[] {
  if (clearOfBuilding(a, b)) return [b];
  const ways: Point[][] = [];
  for (const d of DETOURS) {
    if (clearOfBuilding(a, d) && clearOfBuilding(d, b)) ways.push([d, b]);
  }
  for (const [d, e] of [DETOURS, [...DETOURS].reverse()]) {
    if (
      clearOfBuilding(a, d) &&
      clearOfBuilding(d, e) &&
      clearOfBuilding(e, b)
    ) {
      ways.push([d, e, b]);
    }
  }
  const length = (way: Point[]): number =>
    way.reduce((sum, p, i) => sum + distance(i === 0 ? a : way[i - 1], p), 0);
  return ways.sort((x, y) => length(x) - length(y))[0] ?? [b];
}

export interface Walker {
  x: number;
  z: number;
  /** Heading about y (0 faces +z). */
  facing: number;
  /** The points still to walk to, the last one the destination. */
  path: Point[];
}

/** How fast people walk (units a second). */
export const WALK_SPEED = 3.4;

/** Move a walker ``dt`` seconds along its path, facing the way it goes. */
export function stepWalk(
  walker: Walker,
  dt: number,
  speed = WALK_SPEED,
): Walker {
  let { x, z, facing } = walker;
  const path = [...walker.path];
  let left = speed * dt;
  while (path.length > 0 && left > 0) {
    const next = path[0];
    const gap = distance({ x, z }, next);
    if (gap > 1e-6) facing = Math.atan2(next.x - x, next.z - z);
    if (gap <= left) {
      x = next.x;
      z = next.z;
      left -= gap;
      path.shift();
    } else {
      x += ((next.x - x) / gap) * left;
      z += ((next.z - z) / gap) * left;
      left = 0;
    }
  }
  return { x, z, facing, path };
}

/** How many floors stand after ``commits`` commits: the ground floor and one a commit. */
export const floorsFor = (commits: number): number =>
  Math.min(MAX_FLOORS, 1 + Math.max(0, commits));
