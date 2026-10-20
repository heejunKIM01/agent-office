/**
 * Boss Errands
 *
 * The boss walks to the archive while a reading tool runs and to the server
 * room while a shell command runs (docs/plan/spec.md R1, R2), driven by the
 * backend's `boss.activity`. Movement rules (spec "동선 규칙"):
 * 1. A new activity sends the boss to that room's spot; on arrival it works there.
 * 2. When the activity ends the boss still finishes the walk, then lingers
 *    ERRAND_LINGER_MS at the spot before leaving, so a fast tool still shows
 *    a visible errand and back-to-back reads do not cause round trips.
 * 3. A different activity retargets the walk immediately, even mid-walk.
 * 4. With nothing to do the boss walks back to the desk and sits down.
 * 5. Desk duty wins: agents queued for the boss (or a handoff in progress)
 *    call the boss back to the desk.
 * 6. Compaction owns the boss: an errand in progress is dropped and the
 *    compaction animation starts from the desk.
 *
 * `stepBossErrand` is pure (the path finder is injected) and is ticked from
 * the single animation loop in animationSystem.
 */

import type { Activity, Position } from "@/types";
import type { BossErrandState, ErrandRoom } from "@/stores/slices/types";
import { initialBossErrandState } from "@/stores/slices/shared";
import { ARCHIVE_READING_SPOTS, SERVER_RACK_SPOTS } from "@/constants/rooms";
import { advanceAlongPath } from "./pathFollow";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Boss walking speed on errands (agents walk at 200 px/s) */
export const BOSS_ERRAND_SPEED = 260;

/** How long the boss stays in a room after its tool ends (ms) */
export const ERRAND_LINGER_MS = 1500;

/** Where the boss stands in each room: the spot nearest the room's door */
export const BOSS_ERRAND_SPOTS: Record<ErrandRoom, Position> = {
  archive: ARCHIVE_READING_SPOTS[ARCHIVE_READING_SPOTS.length - 1],
  server: SERVER_RACK_SPOTS[0],
};

// ============================================================================
// TYPES
// ============================================================================

export interface BossErrandInput {
  /** Backend activity of the boss's current tool */
  activity: Activity | null;
  /** Agents are queued for the boss or a handoff is in progress */
  deskDuty: boolean;
  /** The compaction animation owns the boss */
  isCompacting: boolean;
  /** Current time (ms, same clock as lingerUntil) */
  now: number;
  /** Time since the previous step */
  deltaSeconds: number;
}

/** Waypoints from one position to another; fewer than 2 means unreachable */
export type ErrandPathFinder = (from: Position, to: Position) => Position[];

export interface BossErrandStep {
  state: BossErrandState;
  /** True when the boss sat back down at the desk in this step */
  sat: boolean;
}

// ============================================================================
// LOGIC
// ============================================================================

/** The room an activity sends the boss to */
export function errandRoomFor(activity: Activity | null): ErrandRoom | null {
  if (activity === "reading") return "archive";
  if (activity === "running") return "server";
  return null;
}

/** True while the boss is in (or heading to) a room rather than at the desk */
function isOnErrand(state: BossErrandState): boolean {
  return state.phase === "walking" || state.phase === "working";
}

/** Where the boss should be heading right now */
function destinationFor(
  state: BossErrandState,
  input: BossErrandInput,
): ErrandRoom | "desk" {
  if (input.deskDuty) return "desk";
  const room = errandRoomFor(input.activity);
  if (room) return room;
  if (!state.room) return "desk";
  // The activity ended: finish the walk, then linger at the spot.
  if (state.phase === "walking") return state.room;
  if (
    state.phase === "working" &&
    state.lingerUntil !== null &&
    input.now < state.lingerUntil
  ) {
    return state.room;
  }
  return "desk";
}

/** Start a walk toward `to`; an unreachable target yields no path */
function walk(
  state: BossErrandState,
  to: Position,
  findPath: ErrandPathFinder,
): BossErrandState["path"] {
  const waypoints = findPath(state.position, to);
  return waypoints.length > 1
    ? { waypoints, currentIndex: 0, progress: 0 }
    : null;
}

/**
 * Advance the boss errand by one animation tick.
 */
export function stepBossErrand(
  state: BossErrandState,
  input: BossErrandInput,
  deskPosition: Position,
  findPath: ErrandPathFinder,
): BossErrandStep {
  if (input.isCompacting) {
    return {
      state: state.phase === "seated" ? state : initialBossErrandState,
      sat: false,
    };
  }

  // Linger clock: starts once the boss is at the spot with no activity
  // left, and is cleared whenever an activity is running.
  let lingerUntil = state.lingerUntil;
  if (errandRoomFor(input.activity)) {
    lingerUntil = null;
  } else if (lingerUntil === null && state.phase === "working") {
    lingerUntil = input.now + ERRAND_LINGER_MS;
  }
  let next: BossErrandState =
    lingerUntil === state.lingerUntil ? state : { ...state, lingerUntil };

  const destination = destinationFor(next, input);

  if (destination === "desk") {
    if (next.phase === "seated") return { state: next, sat: false };
    if (next.phase !== "returning") {
      next = {
        ...next,
        phase: "returning",
        lingerUntil: null,
        path: walk(next, deskPosition, findPath),
      };
    }
  } else if (next.room !== destination || !isOnErrand(next)) {
    const from =
      next.phase === "seated" ? { ...next, position: deskPosition } : next;
    next = {
      ...from,
      phase: "walking",
      room: destination,
      path: walk(from, BOSS_ERRAND_SPOTS[destination], findPath),
    };
  }

  if (!next.path) {
    // Arrived earlier, or the target is unreachable: settle where we are.
    if (next.phase === "returning") {
      return { state: initialBossErrandState, sat: true };
    }
    if (next.phase === "walking")
      return { state: { ...next, phase: "working" }, sat: false };
    return { state: next, sat: false };
  }

  const step = advanceAlongPath(
    next.path,
    BOSS_ERRAND_SPEED * input.deltaSeconds,
  );
  if (!step.arrived) {
    return {
      state: { ...next, position: step.position, path: step.path },
      sat: false,
    };
  }
  if (next.phase === "returning") {
    return { state: initialBossErrandState, sat: true };
  }
  return {
    state: { ...next, phase: "working", position: step.position, path: null },
    sat: false,
  };
}
