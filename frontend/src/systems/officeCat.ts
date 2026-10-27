/**
 * The office cat (docs/plan/spec.md 「작업 공간 기믹」): it strolls from one
 * favourite spot to the next and does there what cats do: naps curled up on
 * its tower in the lounge, loafs on the sofa's armrest, washes on the
 * library table, dozes by the warm server racks, eats at its bowl in the
 * cafe, sniffs the plant in the search room and rubs against Claude's legs
 * while Claude sits at its desk. Waking from a nap it stretches before it
 * goes.
 * When Claude has waited on my next prompt a while it heads for my keyboard
 * and lies on it until I type.
 *
 * `stepOfficeCat` is pure: the path finder, the clock and the dice are
 * passed in.
 */

import type { PathState } from "@/stores/slices/types";
import {
  CAT_BOWL,
  CAT_TOWER,
  CLAUDE_SEAT,
  MY_SEAT,
} from "@/constants/isoFloorPlan";
import type { FloorPoint } from "./isoNavGrid";
import { advanceAlongPath } from "./pathFollow";

/** Where the cat goes: its favourite spots, and my keyboard. */
export type CatStopId =
  | "tower"
  | "sofa"
  | "library"
  | "server"
  | "bowl"
  | "plant"
  | "claude"
  | "keyboard";

/** What it does once there. */
export type CatAct =
  "sleep" | "loaf" | "groom" | "doze" | "eat" | "sniff" | "rub" | "keyboard";

/** A point it stands or lies at, ``y`` up off the floor, turned ``facing`` (0 faces +z). */
export interface CatSpot {
  x: number;
  y: number;
  z: number;
  facing: number;
}

export interface CatStop {
  /** Where it walks to, on the floor. */
  floor: CatSpot;
  /** Where it hops up to from there (a table, sofa or desk), if anywhere. */
  perch: CatSpot | null;
  act: CatAct;
  /** How long it stays (ms), at least and at most; the keyboard: until I type. */
  stay: [number, number];
}

/** The height of the bed on its tower (isoFurniture.ts). */
const CAT_TOWER_BED = 1.67;
/** Turned this way, it faces the camera; turned the other, it shows its side as well. */
const TO_CAMERA = 0.8;
const THREE_QUARTER = 0.15;

const towardsPoint = (from: FloorPoint, to: FloorPoint): number =>
  Math.atan2(to.x - from.x, to.z - from.z);

const SEARCH_PLANT: FloorPoint = { x: 38.8, z: 20.6 };
const SNIFF_AT: FloorPoint = { x: 38.1, z: 21.3 };
const CLAUDE_RUB: FloorPoint = {
  x: CLAUDE_SEAT.x - 0.8,
  z: CLAUDE_SEAT.z + 0.6,
};

export const CAT_STOPS: Record<CatStopId, CatStop> = {
  tower: {
    floor: { x: CAT_TOWER.x, y: 0, z: CAT_TOWER.z + 1.3, facing: Math.PI },
    perch: {
      x: CAT_TOWER.x,
      y: CAT_TOWER_BED,
      z: CAT_TOWER.z,
      facing: TO_CAMERA,
    },
    act: "sleep",
    stay: [40_000, 70_000],
  },
  // The armrest at the sofa's left end, beside whoever rests there.
  sofa: {
    floor: { x: 2.75, y: 0, z: 22.75, facing: Math.PI / 2 },
    perch: { x: 3.41, y: 0.72, z: 22.25, facing: 0 },
    act: "loaf",
    stay: [20_000, 35_000],
  },
  library: {
    floor: { x: 7.6, y: 0, z: 7.6, facing: -2.4 },
    perch: { x: 6.5, y: 0.78, z: 6.7, facing: THREE_QUARTER },
    act: "groom",
    stay: [15_000, 25_000],
  },
  // On the floor in front of the racks, where the air is warm.
  server: {
    floor: { x: 34.3, y: 0, z: 6.7, facing: THREE_QUARTER },
    perch: null,
    act: "doze",
    stay: [25_000, 40_000],
  },
  bowl: {
    floor: { x: CAT_BOWL.x, y: 0, z: CAT_BOWL.z - 0.6, facing: 0 },
    perch: null,
    act: "eat",
    stay: [8_000, 12_000],
  },
  // The plant in the corner of the search room.
  plant: {
    floor: { ...SNIFF_AT, y: 0, facing: towardsPoint(SNIFF_AT, SEARCH_PLANT) },
    perch: null,
    act: "sniff",
    stay: [4_000, 6_000],
  },
  claude: {
    floor: {
      ...CLAUDE_RUB,
      y: 0,
      facing: towardsPoint(CLAUDE_RUB, CLAUDE_SEAT),
    },
    perch: null,
    act: "rub",
    stay: [6_000, 9_000],
  },
  // Behind my desk, then up onto the keyboard in front of my chair.
  keyboard: {
    floor: { x: 17.6, y: 0, z: 18, facing: Math.PI / 2 },
    perch: {
      x: MY_SEAT.x + 0.85 * Math.sin(MY_SEAT.facing),
      y: 1.01,
      z: MY_SEAT.z + 0.85 * Math.cos(MY_SEAT.facing),
      facing: TO_CAMERA,
    },
    act: "keyboard",
    stay: [0, 0],
  },
};

/** The spots it strolls between, in no order. */
export const STROLL_STOPS: CatStopId[] = [
  "tower",
  "sofa",
  "library",
  "server",
  "bowl",
  "plant",
  "claude",
];

/** Walking speed (m/s): an amble, slower than people. */
export const CAT_WALK_SPEED = 1.3;
/** A hop up onto or down from a perch (ms). */
export const CAT_HOP_MS = 450;
/** Waking from a rest it stretches this long before it goes (ms). */
export const CAT_STRETCH_MS = 1400;
const RESTS: ReadonlySet<CatAct> = new Set([
  "sleep",
  "loaf",
  "doze",
  "keyboard",
]);

export type CatPhase = "walk" | "hopUp" | "hopDown" | "stay" | "stretch";

export interface OfficeCat {
  x: number;
  y: number;
  z: number;
  facing: number;
  /** Where it is heading or staying. */
  stop: CatStopId;
  phase: CatPhase;
  path: PathState | null;
  /** Where a hop starts and lands, while it hops. */
  hop: { from: CatSpot; to: CatSpot } | null;
  /** When this phase began, and when a stay ends (ms). */
  since: number;
  until: number;
}

export interface CatInput {
  /** The clock (ms). */
  now: number;
  /** Seconds since the last step. */
  dt: number;
  /** Claude has waited on my next prompt a while: go lie on my keyboard. */
  napping: boolean;
  /** Claude sits at its desk: its legs are there to rub against. */
  claudeSeated: boolean;
  /** A number in [0, 1). */
  random: () => number;
  findPath: (from: FloorPoint, to: FloorPoint) => FloorPoint[];
}

const settleSpot = (stop: CatStopId): CatSpot =>
  CAT_STOPS[stop].perch ?? CAT_STOPS[stop].floor;

function stayFor(stop: CatStopId, now: number, random: () => number): number {
  const [least, most] = CAT_STOPS[stop].stay;
  return now + least + (most - least) * random();
}

/** Settled at ``stop`` (curled up on the tower when the office opens). */
export function catAt(
  stop: CatStopId,
  now: number,
  random: () => number,
): OfficeCat {
  const spot = settleSpot(stop);
  return {
    ...spot,
    stop,
    phase: "stay",
    path: null,
    hop: null,
    since: now,
    until: stayFor(stop, now, random),
  };
}

/** Somewhere else to stroll to; Claude's legs only while Claude sits at its desk. */
export function nextStop(
  from: CatStopId,
  claudeSeated: boolean,
  random: () => number,
): CatStopId {
  const choices = STROLL_STOPS.filter(
    (stop) => stop !== from && (stop !== "claude" || claudeSeated),
  );
  return choices[Math.floor(random() * choices.length)] ?? "tower";
}

function walkTo(cat: OfficeCat, stop: CatStopId, input: CatInput): OfficeCat {
  const to = CAT_STOPS[stop].floor;
  const found = input.findPath(cat, to);
  const points = found.length > 0 ? found : [cat, to];
  return {
    ...cat,
    y: 0,
    stop,
    phase: "walk",
    path: {
      waypoints: points.map((p) => ({ x: p.x, y: p.z })),
      currentIndex: 0,
      progress: 0,
    },
    hop: null,
    since: input.now,
  };
}

/** Leave for ``stop``: down off its perch first, if it is up on one. */
function leaveFor(cat: OfficeCat, stop: CatStopId, input: CatInput): OfficeCat {
  if (cat.y > 0) {
    const down = CAT_STOPS[cat.stop].floor;
    return {
      ...cat,
      stop,
      phase: "hopDown",
      path: null,
      hop: { from: { ...cat }, to: { ...down, facing: cat.facing } },
      since: input.now,
    };
  }
  return walkTo(cat, stop, input);
}

/** Where it wants to be now, if not where it is going. */
function calledAway(cat: OfficeCat, input: CatInput): CatStopId | null {
  if (input.napping) return cat.stop === "keyboard" ? null : "keyboard";
  if (cat.stop === "keyboard")
    return nextStop("keyboard", input.claudeSeated, input.random);
  if (cat.stop === "claude" && !input.claudeSeated) {
    return nextStop("claude", false, input.random);
  }
  return null;
}

function hopAlong(cat: OfficeCat, input: CatInput): OfficeCat {
  const hop = cat.hop;
  if (!hop) return cat;
  const t = Math.min(1, (input.now - cat.since) / CAT_HOP_MS);
  const at = {
    x: hop.from.x + (hop.to.x - hop.from.x) * t,
    z: hop.from.z + (hop.to.z - hop.from.z) * t,
    y: hop.from.y + (hop.to.y - hop.from.y) * t + 0.35 * Math.sin(Math.PI * t),
  };
  if (t < 1) return { ...cat, ...at };
  if (cat.phase === "hopDown") {
    return walkTo({ ...cat, ...hop.to }, cat.stop, input);
  }
  return {
    ...cat,
    ...hop.to,
    phase: "stay",
    hop: null,
    since: input.now,
    until: stayFor(cat.stop, input.now, input.random),
  };
}

function walkAlong(cat: OfficeCat, input: CatInput): OfficeCat {
  if (!cat.path) return cat;
  const step = advanceAlongPath(cat.path, CAT_WALK_SPEED * input.dt);
  const { floor, perch } = CAT_STOPS[cat.stop];
  if (step.arrived) {
    const there = { ...cat, ...floor, path: null, since: input.now };
    if (perch) {
      return {
        ...there,
        phase: "hopUp",
        hop: {
          from: { ...floor, facing: towardsPoint(floor, perch) },
          to: perch,
        },
        facing: towardsPoint(floor, perch),
      };
    }
    return {
      ...there,
      phase: "stay",
      until: stayFor(cat.stop, input.now, input.random),
    };
  }
  const x = step.position.x;
  const z = step.position.y;
  const moved = x !== cat.x || z !== cat.z;
  return {
    ...cat,
    x,
    z,
    facing: moved ? towardsPoint(cat, { x, z }) : cat.facing,
    path: step.path,
  };
}

/** Move the cat on by ``input.dt``. */
export function stepOfficeCat(cat: OfficeCat, input: CatInput): OfficeCat {
  const away = cat.phase === "hopDown" ? null : calledAway(cat, input);
  if (away) {
    // Settled at a rest it wakes with a stretch; anything else it drops.
    if (cat.phase === "stay" && RESTS.has(CAT_STOPS[cat.stop].act)) {
      return { ...cat, phase: "stretch", since: input.now, until: input.now };
    }
    if (cat.phase !== "stretch" && cat.phase !== "hopUp") {
      return leaveFor(cat, away, input);
    }
  }
  switch (cat.phase) {
    case "walk":
      return walkAlong(cat, input);
    case "hopUp":
    case "hopDown":
      return hopAlong(cat, input);
    case "stretch":
      if (input.now - cat.since < CAT_STRETCH_MS) return cat;
      return leaveFor(
        cat,
        away ?? nextStop(cat.stop, input.claudeSeated, input.random),
        input,
      );
    case "stay":
      if (input.now < cat.until || cat.stop === "keyboard") return cat;
      if (RESTS.has(CAT_STOPS[cat.stop].act)) {
        return { ...cat, phase: "stretch", since: input.now };
      }
      return leaveFor(
        cat,
        nextStop(cat.stop, input.claudeSeated, input.random),
        input,
      );
  }
}

/** What it is doing, for posing it. */
export function catActOf(cat: OfficeCat): CatAct | "walk" | "hop" | "stretch" {
  switch (cat.phase) {
    case "walk":
      return "walk";
    case "hopUp":
    case "hopDown":
      return "hop";
    case "stretch":
      return "stretch";
    case "stay":
      return CAT_STOPS[cat.stop].act;
  }
}
