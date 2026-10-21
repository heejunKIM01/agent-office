import { describe, expect, it } from "vitest";
import type { Activity } from "@/types";
import type { ErrandRoomId, IsoSpot } from "@/constants/isoFloorPlan";
import { ERRAND_LINGER_MS } from "@/systems/bossErrands";
import {
  seatedWalker,
  stepIsoWalker,
  type IsoWalker,
} from "@/systems/isoErrands";
import type { FloorPoint } from "@/systems/isoNavGrid";

const SEAT: IsoSpot = { x: 0, z: 0, facing: Math.PI };
const SPOTS: Record<ErrandRoomId, IsoSpot> = {
  library: { x: 6.4, z: 0, facing: 0 },
  server: { x: 0, z: 6.4, facing: Math.PI / 2 },
  search: { x: 3.2, z: 3.2, facing: 0 },
  meeting: { x: -3.2, z: 0, facing: 0 },
  mydesk: { x: 0, z: -3.2, facing: 0 },
};
const straight = (from: FloorPoint, to: FloorPoint): FloorPoint[] => [from, to];

/** Run the walker for `seconds` in 0.1s steps starting at `start` ms. */
function run(
  walker: IsoWalker,
  activity: Activity | null,
  seconds: number,
  start = 0,
  stuck = false,
): { walker: IsoWalker; now: number } {
  let w = walker;
  let now = start;
  for (let i = 0; i < Math.round(seconds * 10); i++) {
    now += 100;
    w = stepIsoWalker(w, {
      activity,
      stuck,
      seat: SEAT,
      spotIn: (room) => SPOTS[room],
      findPath: straight,
      now,
      dt: 0.1,
    });
  }
  return { walker: w, now };
}

describe("iso errands", () => {
  it("walks to the library while reading and works there facing the shelf", () => {
    const { walker } = run(seatedWalker(SEAT), "reading", 3);
    expect(walker).toMatchObject({
      x: 6.4,
      z: 0,
      goal: "library",
      pose: "work",
      facing: 0,
    });
  });

  it.each([
    ["running", "server"],
    ["browsing", "search"],
    ["planning", "meeting"],
    ["asking", "mydesk"],
  ] as const)("sends %s to the %s", (activity, room) => {
    const { walker } = run(seatedWalker(SEAT), activity, 3);
    expect(walker).toMatchObject({
      x: SPOTS[room].x,
      z: SPOTS[room].z,
      goal: room,
      pose: "work",
    });
  });

  it("stays in the room for the linger time after the tool ends, then sits down again", () => {
    const working = run(seatedWalker(SEAT), "running", 3);
    const lingering = run(
      working.walker,
      null,
      (ERRAND_LINGER_MS - 200) / 1000,
      working.now,
    );
    expect(lingering.walker).toMatchObject({ goal: "server", pose: "work" });
    const back = run(lingering.walker, null, 3.5, lingering.now);
    expect(back.walker).toMatchObject({
      x: 0,
      z: 0,
      goal: "seat",
      pose: "sit",
      facing: Math.PI,
    });
  });

  it("finishes the walk when the tool ends on the way, then lingers", () => {
    const halfway = run(seatedWalker(SEAT), "reading", 1);
    expect(halfway.walker.pose).toBe("walk");
    const arrived = run(halfway.walker, null, 1.2, halfway.now);
    expect(arrived.walker).toMatchObject({
      x: 6.4,
      goal: "library",
      pose: "work",
    });
    expect(arrived.walker.lingerUntil).not.toBeNull();
  });

  it("turns at once towards another room when the next tool starts mid-walk", () => {
    const halfway = run(seatedWalker(SEAT), "reading", 1);
    const turned = run(halfway.walker, "running", 0.1, halfway.now);
    expect(turned.walker.goal).toBe("server");
    expect(turned.walker.path?.waypoints[0]).toEqual({
      x: halfway.walker.x,
      y: halfway.walker.z,
    });
  });

  it("a new tool for the same room cancels the linger", () => {
    const working = run(seatedWalker(SEAT), "reading", 3);
    const lingering = run(working.walker, null, 0.5, working.now);
    expect(lingering.walker.lingerUntil).not.toBeNull();
    const again = run(lingering.walker, "reading", 0.1, lingering.now);
    expect(again.walker).toMatchObject({
      goal: "library",
      pose: "work",
      lingerUntil: null,
    });
  });

  it("edits at its own desk: goes straight back without lingering and types", () => {
    const working = run(seatedWalker(SEAT), "reading", 3);
    const turned = run(working.walker, "editing", 0.1, working.now);
    expect(turned.walker).toMatchObject({ goal: "seat", lingerUntil: null });
    const typing = run(turned.walker, "editing", 3, turned.now);
    expect(typing.walker).toMatchObject({ x: 0, z: 0, pose: "type" });
    const idle = run(typing.walker, null, 0.2, typing.now);
    expect(idle.walker.pose).toBe("sit");
  });

  it("a stuck person stays where it is until it moves on", () => {
    const working = run(seatedWalker(SEAT), "reading", 3);
    const stuck = run(working.walker, null, 4, working.now, true);
    expect(stuck.walker).toMatchObject({
      x: 6.4,
      goal: "library",
      lingerUntil: null,
    });
    const movedOn = run(stuck.walker, "running", 4, stuck.now);
    expect(movedOn.walker).toMatchObject({ goal: "server", pose: "work" });
  });

  it("a person stuck on the way stops right there", () => {
    const halfway = run(seatedWalker(SEAT), "reading", 1);
    const stuck = run(halfway.walker, null, 2, halfway.now, true);
    expect(stuck.walker).toMatchObject({
      x: halfway.walker.x,
      z: halfway.walker.z,
      path: null,
      pose: "work",
    });
  });

  it("sits still with nothing to do", () => {
    const { walker } = run(seatedWalker(SEAT), null, 2);
    expect(walker).toEqual(seatedWalker(SEAT));
  });
});
