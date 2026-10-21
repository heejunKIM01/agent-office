/**
 * Errands in the isometric office (docs/plan/spec.md 동선 규칙): a person
 * walks to the room of the tool it is running and works there (rule 1),
 * stays ERRAND_LINGER_MS after the tool ends, finishing the walk first
 * (rule 2), turns at once when another tool starts, even mid-walk (rule 3),
 * and otherwise walks back to its seat and sits down (rule 4). Editing is
 * done at its own desk. A stuck person (a failed tool) does not move until
 * it moves on (rule 7).
 *
 * `stepIsoWalker` is pure: the path finder and the spot a walker holds in a
 * room are passed in.
 */

import type { Activity } from "@/types";
import type { PathState } from "@/stores/slices/types";
import type { ErrandRoomId, IsoSpot } from "@/constants/isoFloorPlan";
import { ERRAND_LINGER_MS } from "./bossErrands";
import type { FloorPoint } from "./isoNavGrid";
import { advanceAlongPath } from "./pathFollow";

/** Where each activity sends a person (spec 「방 ↔ 도구」); editing stays at its desk. */
export const ROOM_FOR_ACTIVITY: Record<Activity, ErrandRoomId | "seat"> = {
  reading: "library",
  editing: "seat",
  running: "server",
  browsing: "search",
  planning: "meeting",
  asking: "mydesk",
};

/** Walking speed in metres per second. */
export const ISO_WALK_SPEED = 3.2;

/** Sitting idle, typing at the desk, walking, or working in a room. */
export type IsoPose = "sit" | "type" | "walk" | "work";

export interface IsoWalker {
  x: number;
  z: number;
  facing: number;
  /** Where it is heading or staying. */
  goal: "seat" | ErrandRoomId;
  /** Waypoints in metres (x, y = z) while walking. */
  path: PathState | null;
  pose: IsoPose;
  /** Set when its tool has ended: it stays in the room until then. */
  lingerUntil: number | null;
}

export interface IsoWalkerInput {
  activity: Activity | null;
  /** A failed tool: it stays where it is until it moves on. */
  stuck: boolean;
  seat: IsoSpot;
  /** The spot this walker holds in a room. */
  spotIn: (room: ErrandRoomId) => IsoSpot;
  findPath: (from: FloorPoint, to: FloorPoint) => FloorPoint[];
  /** Milliseconds, the clock lingering is measured with. */
  now: number;
  /** Seconds since the last step. */
  dt: number;
}

/** A walker sitting in its seat. */
export function seatedWalker(seat: IsoSpot): IsoWalker {
  return {
    x: seat.x,
    z: seat.z,
    facing: seat.facing,
    goal: "seat",
    path: null,
    pose: "sit",
    lingerUntil: null,
  };
}

function spotFor(walker: IsoWalker, input: IsoWalkerInput): IsoSpot {
  return walker.goal === "seat" ? input.seat : input.spotIn(walker.goal);
}

/** How it looks once it is where it was going. */
function restingPose(walker: IsoWalker, input: IsoWalkerInput): IsoPose {
  if (walker.goal !== "seat") return "work";
  return input.activity === "editing" ? "type" : "sit";
}

function headTo(
  walker: IsoWalker,
  goal: IsoWalker["goal"],
  input: IsoWalkerInput,
): IsoWalker {
  const turned = { ...walker, goal, lingerUntil: null };
  const spot = spotFor(turned, input);
  const points = input.findPath({ x: walker.x, z: walker.z }, spot);
  // No way through (should not happen on this floor): step straight there.
  const route =
    points.length > 1 ? points : [{ x: walker.x, z: walker.z }, spot];
  return {
    ...turned,
    pose: "walk",
    path: {
      waypoints: route.map((p) => ({ x: p.x, y: p.z })),
      currentIndex: 0,
      progress: 0,
    },
  };
}

function advance(walker: IsoWalker, input: IsoWalkerInput): IsoWalker {
  if (!walker.path) {
    const pose = restingPose(walker, input);
    return pose === walker.pose ? walker : { ...walker, pose };
  }
  const step = advanceAlongPath(walker.path, ISO_WALK_SPEED * input.dt);
  if (step.arrived) {
    const spot = spotFor(walker, input);
    const arrived = {
      ...walker,
      x: spot.x,
      z: spot.z,
      facing: spot.facing,
      path: null,
    };
    return { ...arrived, pose: restingPose(arrived, input) };
  }
  const x = step.position.x;
  const z = step.position.y;
  const dx = x - walker.x;
  const dz = z - walker.z;
  return {
    ...walker,
    x,
    z,
    facing: dx !== 0 || dz !== 0 ? Math.atan2(dx, dz) : walker.facing,
    path: step.path,
  };
}

/** Move a walker one frame along the rules. */
export function stepIsoWalker(
  walker: IsoWalker,
  input: IsoWalkerInput,
): IsoWalker {
  if (input.stuck) return advance({ ...walker, lingerUntil: null }, input);
  const wanted = input.activity ? ROOM_FOR_ACTIVITY[input.activity] : null;
  let next = walker;
  if (wanted) {
    next =
      next.goal === wanted
        ? { ...next, lingerUntil: null }
        : headTo(next, wanted, input);
  } else if (next.goal !== "seat" && !next.path) {
    if (next.lingerUntil === null) {
      next = { ...next, lingerUntil: input.now + ERRAND_LINGER_MS };
    } else if (input.now >= next.lingerUntil) {
      next = headTo(next, "seat", input);
    }
  }
  return advance(next, input);
}
