import { describe, expect, it } from "vitest";
import {
  ENTRANCE_INSIDE,
  GUEST_SPOT,
  WAYPOINTS,
  WORK_SPOTS,
} from "@/constants/fishingPlan";
import { canStand, clearWalk, routeTo } from "@/systems/fishingWalk";
import type { Point } from "@/systems/placeWalk";

const spots = Object.values(WORK_SPOTS).flat();

/** Each leg of the way from ``a`` stays on dry ground, and it ends at ``b``. */
function expectClearWay(a: Point, b: Point): void {
  const way = routeTo(a, b);
  expect(way[way.length - 1]).toEqual(b);
  let at = a;
  for (const p of way) {
    expect(clearWalk(at, p)).toBe(true);
    at = p;
  }
}

describe("canStand", () => {
  it("has room for everyone at every spot and turning point", () => {
    for (const p of [...spots, ...WAYPOINTS]) expect(canStand(p)).toBe(true);
  });

  it("keeps people out of the water, the office and the cabins", () => {
    expect(canStand({ x: 30, z: 20 })).toBe(false); // the reservoir
    expect(canStand({ x: 61, z: 20 })).toBe(false); // the embankment
    expect(canStand({ x: 8, z: 39 })).toBe(false); // the office
    expect(canStand({ x: 46.5, z: 23 })).toBe(false); // my hut's cabin
    expect(canStand(GUEST_SPOT)).toBe(true); // my hut's front
  });
});

describe("routeTo", () => {
  it("walks straight along the deck when nothing is in the way", () => {
    const from = WORK_SPOTS.seats[0];
    const to = WORK_SPOTS.seats[4];
    expect(routeTo(from, to)).toEqual([to]);
  });

  it("goes back to the bank and along the pontoon to reach a hut", () => {
    const from = WORK_SPOTS.seats[0];
    const to = WORK_SPOTS.seats[5];
    expect(clearWalk(from, to)).toBe(false);
    expect(routeTo(from, to).length).toBeGreaterThan(2);
    expectClearWay(from, to);
  });

  it("finds a dry way from every spot to every other, and to the entrance", () => {
    for (const a of [...spots, ENTRANCE_INSIDE]) {
      for (const b of [...spots, ENTRANCE_INSIDE]) expectClearWay(a, b);
    }
  });

  it("stands the places at a spot apart along the screen's width", () => {
    // The camera looks along the diagonal, so x − z is where on screen.
    for (const places of Object.values(WORK_SPOTS)) {
      const across = places.map((p) => p.x - p.z).sort((a, b) => a - b);
      for (let i = 1; i < across.length; i++)
        expect(across[i] - across[i - 1]).toBeGreaterThanOrEqual(1);
    }
  });
});
