import { describe, expect, it } from "vitest";
import { findFloorPath, isFloorWalkable } from "@/systems/isoNavGrid";
import {
  CAT_DASH_SPEED,
  CAT_SPOTS,
  catAt,
  catChoices,
  stepOfficeCat,
  type CatInput,
  type OfficeCat,
} from "@/systems/officeCat";
import {
  PET_STRETCH_MS,
  petActOf,
  type PetSighting,
} from "@/systems/officePets";

const SPOTS = Object.values(CAT_SPOTS);

/** Dice that roll ``rolls`` over and over. */
const dice = (...rolls: number[]) => {
  let i = 0;
  return () => rolls[i++ % rolls.length];
};

const input = (now: number, over: Partial<CatInput> = {}): CatInput => ({
  now,
  dt: 0.1,
  napping: false,
  claude: null,
  dog: null,
  // Never roams: picks the middle spot and stays half as long as it might.
  random: dice(0.5),
  findPath: findFloorPath,
  walkable: isFloorWalkable,
  ...over,
});

/** Step the cat every 100 ms until ``done`` or two minutes pass; the time it took. */
function run(
  cat: OfficeCat,
  from: number,
  done: (cat: OfficeCat) => boolean,
  over: Partial<CatInput> = {},
): { cat: OfficeCat; now: number } {
  let now = from;
  while (!done(cat) && now < from + 120_000) {
    now += 100;
    cat = stepOfficeCat(cat, input(now, over));
  }
  return { cat, now };
}

const SEATED = { x: 14.3, z: 9.6, seated: true, working: false };
const DOG_ASLEEP: PetSighting = {
  x: 4.6,
  y: 0,
  z: 30,
  planId: "bed",
  phase: "stay",
};

describe("the office cat's spots", () => {
  it("can walk from every spot to every other", () => {
    for (const spot of SPOTS) {
      expect(isFloorWalkable(spot.floor), spot.id).toBe(true);
    }
    for (const from of SPOTS) {
      for (const to of SPOTS) {
        if (from === to) continue;
        const path = findFloorPath(from.floor, to.floor);
        expect(path.length, `${from.id} → ${to.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("goes somewhere else, to Claude only while Claude sits and onto the dog only while it sleeps", () => {
    expect(catChoices("tower", { claude: null, dog: null })).not.toContain(
      "tower",
    );
    const alone = catChoices("sofa", { claude: null, dog: null });
    expect(alone).not.toContain("claude");
    expect(alone).not.toContain("snuggle");
    expect(alone).not.toContain("keyboard");
    const company = catChoices("sofa", { claude: SEATED, dog: DOG_ASLEEP });
    expect(company).toContain("claude");
    expect(company).toContain("snuggle");
    const dogAwake = { ...DOG_ASLEEP, phase: "stretch" as const };
    expect(catChoices("sofa", { claude: null, dog: dogAwake })).not.toContain(
      "snuggle",
    );
  });
});

describe("stepOfficeCat", () => {
  it("wakes from its nap on the tower with a stretch, hops down and walks off", () => {
    let cat = catAt("tower", 0, dice(0.5));
    expect(petActOf(cat)).toBe("sleep");
    expect(cat.y).toBeGreaterThan(1);
    const awake = run(cat, 0, (c) => c.phase !== "stay");
    expect(awake.cat.phase).toBe("stretch");
    expect(awake.now).toBe(35_000);
    cat = stepOfficeCat(awake.cat, input(awake.now + PET_STRETCH_MS));
    expect(cat.phase).toBe("hopDown");
    expect(cat.plan.id).not.toBe("tower");
    const down = run(
      cat,
      awake.now + PET_STRETCH_MS,
      (c) => c.phase !== "hopDown",
    );
    expect(down.cat).toMatchObject({ phase: "walk", y: 0 });
  });

  it("walks to its next spot, hops up there and settles", () => {
    const start = { ...catAt("bowl", 0, dice(0.5)), until: 0 };
    const { cat } = run(
      start,
      0,
      (c) => c.phase === "stay" && c.plan.id !== "bowl",
    );
    expect(cat.y).toBe(cat.plan.perch?.y ?? 0);
    expect(cat.x).toBeCloseTo((cat.plan.perch ?? cat.plan.floor).x);
  });

  it("does not stretch after eating", () => {
    const { cat } = run(
      { ...catAt("bowl", 0, dice(0.5)), until: 0 },
      0,
      (c) => c.phase !== "stay",
    );
    expect(cat.phase).toBe("walk");
  });

  it("roams the open floor now and then, at a dash", () => {
    // Roam, to the middle of the floor, at a dash.
    const roll = dice(0, 0.5, 0.5, 0);
    const cat = stepOfficeCat(
      { ...catAt("bowl", 0, dice(0.5)), until: 0 },
      input(100, { random: roll }),
    );
    expect(cat.plan).toMatchObject({
      id: "roam",
      act: "look",
      speed: CAT_DASH_SPEED,
    });
    expect(cat.plan.floor).toMatchObject({ x: 20, z: 15.5 });
    expect(petActOf(cat)).toBe("run");
  });

  it("heads for my keyboard when Claude has waited on me, even mid-walk", () => {
    const walking = run(
      { ...catAt("bowl", 0, dice(0.5)), until: 0 },
      0,
      (c) => c.phase === "walk",
    );
    let cat = stepOfficeCat(
      walking.cat,
      input(walking.now + 100, { napping: true }),
    );
    expect(cat).toMatchObject({ phase: "walk" });
    expect(cat.plan.id).toBe("keyboard");
    const there = run(cat, walking.now + 100, (c) => c.phase === "stay", {
      napping: true,
    });
    expect(there.cat).toMatchObject(CAT_SPOTS.keyboard.perch!);
    expect(petActOf(there.cat)).toBe("keyboard");
    // It stays as long as I keep Claude waiting.
    cat = stepOfficeCat(
      there.cat,
      input(there.now + 600_000, { napping: true }),
    );
    expect(cat.phase).toBe("stay");
    // I type: it stretches, hops down and strolls off.
    cat = stepOfficeCat(cat, input(there.now + 600_100));
    expect(cat.phase).toBe("stretch");
    cat = stepOfficeCat(cat, input(there.now + 600_100 + PET_STRETCH_MS));
    expect(cat.phase).toBe("hopDown");
    expect(cat.plan.id).not.toBe("keyboard");
  });

  it("leaves a perch it is not resting on at once for my keyboard", () => {
    const cat = stepOfficeCat(
      catAt("library", 0, dice(0.5)),
      input(100, { napping: true }),
    );
    expect(cat.phase).toBe("hopDown");
    expect(cat.plan.id).toBe("keyboard");
  });

  it("stops rubbing Claude's legs when Claude gets up", () => {
    const rubbing = catAt("claude", 0, dice(0.5));
    expect(petActOf(rubbing)).toBe("rub");
    expect(stepOfficeCat(rubbing, input(100, { claude: SEATED })).phase).toBe(
      "stay",
    );
    const left = stepOfficeCat(rubbing, input(100));
    expect(left.phase).toBe("walk");
    expect(left.plan.id).not.toBe("claude");
  });

  it("curls up on the sleeping dog's back and gets off when the dog wakes", () => {
    const curled = catAt("snuggle", 0, dice(0.5));
    expect(curled.y).toBeGreaterThan(0);
    expect(stepOfficeCat(curled, input(100, { dog: DOG_ASLEEP })).phase).toBe(
      "stay",
    );
    const woken = { ...DOG_ASLEEP, phase: "stretch" as const };
    let cat = stepOfficeCat(curled, input(100, { dog: woken }));
    expect(cat.phase).toBe("stretch");
    cat = stepOfficeCat(cat, input(100 + PET_STRETCH_MS, { dog: woken }));
    expect(cat.phase).toBe("hopDown");
  });
});
