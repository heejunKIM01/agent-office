import { describe, expect, it } from "vitest";
import { MAX_TANK, speciesFor, tally, tankFor } from "@/systems/fishingCatch";

describe("speciesFor", () => {
  it("catches bigger fish the more commits there are", () => {
    expect([1, 3, 4, 6, 7, 9, 10, 40].map(speciesFor)).toEqual([
      "crucian",
      "crucian",
      "carp",
      "carp",
      "mirror",
      "mirror",
      "trophy",
      "trophy",
    ]);
  });
});

describe("tankFor", () => {
  it("holds a fish a commit, the latest dozen once it is full", () => {
    expect(tankFor(0)).toEqual([]);
    expect(tankFor(4)).toEqual(["crucian", "crucian", "crucian", "carp"]);
    const full = tankFor(15);
    expect(full).toHaveLength(MAX_TANK);
    expect(full[0]).toBe("carp"); // the 4th commit
    expect(full[full.length - 1]).toBe("trophy");
  });
});

describe("tally", () => {
  it("counts every fish caught by kind", () => {
    expect(tally(11)).toEqual({ crucian: 3, carp: 3, mirror: 3, trophy: 2 });
    expect(tally(0)).toEqual({ crucian: 0, carp: 0, mirror: 0, trophy: 0 });
  });
});
