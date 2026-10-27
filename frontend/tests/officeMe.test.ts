import { describe, expect, it } from "vitest";
import { MY_SEAT } from "@/constants/isoFloorPlan";
import { findFloorPath, isFloorWalkable } from "@/systems/isoNavGrid";
import {
  catAt,
  stepOfficeCat,
  type CatInput,
  type OfficeCat,
} from "@/systems/officeCat";
import {
  DOG_SPOTS,
  dogAt,
  dogSightingOf,
  stepOfficeDog,
  type DogInput,
  type OfficeDog,
} from "@/systems/officeDog";
import {
  FETCH_THROWS,
  ME_RUN_SPEED,
  ME_SPOTS,
  ME_TYPING_MS,
  meAt,
  meChoices,
  meSightingOf,
  stepOfficeMe,
  type MeInput,
  type OfficeMe,
} from "@/systems/officeMe";
import {
  PET_STRETCH_MS,
  distance,
  petActOf,
  sightingOf,
  type ClaudeAt,
} from "@/systems/officePets";

const dice = (...rolls: number[]) => {
  let i = 0;
  return () => rolls[i++ % rolls.length];
};

/** The same run of rolls every time, spread over [0, 1). */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clock = {
  dt: 0.1,
  findPath: findFloorPath,
  walkable: isFloorWalkable,
};

const meInput = (now: number, over: Partial<MeInput> = {}): MeInput => ({
  ...clock,
  now,
  random: dice(0.5),
  typedAt: null,
  asked: false,
  party: false,
  claude: null,
  dog: null,
  cat: null,
  ...over,
});

const dogInput = (now: number, over: Partial<DogInput> = {}): DogInput => ({
  ...clock,
  now,
  random: dice(0.9),
  napping: false,
  claude: null,
  cat: null,
  arriving: false,
  upset: null,
  party: false,
  me: null,
  play: null,
  ...over,
});

const catInput = (now: number, over: Partial<CatInput> = {}): CatInput => ({
  ...clock,
  now,
  random: dice(0.9),
  napping: false,
  claude: null,
  dog: null,
  me: null,
  play: null,
  ...over,
});

function run(
  me: OfficeMe,
  from: number,
  done: (me: OfficeMe) => boolean,
  over: Partial<MeInput> = {},
): { me: OfficeMe; now: number } {
  let now = from;
  while (!done(me) && now < from + 120_000) {
    now += 100;
    me = stepOfficeMe(me, meInput(now, over));
  }
  return { me, now };
}

/** Me on my feet somewhere in the lounge, done with what I was doing. */
const away = (): OfficeMe => ({
  ...meAt(null, 0, dice(0.5)),
  plan: ME_SPOTS.coffee,
  ...ME_SPOTS.coffee.floor,
  until: 10_000_000,
});

const SEATED: ClaudeAt = { x: 13.5, z: 9.6, seated: true, working: false };

describe("my spots", () => {
  it("can get from my chair to the cafe and back", () => {
    expect(isFloorWalkable(MY_SEAT)).toBe(true);
    expect(isFloorWalkable(ME_SPOTS.coffee.floor)).toBe(true);
    expect(
      findFloorPath(MY_SEAT, ME_SPOTS.coffee.floor).length,
    ).toBeGreaterThan(0);
  });
});

describe("meChoices", () => {
  it("plays only with a pet that can play, and peeks only at a Claude at work", () => {
    const me = meAt(null, 0, dice(0.5));
    const asleep = { ...meInput(0), dog: dogSightingOf(dogAt(0, dice(0.5))) };
    const ids = (input: MeInput) => meChoices(me, input).map((p) => p.id);
    // The dog asleep on its bed: no fetch, and no pat up on its bed either.
    expect(ids(asleep)).not.toContain("fetch");
    expect(ids(asleep)).toContain("patDog");
    expect(ids(asleep)).not.toContain("peek");
    expect(ids(asleep)).not.toContain("desk");
    const water = { ...dogAt(0, dice(0.5)), plan: DOG_SPOTS.water };
    const awake = {
      ...meInput(0),
      dog: dogSightingOf({ ...water, ...DOG_SPOTS.water.floor }),
      claude: SEATED,
    };
    expect(ids(awake)).toContain("fetch");
    expect(ids(awake)).toContain("peek");
    // The cat asleep on its tower: no wand, no pat; eating at its bowl: both.
    const tower = catAt("tower", 0, dice(0.5));
    expect(ids({ ...awake, cat: sightingOf(tower) })).not.toContain("wand");
    expect(ids({ ...awake, cat: sightingOf(tower) })).not.toContain("patCat");
    const bowl = catAt("bowl", 0, dice(0.5));
    expect(ids({ ...awake, cat: sightingOf(bowl) })).toContain("wand");
    expect(ids({ ...awake, cat: sightingOf(bowl) })).toContain("patCat");
  });
});

describe("stepOfficeMe", () => {
  it("starts in my chair and types a new question straight from it", () => {
    const me = meAt(1, 0, dice(0.5));
    expect(petActOf(me)).toBe("desk");
    const typing = stepOfficeMe(me, meInput(100, { typedAt: 2 }));
    expect(typing).toMatchObject({ phase: "stay", toType: false });
    expect(typing.plan.id).toBe("type");
    expect(typing.x).toBe(MY_SEAT.x);
    // Typed out, I sit on at my desk a while.
    const done = run(typing, 100, (m) => m.plan.id !== "type", {
      typedAt: 2,
    });
    expect(done.now).toBe(100 + ME_TYPING_MS);
    expect(done.me.plan.id).toBe("desk");
    const sat = run(done.me, done.now, (m) => m.phase === "stay", {
      typedAt: 2,
    });
    expect(sat.now - done.now).toBeLessThanOrEqual(100);
    expect(sat.me.until - sat.now).toBeGreaterThanOrEqual(8_000);
  });

  it("stretches getting up from my chair before walking off", () => {
    const me = { ...meAt(null, 0, dice(0.5)), until: 0 };
    const up = stepOfficeMe(me, meInput(100));
    expect(up.phase).toBe("stretch");
    expect(petActOf(up)).toBe("stretch");
    const off = stepOfficeMe(up, meInput(100 + PET_STRETCH_MS));
    expect(off.phase).toBe("walk");
    expect(off.plan.id).not.toBe("desk");
  });

  it("runs back to my desk from wherever I am to type a new question", () => {
    const me = stepOfficeMe(away(), meInput(100, { typedAt: 5 }));
    expect(me.plan.id).toBe("type");
    expect(me.plan.speed).toBe(ME_RUN_SPEED);
    expect(me.phase).toBe("walk");
    const there = run(me, 100, (m) => m.phase === "stay", { typedAt: 5 });
    expect(there.me.plan.id).toBe("type");
    expect(distance(there.me, MY_SEAT)).toBeLessThan(0.01);
  });

  it("stops where I am to clap when work ships on my way somewhere", () => {
    const leaving = stepOfficeMe({ ...away(), until: 0 }, meInput(100));
    expect(leaving.phase).toBe("walk");
    const clap = run(leaving, 100, (m) => m.phase === "stay", { party: true });
    expect(clap.me.plan.id).toBe("clap");
    expect(clap.now - 100).toBeLessThanOrEqual(200);
    expect(distance(clap.me, leaving)).toBeLessThan(0.5);
  });

  it("sits back down when Claude comes to ask me something, and stays", () => {
    const me = stepOfficeMe(away(), meInput(100, { asked: true }));
    expect(me.plan.id).toBe("desk");
    const there = run(me, 100, (m) => m.phase === "stay", { asked: true });
    expect(there.me.plan.id).toBe("desk");
    expect(there.me.phase).toBe("stay");
  });
});

describe("playing with the pets", () => {
  it("plays fetch: the dog comes, chases every throw, brings it back, then I move on", () => {
    const random = seeded(7);
    let now = 0;
    let dog: OfficeDog = {
      ...dogAt(0, random),
      plan: DOG_SPOTS.water,
      ...DOG_SPOTS.water.floor,
      until: 10_000_000,
    };
    const start = meAt(null, 0, random);
    const fetch = meChoices(start, {
      ...meInput(0),
      dog: dogSightingOf(dog),
    }).find((p) => p.id === "fetch");
    expect(fetch).toBeDefined();
    if (!fetch) return;
    let me: OfficeMe = {
      ...start,
      plan: fetch,
      ...fetch.floor,
      until: 60_000,
    };
    const seen = new Set<string>();
    let throws = 0;
    let last = me.thrown;
    while (now < 60_000 && me.plan.id === "fetch") {
      now += 100;
      me = stepOfficeMe(me, meInput(now, { random, dog: dogSightingOf(dog) }));
      dog = stepOfficeDog(dog, dogInput(now, { random, me: meSightingOf(me) }));
      seen.add(dog.plan.id);
      if (me.thrown && me.thrown !== last) {
        throws += 1;
        last = me.thrown;
        expect(distance(me.thrown.to, me)).toBeGreaterThanOrEqual(2.5);
      }
    }
    expect(throws).toBe(FETCH_THROWS);
    expect([...seen]).toEqual(
      expect.arrayContaining(["fetchMe", "chase", "bring"]),
    );
    expect(me.plan.id).not.toBe("fetch");
    expect(now).toBeLessThan(40_000);
  });

  it("dangles the wand: the cat leaps at it till I go, then goes its way", () => {
    const CAT_BOWL_SPOT = catAt("bowl", 0, dice(0.5));
    let cat: OfficeCat = { ...catAt("bowl", 0, dice(0.5)), until: 10_000_000 };
    const wand = meChoices(meAt(null, 0, dice(0.5)), {
      ...meInput(0),
      cat: sightingOf(cat),
    }).find((p) => p.id === "wand");
    expect(wand).toBeDefined();
    if (!wand) return;
    const me: OfficeMe = {
      ...meAt(null, 0, dice(0.5)),
      plan: wand,
      ...wand.floor,
    };
    cat = stepOfficeCat(cat, catInput(100, { me: meSightingOf(me) }));
    expect(cat.plan.id).toBe("play");
    for (let now = 200; now < 5_000; now += 100) {
      cat = stepOfficeCat(cat, catInput(now, { me: meSightingOf(me) }));
    }
    // Where it was, turned to me.
    expect(distance(cat, CAT_BOWL_SPOT)).toBeLessThan(0.01);
    expect(cat.facing).toBeCloseTo(Math.atan2(me.x - cat.x, me.z - cat.z));
    expect(petActOf(cat)).toBe("play");
    const gone = { ...meSightingOf(me), planId: "coffee" };
    cat = stepOfficeCat(cat, catInput(5_100, { me: gone }));
    expect(cat.plan.id).not.toBe("play");
  });

  it("the cat up and about a few metres off dashes over to my wand", () => {
    let cat: OfficeCat = {
      ...catAt("plant", 0, dice(0.5)),
      until: 10_000_000,
    };
    const me: OfficeMe = {
      ...meAt(null, 0, dice(0.5)),
      plan: { ...ME_SPOTS.coffee, id: "wand", act: "wand" },
      x: cat.x - 4,
      z: cat.z + 1,
    };
    for (let now = 100; now < 6_000; now += 100) {
      cat = stepOfficeCat(cat, catInput(now, { me: meSightingOf(me) }));
    }
    expect(cat.plan.id).toBe("play");
    expect(petActOf(cat)).toBe("play");
    expect(distance(cat, me)).toBeLessThan(1.5);
    // Asleep on its tower it does not come.
    const tower = stepOfficeCat(
      catAt("tower", 0, dice(0.5)),
      catInput(100, { me: meSightingOf({ ...me, x: 9, z: 24 }) }),
    );
    expect(tower.plan.id).toBe("tower");
  });

  it("the dog stays put while I pat it", () => {
    const water = DOG_SPOTS.water;
    let dog: OfficeDog = {
      ...dogAt(0, dice(0.5)),
      plan: water,
      ...water.floor,
      until: 1_000,
    };
    const pat = meChoices(meAt(null, 0, dice(0.5)), {
      ...meInput(0),
      dog: dogSightingOf(dog),
    }).find((p) => p.id === "patDog");
    expect(pat).toBeDefined();
    if (!pat) return;
    const me = { ...meAt(null, 0, dice(0.5)), plan: pat, ...pat.floor };
    for (let now = 100; now < 6_000; now += 100) {
      dog = stepOfficeDog(dog, dogInput(now, { me: meSightingOf(me) }));
    }
    expect(dog.plan.id).toBe("water");
    expect(dog.phase).toBe("stay");
  });
});
