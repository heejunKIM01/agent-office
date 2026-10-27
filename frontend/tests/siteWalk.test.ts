import { describe, expect, it } from "vitest";
import { BUILDING, MAX_FLOORS, WORK_SPOTS } from "@/constants/sitePlan";
import {
  clearOfBuilding,
  floorsFor,
  routeTo,
  stepWalk,
  type Point,
} from "@/systems/siteWalk";

describe("routeTo", () => {
  it("walks straight when the building is not in the way", () => {
    const from = WORK_SPOTS.plans[0];
    const to = WORK_SPOTS.yard[0];
    expect(routeTo(from, to)).toEqual([to]);
  });

  it("goes round the front of the building to reach the rest area", () => {
    const from = WORK_SPOTS.yard[0];
    const to = WORK_SPOTS.rest[0];
    expect(clearOfBuilding(from, to)).toBe(false);
    const way = routeTo(from, to);
    expect(way[way.length - 1]).toEqual(to);
    expect(way.length).toBeGreaterThan(1);
    let at: Point = from;
    for (const p of way) {
      expect(clearOfBuilding(at, p)).toBe(true);
      at = p;
    }
  });

  it("finds a clear way from every work spot to every other", () => {
    const spots = Object.values(WORK_SPOTS).flat();
    for (const a of spots) {
      for (const b of spots) {
        let at: Point = a;
        for (const p of routeTo(a, b)) {
          expect(clearOfBuilding(at, p, 0.5)).toBe(true);
          at = p;
        }
      }
    }
  });
});

describe("stepWalk", () => {
  it("walks along the path, facing the way it goes, and stops at the end", () => {
    const start = {
      x: 0,
      z: 0,
      facing: 0,
      path: [
        { x: 4, z: 0 },
        { x: 4, z: 4 },
      ],
    };
    const half = stepWalk(start, 1, 2);
    expect(half).toMatchObject({ x: 2, z: 0 });
    expect(half.facing).toBeCloseTo(Math.PI / 2);
    const turned = stepWalk(half, 2, 2);
    expect(turned).toMatchObject({ x: 4, z: 2 });
    expect(turned.facing).toBeCloseTo(0);
    const done = stepWalk(turned, 10, 2);
    expect(done).toMatchObject({ x: 4, z: 4, path: [] });
  });
});

describe("floorsFor", () => {
  it("adds a floor a commit on top of the ground floor, up to the top", () => {
    expect(floorsFor(0)).toBe(1);
    expect(floorsFor(3)).toBe(4);
    expect(floorsFor(100)).toBe(MAX_FLOORS);
    expect(BUILDING.w).toBeGreaterThan(0);
  });
});
