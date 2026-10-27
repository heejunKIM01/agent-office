import { describe, expect, it } from "vitest";
import { findFloorPath, isFloorWalkable } from "@/systems/isoNavGrid";
import {
  CAT_DASH_SPEED,
  CAT_SPOTS,
  catAt,
  stepOfficeCat,
} from "@/systems/officeCat";
import {
  PET_RUN_SPEED,
  distance,
  sightingOf,
  type PetSighting,
} from "@/systems/officePets";
import {
  NO_PLAY,
  stepPlay,
  type PlayInput,
  type PlayState,
} from "@/systems/petPlay";

const dice = (...rolls: number[]) => {
  let i = 0;
  return () => rolls[i++ % rolls.length];
};

const sight = (
  x: number,
  z: number,
  over: Partial<PetSighting> = {},
): PetSighting => ({
  x,
  y: 0,
  z,
  facing: 0,
  planId: "roam",
  phase: "stay",
  act: "look",
  ...over,
});

/** The cat and the dog up and about in the open floor between the rooms. */
const CAT = sight(20, 15);
const DOG = sight(22, 15.5, { act: "sniff" });

const input = (now: number, over: Partial<PlayInput> = {}): PlayInput => ({
  now,
  dt: 0.1,
  random: dice(0.1, 0.9),
  findPath: findFloorPath,
  walkable: isFloorWalkable,
  cat: CAT,
  dog: DOG,
  napping: false,
  ...over,
});

/** Start a game: the first roll starts one, the second picks it. */
const start = (gameRoll: number, over: Partial<PlayInput> = {}): PlayState =>
  stepPlay(
    NO_PLAY,
    input(0, { random: dice(0.1, gameRoll, 0.8, 0.3), ...over }),
  );

/** Both pets at their parts, staying. */
const atParts = (state: PlayState, now: number): PlayInput =>
  input(now, {
    cat: sight(state.date!.cat.floor.x, state.date!.cat.floor.z, {
      planId: state.date!.cat.id,
    }),
    dog: sight(state.date!.dog.floor.x, state.date!.dog.floor.z, {
      planId: state.date!.dog.id,
    }),
  });

describe("stepPlay", () => {
  it("starts no game while either sleeps, is up on something or is called away", () => {
    const asleep = sight(20, 15, { act: "sleep", planId: "server" });
    const perched = sight(20, 15, { y: 0.78, act: "groom" });
    const bed = sight(22, 15.5, { act: "sleep", planId: "bed" });
    const greeting = sight(22, 15.5, { act: "greet", planId: "greet" });
    for (const over of [
      { cat: asleep },
      { cat: perched },
      { dog: bed },
      { dog: greeting },
      { napping: true },
      { dog: sight(38, 29) },
    ]) {
      expect(start(0.6, over).date).toBeNull();
    }
  });

  it("looks again only every so often", () => {
    const missed = stepPlay(NO_PLAY, input(0, { random: dice(0.9) }));
    expect(missed.date).toBeNull();
    expect(stepPlay(missed, input(5_000)).date).toBeNull();
  });

  it("brings them nose to nose, side on to the camera, for a boop", () => {
    const { date } = start(0.6);
    expect(date?.game).toBe("boop");
    const { cat, dog } = date!;
    expect(cat).toMatchObject({ act: "boop", hold: true });
    expect(dog).toMatchObject({ act: "boop", hold: true });
    expect(cat.floor).toMatchObject({ x: CAT.x, z: CAT.z });
    expect(distance(cat.floor, dog.floor)).toBeCloseTo(1.3);
    expect(Math.abs(cat.floor.facing - dog.floor.facing)).toBeCloseTo(Math.PI);
    expect(cat.id).not.toBe(dog.id);
  });

  it("lays the dog down swishing its tail with the cat crouched behind it", () => {
    const { date } = start(0.4);
    expect(date?.game).toBe("tail");
    const { cat, dog } = date!;
    expect(dog).toMatchObject({ act: "tease" });
    expect(dog.floor).toMatchObject({ x: DOG.x, z: DOG.z });
    expect(cat).toMatchObject({ act: "hunt" });
    expect(distance(cat.floor, dog.floor)).toBeCloseTo(1.7);
    // Behind the tail, facing the same way as the dog.
    expect(cat.floor.facing).toBe(dog.floor.facing);
    const ahead = {
      x: cat.floor.x + Math.sin(cat.floor.facing),
      z: cat.floor.z + Math.cos(cat.floor.facing),
    };
    expect(distance(ahead, dog.floor)).toBeLessThan(1.7);
  });

  it("has the cat turn its back on the dog's bow and wash", () => {
    const { date } = start(0.9);
    expect(date?.game).toBe("snub");
    const { cat, dog } = date!;
    expect(dog.act).toBe("play");
    expect(cat.act).toBe("groom");
    const ahead = {
      x: cat.floor.x + Math.sin(cat.floor.facing),
      z: cat.floor.z + Math.cos(cat.floor.facing),
    };
    expect(distance(ahead, dog.floor)).toBeGreaterThan(
      distance(cat.floor, dog.floor),
    );
  });

  it("plays tag: a bow, then the cat flees up its tower with the dog after it", () => {
    let state = start(0.1);
    expect(state.date).toMatchObject({ game: "tag", stage: "bow" });
    expect(state.date!.dog.act).toBe("play");
    expect(state.date!.cat.act).toBe("look");
    state = stepPlay(state, atParts(state, 1_000));
    expect(state.date!.stage).toBe("bow");
    state = stepPlay(state, atParts(state, 2_600));
    expect(state.date!.stage).toBe("play");
    const { cat, dog } = state.date!;
    expect(cat.perch).toEqual(CAT_SPOTS.tower.perch);
    expect(cat.speed).toBe(CAT_DASH_SPEED);
    expect(cat.via).toHaveLength(2);
    expect(dog.via).toEqual(cat.via);
    expect(dog.act).toBe("lookUp");
    expect(dog.speed).toBeGreaterThanOrEqual(PET_RUN_SPEED);
    expect(dog.speed).toBeLessThan(cat.speed);
    expect(distance(dog.floor, CAT_SPOTS.tower.floor)).toBeCloseTo(1.1);
  });

  it("ends once both have played their parts a while, then rests", () => {
    let state = start(0.6);
    state = stepPlay(state, atParts(state, 1_000));
    state = stepPlay(state, atParts(state, 3_500));
    expect(state.date).not.toBeNull();
    state = stepPlay(state, atParts(state, 4_100));
    expect(state.date).toBeNull();
    expect(
      stepPlay(state, input(10_000, { random: dice(0.1, 0.6) })).date,
    ).toBeNull();
  });

  it("calls the game off when one does not come, or Claude waits on me", () => {
    const state = start(0.6);
    expect(stepPlay(state, input(5_000)).date).toBeNull();
    expect(stepPlay(state, atParts(state, 500)).date).not.toBeNull();
    expect(
      stepPlay(state, { ...atParts(state, 500), napping: true }).date,
    ).toBeNull();
  });
});

describe("the cat at play", () => {
  it("takes its part, holds it while the game goes on and leaves when it ends", () => {
    const { date } = start(0.6);
    const part = date!.cat;
    const base = {
      dt: 0.1,
      napping: false,
      claude: null,
      dog: null,
      me: null,
      random: dice(0.5),
      findPath: findFloorPath,
      walkable: isFloorWalkable,
    };
    let cat = stepOfficeCat(
      { ...catAt("bowl", 0, dice(0.5)), until: 0 },
      { ...base, now: 100, play: part },
    );
    expect(cat.plan).toBe(part);
    let now = 100;
    while (cat.phase !== "stay" && now < 60_000) {
      now += 100;
      cat = stepOfficeCat(cat, { ...base, now, play: part });
    }
    expect(sightingOf(cat)).toMatchObject({ planId: part.id, act: "boop" });
    // It stays as long as the game lasts.
    expect(
      stepOfficeCat(cat, { ...base, now: now + 60_000, play: part }).phase,
    ).toBe("stay");
    // Over: it goes off about its business.
    expect(
      stepOfficeCat(cat, { ...base, now: now + 100, play: null }).plan.id,
    ).not.toBe(part.id);
    // Claude waiting on me comes first.
    expect(
      stepOfficeCat(cat, { ...base, now: now + 100, play: part, napping: true })
        .plan.id,
    ).toBe("keyboard");
  });
});
