/**
 * How the office pets get about (docs/plan/spec.md 「작업 공간 기믹」). A pet
 * follows a plan: a spot to walk or run to (through a few points on the
 * way, for zoomies), maybe a perch to hop up onto from there, and something
 * to do there a while. Its brain (officeCat.ts, officeDog.ts) says where it
 * must go at once, whether what it is doing still holds and where to go
 * next. Waking from a rest it stretches before it goes.
 *
 * `stepPet` is pure: the path finder, the clock and the dice are passed in.
 */

import type { PathState } from "@/stores/slices/types";
import { FLOOR_DEPTH, FLOOR_WIDTH } from "@/constants/isoFloorPlan";
import type { FloorPoint } from "./isoNavGrid";
import { advanceAlongPath } from "./pathFollow";

/** A point it stands or lies at, ``y`` up off the floor, turned ``facing`` (0 faces +z). */
export interface PetSpot {
  x: number;
  y: number;
  z: number;
  facing: number;
}

export interface PetPlan<A extends string> {
  /** Which plan this is: a spot's name, "wander", "follow" and so on. */
  id: string;
  /** Where it walks to, on the floor. */
  floor: PetSpot;
  /** Where it hops up to from there (a table, sofa, desk or back), if anywhere. */
  perch: PetSpot | null;
  act: A;
  /** How long it stays (ms), at least and at most. */
  stay: [number, number];
  /** How fast it goes there (m/s). */
  speed: number;
  /** Points it runs through on the way. */
  via?: FloorPoint[];
  /** A rest: it stretches before it leaves. */
  rest?: boolean;
  /** It stays until called away, however long that is. */
  hold?: boolean;
}

export type PetPhase = "walk" | "hopUp" | "hopDown" | "stay" | "stretch";

export interface Pet<A extends string> {
  x: number;
  y: number;
  z: number;
  facing: number;
  plan: PetPlan<A>;
  phase: PetPhase;
  path: PathState | null;
  /** Where a hop starts and lands, while it hops. */
  hop: { from: PetSpot; to: PetSpot } | null;
  /** Where it goes once it has stretched. */
  next: PetPlan<A> | null;
  /** When this phase began, and when a stay ends (ms). */
  since: number;
  until: number;
}

export interface PetClock {
  /** The clock (ms). */
  now: number;
  /** Seconds since the last step. */
  dt: number;
  /** A number in [0, 1). */
  random: () => number;
  findPath: (from: FloorPoint, to: FloorPoint) => FloorPoint[];
  walkable: (point: FloorPoint) => boolean;
}

/** Where Claude is and whether it sits at its desk or works in a room. */
export interface ClaudeAt {
  x: number;
  z: number;
  seated: boolean;
  working: boolean;
}

/** What one pet sees of the other. */
export interface PetSighting {
  x: number;
  y: number;
  z: number;
  facing: number;
  planId: string;
  phase: PetPhase;
  /** What it is doing (petActOf). */
  act: string;
}

/** Plans the two pets are given to play together (systems/petPlay.ts) start so. */
export const PLAY_PREFIX = "play:";

export interface PetBrain<A extends string, I extends PetClock> {
  /** Somewhere it must go now, dropping what it does; null when nothing calls. */
  urgent(pet: Pet<A>, input: I): PetPlan<A> | null;
  /** Whether what it is doing (or heading for) still makes sense. */
  keeps(pet: Pet<A>, input: I): boolean;
  /** Where to go next. */
  next(pet: Pet<A>, input: I): PetPlan<A>;
}

export const PET_STRETCH_MS = 1400;
/** A hop takes this long, and this much longer per metre up or down (ms). */
const HOP_MS = 450;
const HOP_MS_PER_METRE = 120;
/** At this speed or faster it runs rather than walks (m/s). */
export const PET_RUN_SPEED = 3;

export const towards = (from: FloorPoint, to: FloorPoint): number =>
  Math.atan2(to.x - from.x, to.z - from.z);

export const distance = (a: FloorPoint, b: FloorPoint): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

const hopMs = (hop: { from: PetSpot; to: PetSpot }): number =>
  HOP_MS + HOP_MS_PER_METRE * Math.abs(hop.to.y - hop.from.y);

function stayUntil<A extends string>(
  plan: PetPlan<A>,
  now: number,
  random: () => number,
): number {
  const [least, most] = plan.stay;
  return now + least + (most - least) * random();
}

/** Settled where ``plan`` takes it, as when the office opens. */
export function petAt<A extends string>(
  plan: PetPlan<A>,
  now: number,
  random: () => number,
): Pet<A> {
  return {
    ...(plan.perch ?? plan.floor),
    plan,
    phase: "stay",
    path: null,
    hop: null,
    next: null,
    since: now,
    until: stayUntil(plan, now, random),
  };
}

/**
 * A spot on the open floor it can get to from ``from``, within ``radius``
 * metres of ``around`` (anywhere when not given); null after ten misses.
 */
export function openSpot(
  from: FloorPoint,
  input: PetClock,
  around?: FloorPoint,
  radius = Infinity,
): FloorPoint | null {
  for (let tries = 0; tries < 10; tries++) {
    const point = around
      ? {
          x: around.x + (input.random() * 2 - 1) * radius,
          z: around.z + (input.random() * 2 - 1) * radius,
        }
      : {
          x: 1 + input.random() * (FLOOR_WIDTH - 2),
          z: 1 + input.random() * (FLOOR_DEPTH - 2),
        };
    const inside =
      point.x > 0.6 &&
      point.z > 0.6 &&
      point.x < FLOOR_WIDTH - 0.6 &&
      point.z < FLOOR_DEPTH - 0.6;
    if (!inside || !input.walkable(point)) continue;
    if (input.findPath(from, point).length > 0) return point;
  }
  return null;
}

/**
 * The first of ``around``'s neighbours ``reach`` metres off that it can
 * stand on: to the screen's left or right first (the camera looks from +x,
 * +z), so that turned to ``around`` it shows its side and hides neither.
 */
export function besidePoint(
  around: FloorPoint,
  reach: number,
  input: PetClock,
): FloorPoint | null {
  const sides: [number, number][] = [
    [-1, 1],
    [1, -1],
    [0, 1],
    [1, 0],
    [1, 1],
    [-1, 0],
    [0, -1],
    [-1, -1],
  ];
  for (const [dx, dz] of sides) {
    const length = Math.hypot(dx, dz);
    const point = {
      x: around.x + (dx / length) * reach,
      z: around.z + (dz / length) * reach,
    };
    if (input.walkable(point)) return point;
  }
  return null;
}

function walkTo<A extends string>(
  pet: Pet<A>,
  plan: PetPlan<A>,
  input: PetClock,
): Pet<A> {
  const points: FloorPoint[] = [{ x: pet.x, z: pet.z }];
  for (const to of [...(plan.via ?? []), plan.floor]) {
    const from = points[points.length - 1];
    const leg = input.findPath(from, to);
    points.push(...(leg.length > 0 ? leg.slice(1) : [to]));
  }
  return {
    ...pet,
    y: 0,
    plan,
    phase: "walk",
    path: {
      waypoints: points.map((p) => ({ x: p.x, y: p.z })),
      currentIndex: 0,
      progress: 0,
    },
    hop: null,
    next: null,
    since: input.now,
  };
}

/** Leave for ``plan``: down off its perch first, if it is up on one. */
function leaveFor<A extends string>(
  pet: Pet<A>,
  plan: PetPlan<A>,
  input: PetClock,
): Pet<A> {
  if (pet.y > 0) {
    const down = pet.plan.floor;
    return {
      ...pet,
      plan,
      phase: "hopDown",
      path: null,
      hop: { from: { ...pet }, to: { ...down, facing: pet.facing } },
      next: null,
      since: input.now,
    };
  }
  return walkTo(pet, plan, input);
}

function hopAlong<A extends string>(pet: Pet<A>, input: PetClock): Pet<A> {
  const hop = pet.hop;
  if (!hop) return pet;
  const t = Math.min(1, (input.now - pet.since) / hopMs(hop));
  const arc = 0.35 + 0.1 * Math.abs(hop.to.y - hop.from.y);
  if (t < 1) {
    return {
      ...pet,
      x: hop.from.x + (hop.to.x - hop.from.x) * t,
      z: hop.from.z + (hop.to.z - hop.from.z) * t,
      y: hop.from.y + (hop.to.y - hop.from.y) * t + arc * Math.sin(Math.PI * t),
    };
  }
  if (pet.phase === "hopDown") {
    return walkTo({ ...pet, ...hop.to }, pet.plan, input);
  }
  return {
    ...pet,
    ...hop.to,
    phase: "stay",
    hop: null,
    since: input.now,
    until: stayUntil(pet.plan, input.now, input.random),
  };
}

function walkAlong<A extends string>(pet: Pet<A>, input: PetClock): Pet<A> {
  if (!pet.path) return pet;
  const { floor, perch } = pet.plan;
  const step = advanceAlongPath(pet.path, pet.plan.speed * input.dt);
  if (step.arrived) {
    const there = { ...pet, ...floor, path: null, since: input.now };
    if (perch) {
      const facing = towards(floor, perch);
      return {
        ...there,
        facing,
        phase: "hopUp",
        hop: { from: { ...floor, facing }, to: perch },
      };
    }
    return {
      ...there,
      phase: "stay",
      until: stayUntil(pet.plan, input.now, input.random),
    };
  }
  const x = step.position.x;
  const z = step.position.y;
  const moved = x !== pet.x || z !== pet.z;
  return {
    ...pet,
    x,
    z,
    facing: moved ? towards(pet, { x, z }) : pet.facing,
    path: step.path,
  };
}

/** Move a pet on by ``input.dt``, as its brain sees fit. */
export function stepPet<A extends string, I extends PetClock>(
  pet: Pet<A>,
  input: I,
  brain: PetBrain<A, I>,
): Pet<A> {
  // Mid-hop down or mid-stretch it finishes first; it is on its way anyway.
  if (pet.phase !== "hopDown" && pet.phase !== "stretch") {
    const away =
      brain.urgent(pet, input) ??
      (brain.keeps(pet, input) ? null : brain.next(pet, input));
    if (away) {
      if (pet.phase === "stay" && pet.plan.rest) {
        return { ...pet, phase: "stretch", since: input.now, next: away };
      }
      // Mid-hop up it lands first, then goes.
      if (pet.phase !== "hopUp") return leaveFor(pet, away, input);
    }
  }
  switch (pet.phase) {
    case "walk":
      return walkAlong(pet, input);
    case "hopUp":
    case "hopDown":
      return hopAlong(pet, input);
    case "stretch":
      if (input.now - pet.since < PET_STRETCH_MS) return pet;
      return leaveFor(pet, pet.next ?? brain.next(pet, input), input);
    case "stay": {
      if (input.now < pet.until || pet.plan.hold) return pet;
      const next = brain.next(pet, input);
      if (pet.plan.rest) {
        return { ...pet, phase: "stretch", since: input.now, next };
      }
      return leaveFor(pet, next, input);
    }
  }
}

/** What it is doing, for posing it: on its way, or the plan's act once there. */
export function petActOf<A extends string>(
  pet: Pet<A>,
): A | "walk" | "run" | "hop" | "stretch" {
  switch (pet.phase) {
    case "walk":
      return pet.plan.speed >= PET_RUN_SPEED ? "run" : "walk";
    case "hopUp":
    case "hopDown":
      return "hop";
    case "stretch":
      return "stretch";
    case "stay":
      return pet.plan.act;
  }
}

/** What the other pet sees of this one. */
export function sightingOf<A extends string>(pet: Pet<A>): PetSighting {
  return {
    x: pet.x,
    y: pet.y,
    z: pet.z,
    facing: pet.facing,
    planId: pet.plan.id,
    phase: pet.phase,
    act: petActOf(pet),
  };
}
