import { describe, expect, it } from "vitest";
import { findFloorPath, isFloorWalkable } from "@/systems/isoNavGrid";
import {
  CAT_HOP_MS,
  CAT_STOPS,
  CAT_STRETCH_MS,
  STROLL_STOPS,
  catActOf,
  catAt,
  nextStop,
  stepOfficeCat,
  type CatInput,
  type CatStopId,
  type OfficeCat,
} from "@/systems/officeCat";

const STOPS = Object.keys(CAT_STOPS) as CatStopId[];

/** Dice that always roll ``n`` (0 picks the first choice and the shortest stay). */
const always = (n: number) => () => n;

const input = (now: number, over: Partial<CatInput> = {}): CatInput => ({
  now,
  dt: 0.1,
  napping: false,
  claudeSeated: false,
  random: always(0),
  findPath: findFloorPath,
  ...over,
});

/** Step the cat every 100 ms until ``done`` or a minute passes; the time it took. */
function run(
  cat: OfficeCat,
  from: number,
  done: (cat: OfficeCat) => boolean,
  over: Partial<CatInput> = {},
): { cat: OfficeCat; now: number } {
  let now = from;
  while (!done(cat) && now < from + 60_000) {
    now += 100;
    cat = stepOfficeCat(cat, input(now, over));
  }
  return { cat, now };
}

describe("the office cat's spots", () => {
  it("can walk from every spot to every other", () => {
    for (const stop of STOPS) {
      expect(isFloorWalkable(CAT_STOPS[stop].floor), stop).toBe(true);
    }
    for (const from of STOPS) {
      for (const to of STOPS) {
        if (from === to) continue;
        const path = findFloorPath(CAT_STOPS[from].floor, CAT_STOPS[to].floor);
        expect(path.length, `${from} → ${to}`).toBeGreaterThan(0);
      }
    }
  });

  it("strolls somewhere else, and to Claude only while Claude sits at its desk", () => {
    for (const from of STROLL_STOPS) {
      for (const roll of [0, 0.3, 0.6, 0.99]) {
        expect(nextStop(from, false, always(roll))).not.toBe(from);
        expect(nextStop(from, false, always(roll))).not.toBe("claude");
        expect(nextStop(from, true, always(roll))).not.toBe("keyboard");
      }
    }
    expect(
      STROLL_STOPS.map((_, i, all) =>
        nextStop("tower", true, always(i / all.length)),
      ),
    ).toContain("claude");
  });
});

describe("stepOfficeCat", () => {
  it("wakes from its nap on the tower with a stretch, hops down and walks off", () => {
    let cat = catAt("tower", 0, always(0));
    expect(catActOf(cat)).toBe("sleep");
    expect(cat.y).toBeGreaterThan(1);
    const awake = run(cat, 0, (c) => c.phase !== "stay");
    expect(awake.cat.phase).toBe("stretch");
    expect(awake.now).toBe(CAT_STOPS.tower.stay[0]);
    cat = stepOfficeCat(awake.cat, input(awake.now + CAT_STRETCH_MS));
    expect(cat.phase).toBe("hopDown");
    expect(cat.stop).toBe("sofa");
    cat = stepOfficeCat(cat, input(awake.now + CAT_STRETCH_MS + CAT_HOP_MS));
    expect(cat).toMatchObject({ phase: "walk", y: 0 });
  });

  it("walks to its next spot, hops up there and settles", () => {
    const start = catAt("bowl", 0, always(0));
    const { cat } = run(
      start,
      0,
      (c) => c.phase === "stay" && c.stop === "tower",
    );
    expect(cat.stop).toBe("tower");
    expect(cat).toMatchObject(CAT_STOPS.tower.perch!);
    expect(catActOf(cat)).toBe("sleep");
  });

  it("does not stretch after eating", () => {
    const { cat } = run(
      catAt("bowl", 0, always(0)),
      0,
      (c) => c.phase !== "stay",
    );
    expect(cat.phase).toBe("walk");
  });

  it("heads for my keyboard when Claude has waited on me, even mid-walk", () => {
    const walking = run(
      catAt("bowl", 0, always(0)),
      0,
      (c) => c.phase === "walk",
    );
    let cat = stepOfficeCat(
      walking.cat,
      input(walking.now + 100, { napping: true }),
    );
    expect(cat).toMatchObject({ stop: "keyboard", phase: "walk" });
    const there = run(cat, walking.now + 100, (c) => c.phase === "stay", {
      napping: true,
    });
    expect(there.cat).toMatchObject(CAT_STOPS.keyboard.perch!);
    expect(catActOf(there.cat)).toBe("keyboard");
    // It stays as long as I keep Claude waiting.
    cat = stepOfficeCat(
      there.cat,
      input(there.now + 600_000, { napping: true }),
    );
    expect(cat.phase).toBe("stay");
    // I type: it stretches, hops down and strolls off.
    cat = stepOfficeCat(cat, input(there.now + 600_100));
    expect(cat.phase).toBe("stretch");
    cat = stepOfficeCat(cat, input(there.now + 600_100 + CAT_STRETCH_MS));
    expect(cat.phase).toBe("hopDown");
    expect(cat.stop).not.toBe("keyboard");
  });

  it("leaves a perch it is not resting on at once for my keyboard", () => {
    const cat = stepOfficeCat(
      catAt("library", 0, always(0)),
      input(100, { napping: true }),
    );
    expect(cat).toMatchObject({ phase: "hopDown", stop: "keyboard" });
  });

  it("stops rubbing Claude's legs when Claude gets up", () => {
    const rubbing = catAt("claude", 0, always(0));
    expect(catActOf(rubbing)).toBe("rub");
    expect(
      stepOfficeCat(rubbing, input(100, { claudeSeated: true })).phase,
    ).toBe("stay");
    const left = stepOfficeCat(rubbing, input(100));
    expect(left.phase).toBe("walk");
    expect(left.stop).not.toBe("claude");
  });
});
