/**
 * The construction site's machines, as plain numbers (설정 「장소」 · 건설
 * 현장): the excavator's dig cycle, a truck driving its legs forwards or
 * backing up, and how long the hoist takes. The scene
 * (components/iso/construction/siteMachines.ts) only draws these.
 */

import { HOIST_SPEED, type DriveLeg } from "@/constants/sitePlan";

/** One dig: down into the pit, scoop, up, swing, dump, back (s). */
export const DIG_CYCLE = 6;

/** The excavator's joints: the body's swing and the arm's three hinges. */
export interface DigPose {
  swing: number;
  boom: number;
  stick: number;
  bucket: number;
}

type Frame = [
  t: number,
  at: "dig" | "dump",
  boom: number,
  stick: number,
  bucket: number,
];

/**
 * Key frames of a dig. ``boom`` lifts the arm (negative raises it),
 * ``stick`` folds the forearm down, ``bucket`` curls the bucket in.
 */
const FRAMES: Frame[] = [
  [0, "dig", -0.55, 1.2, 0.2],
  [1.2, "dig", -0.05, 1.75, -0.5],
  [2.2, "dig", -0.15, 1.35, 1.1],
  [3.6, "dump", -0.7, 1.0, 1.1],
  [4.6, "dump", -0.65, 1.2, -0.7],
  [DIG_CYCLE, "dig", -0.55, 1.2, 0.2],
];

/** The bucket is full from the scoop to the dump. */
const SCOOP_AT = 2.2;
const DUMP_AT = 4.6;

/** The excavator at rest: arm folded, bucket down by the tracks. */
export const DIG_REST: Omit<DigPose, "swing"> = {
  boom: -0.35,
  stick: 1.9,
  bucket: 1.4,
};

const smooth = (t: number): number => t * t * (3 - 2 * t);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** The pose ``t`` seconds into a dig that swings between ``dig`` and ``dump`` angles. */
export function digPose(t: number, dig: number, dump: number): DigPose {
  const at = ((t % DIG_CYCLE) + DIG_CYCLE) % DIG_CYCLE;
  let i = 0;
  while (i < FRAMES.length - 2 && FRAMES[i + 1][0] <= at) i++;
  const [t0, s0, b0, k0, u0] = FRAMES[i];
  const [t1, s1, b1, k1, u1] = FRAMES[i + 1];
  const k = smooth((at - t0) / (t1 - t0));
  const from = s0 === "dig" ? dig : dump;
  const to = s1 === "dig" ? dig : dump;
  return {
    swing: from + wrap(to - from) * k,
    boom: b0 + (b1 - b0) * k,
    stick: k0 + (k1 - k0) * k,
    bucket: u0 + (u1 - u0) * k,
  };
}

/** Whether the bucket holds earth ``t`` seconds into a dig. */
export function carrying(t: number): boolean {
  const at = ((t % DIG_CYCLE) + DIG_CYCLE) % DIG_CYCLE;
  return at >= SCOOP_AT && at < DUMP_AT;
}

/** How many dumps a dig running from ``from`` to ``to`` seconds passes. */
export function dumpsBetween(from: number, to: number): number {
  const count = (t: number): number => Math.floor((t - DUMP_AT) / DIG_CYCLE);
  return Math.max(0, count(to) - count(from));
}

/** A truck on the move: where it is, which way its nose points, its legs to drive. */
export interface Vehicle {
  x: number;
  z: number;
  heading: number;
  legs: DriveLeg[];
}

export const TRUCK_SPEED = 4.2;
const TURN_RATE = 2.6;

/**
 * Drive ``speed * dt`` along the legs. Forwards the nose turns towards the
 * way it goes; backing up, the tail does. Returns a new vehicle.
 */
export function stepVehicle(
  vehicle: Vehicle,
  dt: number,
  speed = TRUCK_SPEED,
): Vehicle {
  let { x, z, heading } = vehicle;
  const legs = [...vehicle.legs];
  let left = speed * dt;
  while (left > 1e-9 && legs.length > 0) {
    const leg = legs[0];
    const dx = leg.x - x;
    const dz = leg.z - z;
    const distance = Math.hypot(dx, dz);
    if (distance < 1e-6) {
      legs.shift();
      continue;
    }
    const travel = Math.atan2(dx, dz);
    const want = leg.reverse ? travel + Math.PI : travel;
    const turn = wrap(want - heading);
    const most = TURN_RATE * dt;
    heading = wrap(heading + Math.max(-most, Math.min(most, turn)));
    const step = Math.min(left, distance);
    x += (dx / distance) * step;
    z += (dz / distance) * step;
    left -= step;
    if (step >= distance) legs.shift();
  }
  return { x, z, heading, legs };
}

/** How long the hoist takes to carry someone ``height`` metres (s). */
export function rideSeconds(height: number): number {
  return Math.abs(height) / HOIST_SPEED + 0.6;
}
