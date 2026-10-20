/**
 * Boss errand choreography (systems/bossErrands.ts) against the movement
 * rules in docs/plan/spec.md "동선 규칙". A straight-line path finder keeps
 * the timing arithmetic readable: distance / BOSS_ERRAND_SPEED seconds.
 */

import { describe, expect, it } from "vitest";
import {
  BOSS_ERRAND_SPEED,
  BOSS_ERRAND_SPOTS,
  ERRAND_LINGER_MS,
  stepBossErrand,
  type BossErrandInput,
  type ErrandPathFinder,
} from "@/systems/bossErrands";
import { initialBossErrandState } from "@/stores/slices/shared";
import type { BossErrandState } from "@/stores/slices/types";
import type { Activity, Position } from "@/types";

const DESK: Position = { x: 640, y: 900 };
const straight: ErrandPathFinder = (from, to) => [from, to];
const unreachable: ErrandPathFinder = (from) => [from];

const TICK = 1 / 60;

interface Sim {
  state: BossErrandState;
  now: number;
  satCount: number;
}

function sim(): Sim {
  return { state: initialBossErrandState, now: 0, satCount: 0 };
}

/** Run ticks for `seconds` with fixed inputs. */
function run(
  s: Sim,
  seconds: number,
  inputs: Partial<Omit<BossErrandInput, "now" | "deltaSeconds">> = {},
  findPath: ErrandPathFinder = straight,
): Sim {
  const ticks = Math.round(seconds / TICK);
  for (let i = 0; i < ticks; i++) {
    s.now += TICK * 1000;
    const step = stepBossErrand(
      s.state,
      {
        activity: null,
        deskDuty: false,
        isCompacting: false,
        ...inputs,
        now: s.now,
        deltaSeconds: TICK,
      },
      DESK,
      findPath,
    );
    s.state = step.state;
    if (step.sat) s.satCount++;
  }
  return s;
}

const walkSeconds = (to: Position, from: Position = DESK) =>
  Math.hypot(to.x - from.x, to.y - from.y) / BOSS_ERRAND_SPEED;

const reading: { activity: Activity } = { activity: "reading" };
const running: { activity: Activity } = { activity: "running" };

describe("stepBossErrand", () => {
  it("walks to the archive while reading and works at the spot", () => {
    const s = run(sim(), 0.1, reading);
    expect(s.state.phase).toBe("walking");
    expect(s.state.room).toBe("archive");

    run(s, walkSeconds(BOSS_ERRAND_SPOTS.archive), reading);
    expect(s.state.phase).toBe("working");
    expect(s.state.position).toEqual(BOSS_ERRAND_SPOTS.archive);
  });

  it("lingers after the tool ends, then walks back and sits down", () => {
    const s = run(sim(), walkSeconds(BOSS_ERRAND_SPOTS.archive) + 0.2, reading);
    expect(s.state.phase).toBe("working");

    run(s, ERRAND_LINGER_MS / 1000 - 0.2);
    expect(s.state.phase).toBe("working");

    run(s, 0.4);
    expect(s.state.phase).toBe("returning");

    run(s, walkSeconds(BOSS_ERRAND_SPOTS.archive) + 0.2);
    expect(s.state.phase).toBe("seated");
    expect(s.state.position).toEqual(DESK);
    expect(s.satCount).toBe(1);
  });

  it("stays in the archive across back-to-back reads", () => {
    const s = run(sim(), walkSeconds(BOSS_ERRAND_SPOTS.archive) + 0.2, reading);
    for (let i = 0; i < 4; i++) {
      run(s, 0.5); // gap between two Read calls
      run(s, 1.0, reading);
      expect(s.state.phase).toBe("working");
    }
    expect(s.satCount).toBe(0);
  });

  it("goes straight from the archive to the server room when a command starts", () => {
    const s = run(sim(), walkSeconds(BOSS_ERRAND_SPOTS.archive) + 0.2, reading);
    run(s, 0.1, running);
    expect(s.state.phase).toBe("walking");
    expect(s.state.room).toBe("server");
    expect(s.state.path?.waypoints[0]).toEqual(BOSS_ERRAND_SPOTS.archive);

    run(
      s,
      walkSeconds(BOSS_ERRAND_SPOTS.server, BOSS_ERRAND_SPOTS.archive),
      running,
    );
    expect(s.state.phase).toBe("working");
    expect(s.state.position).toEqual(BOSS_ERRAND_SPOTS.server);
    expect(s.satCount).toBe(0);
  });

  it("retargets mid-walk", () => {
    const s = run(sim(), 0.5, reading);
    const midWalk = s.state.position;
    run(s, TICK, running);
    expect(s.state.room).toBe("server");
    expect(s.state.path?.waypoints[0]).toEqual(midWalk);
  });

  it("finishes the trip for a tool that ends before arrival", () => {
    const s = run(sim(), 0.2, reading); // a fast Read
    run(s, walkSeconds(BOSS_ERRAND_SPOTS.archive));
    expect(s.state.phase).toBe("working");
    run(s, ERRAND_LINGER_MS / 1000 - 0.2);
    expect(s.state.phase).toBe("working");
  });

  it("comes back to the desk for queued agents even while reading", () => {
    const s = run(sim(), walkSeconds(BOSS_ERRAND_SPOTS.archive) + 0.2, reading);
    run(s, 0.1, { ...reading, deskDuty: true });
    expect(s.state.phase).toBe("returning");
    run(s, walkSeconds(BOSS_ERRAND_SPOTS.archive) + 0.2, {
      ...reading,
      deskDuty: true,
    });
    expect(s.state.phase).toBe("seated");
    expect(s.satCount).toBe(1);
  });

  it("drops the errand when compaction starts", () => {
    const s = run(sim(), 0.5, reading);
    run(s, TICK, { ...reading, isCompacting: true });
    expect(s.state).toEqual(initialBossErrandState);
  });

  it("does not move toward an unreachable room", () => {
    const s = run(sim(), 0.5, reading, unreachable);
    expect(s.state.phase).toBe("working");
    expect(s.state.position).toEqual(DESK);
  });
});
