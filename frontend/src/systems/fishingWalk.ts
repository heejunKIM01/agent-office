/**
 * How people get about the reservoir fishing spot (설정 「장소」 · 낚시터):
 * which kind of work sends them where, and the way there on the banks, the
 * deck, the pontoon and the huts without stepping into the water or
 * through the office. The walk a step at a time is systems/placeWalk.ts.
 * Pure: no three.js.
 */

import {
  OBSTACLES,
  WALKABLE,
  WAYPOINTS,
  type FishingRect,
  type FishingWorkSpot,
} from "@/constants/fishingPlan";
import type { Activity } from "@/types";
import { distance, type Point } from "./placeWalk";

/** Where each kind of tool sends someone. */
export const SPOT_FOR_ACTIVITY: Record<Activity, FishingWorkSpot> = {
  reading: "pontoon",
  editing: "seats",
  running: "net",
  browsing: "shop",
  planning: "board",
  asking: "guest",
};

/** How far a person keeps from the water's edge and from things in the way. */
export const WALK_MARGIN = 0.5;
const OBSTACLE_MARGIN = 0.6;

const inside = (p: Point, r: FishingRect, grow = 0): boolean =>
  p.x >= r.x - grow &&
  p.x <= r.x + r.w + grow &&
  p.z >= r.z - grow &&
  p.z <= r.z + r.d + grow;

const onGround = (p: Point): boolean =>
  WALKABLE.some((rect) => inside(p, rect));

/**
 * Whether a person can stand at ``p``: on the ground with a margin all
 * round (where the bank meets the pontoon it may be on both), and clear of
 * the office, the cabins, the boards, the tank and the rest.
 */
export function canStand(p: Point): boolean {
  const m = WALK_MARGIN;
  const ground = [
    p,
    { x: p.x - m, z: p.z },
    { x: p.x + m, z: p.z },
    { x: p.x, z: p.z - m },
    { x: p.x, z: p.z + m },
  ].every(onGround);
  return ground && !OBSTACLES.some((rect) => inside(p, rect, OBSTACLE_MARGIN));
}

/** Whether a straight walk from ``a`` to ``b`` stays where people can stand. */
export function clearWalk(a: Point, b: Point): boolean {
  const steps = Math.ceil(distance(a, b) / 0.3);
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    if (!canStand({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }))
      return false;
  }
  return true;
}

/**
 * The way from ``a`` to ``b``: straight when that stays on dry ground,
 * else the shortest way by the turning points. Straight on when there is
 * no way at all.
 */
export function routeTo(a: Point, b: Point): Point[] {
  if (clearWalk(a, b)) return [b];
  const nodes: Point[] = [a, ...WAYPOINTS, b];
  const end = nodes.length - 1;
  const best = nodes.map(() => Infinity);
  const from = nodes.map(() => -1);
  const done = nodes.map(() => false);
  best[0] = 0;
  for (;;) {
    let at = -1;
    for (let i = 0; i <= end; i++) {
      if (!done[i] && best[i] < Infinity && (at < 0 || best[i] < best[at]))
        at = i;
    }
    if (at < 0 || at === end) break;
    done[at] = true;
    for (let next = 0; next <= end; next++) {
      if (done[next] || !clearWalk(nodes[at], nodes[next])) continue;
      const length = best[at] + distance(nodes[at], nodes[next]);
      if (length < best[next]) {
        best[next] = length;
        from[next] = at;
      }
    }
  }
  if (best[end] === Infinity) return [b];
  const way: Point[] = [];
  for (let i = end; i > 0; i = from[i]) way.unshift(nodes[i]);
  return way;
}
