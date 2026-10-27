import { describe, expect, it } from "vitest";
import { findFloorPath, isFloorWalkable } from "@/systems/isoNavGrid";
import {
  DOG_BALL_START,
  DOG_CALLS,
  DOG_RUN_SPEED,
  DOG_SPOTS,
  dogAt,
  stepOfficeDog,
  type DogInput,
  type OfficeDog,
} from "@/systems/officeDog";
import {
  PET_STRETCH_MS,
  distance,
  petActOf,
  type PetSighting,
} from "@/systems/officePets";

const dice = (...rolls: number[]) => {
  let i = 0;
  return () => rolls[i++ % rolls.length];
};

/** Dice that never send it on zoomies, after Claude or sniffing about. */
const CALM = dice(0.9);

const input = (now: number, over: Partial<DogInput> = {}): DogInput => ({
  now,
  dt: 0.1,
  napping: false,
  claude: null,
  cat: null,
  arriving: false,
  upset: null,
  party: false,
  play: null,
  random: CALM,
  findPath: findFloorPath,
  walkable: isFloorWalkable,
  ...over,
});

function run(
  dog: OfficeDog,
  from: number,
  done: (dog: OfficeDog) => boolean,
  over: Partial<DogInput> = {},
): { dog: OfficeDog; now: number } {
  let now = from;
  while (!done(dog) && now < from + 120_000) {
    now += 100;
    dog = stepOfficeDog(dog, input(now, over));
  }
  return { dog, now };
}

/** The dog up and done with whatever it was doing, ready to choose. */
const restless = (): OfficeDog => ({
  ...dogAt(0, CALM),
  plan: DOG_SPOTS.water,
  ...DOG_SPOTS.water.floor,
  until: 0,
});

describe("the office dog's spots", () => {
  it("can get from its bed to every spot it has", () => {
    const plans = [...Object.values(DOG_SPOTS), ...Object.values(DOG_CALLS)];
    expect(isFloorWalkable(DOG_BALL_START)).toBe(true);
    for (const plan of plans) {
      expect(isFloorWalkable(plan.floor), plan.id).toBe(true);
      const path = findFloorPath(DOG_SPOTS.bed.floor, plan.floor);
      if (plan.id !== "bed") expect(path.length, plan.id).toBeGreaterThan(0);
    }
  });
});

describe("stepOfficeDog", () => {
  it("starts asleep on its bed, its ball beside it", () => {
    const dog = dogAt(0, CALM);
    expect(petActOf(dog)).toBe("sleep");
    expect(dog.ball).toEqual(DOG_BALL_START);
  });

  it("carries its ball off in its mouth and drops it where it next stops", () => {
    const playing: OfficeDog = {
      ...restless(),
      plan: { ...DOG_SPOTS.water, id: "ball", act: "play" },
    };
    let dog = stepOfficeDog(playing, input(100));
    expect(dog.phase).toBe("walk");
    expect(dog.ball).toBeNull();
    const stopped = run(
      dog,
      100,
      (d) => d.phase === "stay" || d.phase === "stretch",
    );
    dog = stopped.dog;
    expect(dog.ball).not.toBeNull();
    expect(distance(dog.ball!, dog)).toBeCloseTo(1, 1);
  });

  it("runs round in zoomies when work ships", () => {
    const dog = stepOfficeDog(
      restless(),
      input(100, { party: true, random: dice(0.3, 0.7, 0.6, 0.4) }),
    );
    expect(dog.plan).toMatchObject({ id: "zoomies", speed: DOG_RUN_SPEED });
    expect(dog.plan.via).toHaveLength(2);
    expect(petActOf(dog)).toBe("run");
  });

  it("runs to sit by whoever's tests just failed", () => {
    const seat = { x: 17.3, z: 5.2, facing: Math.PI };
    const dog = stepOfficeDog(restless(), input(100, { upset: seat }));
    expect(dog.plan.id).toBe("comfort");
    expect(distance(dog.plan.floor, seat)).toBeCloseTo(1.25, 1);
    const there = run(dog, 100, (d) => d.phase === "stay");
    expect(petActOf(there.dog)).toBe("comfort");
    // A newcomer does not call it away from them.
    const stays = stepOfficeDog(
      there.dog,
      input(there.now + 100, { arriving: true }),
    );
    expect(stays.phase).toBe("stay");
  });

  it("wakes up and runs to greet a newcomer at the elevator", () => {
    const dog = stepOfficeDog(dogAt(0, CALM), input(100, { arriving: true }));
    // It finishes its stretch on the bed first.
    expect(dog.phase).toBe("stretch");
    const off = stepOfficeDog(dog, input(100 + PET_STRETCH_MS));
    expect(off.plan).toBe(DOG_CALLS.greet);
    expect(petActOf(off)).toBe("hop");
    const down = run(off, 100 + PET_STRETCH_MS, (d) => d.phase !== "hopDown");
    expect(petActOf(down.dog)).toBe("run");
  });

  it("lies down by my chair while Claude waits on me, and gets up when I type", () => {
    let dog = stepOfficeDog(restless(), input(100, { napping: true }));
    expect(dog.plan).toBe(DOG_CALLS.myChair);
    const there = run(dog, 100, (d) => d.phase === "stay", { napping: true });
    dog = stepOfficeDog(
      there.dog,
      input(there.now + 600_000, { napping: true }),
    );
    expect(petActOf(dog)).toBe("lie");
    dog = stepOfficeDog(dog, input(there.now + 600_100));
    expect(dog.phase).toBe("stretch");
  });

  it("follows Claude to the room it works in, and leaves once Claude has gone", () => {
    const working = { x: 9.05, z: 1.4, seated: false, working: true };
    // Follow (roll under a half), no zoomies first.
    let dog = stepOfficeDog(
      restless(),
      input(100, { claude: working, random: dice(0.9, 0.2) }),
    );
    expect(dog.plan.id).toBe("follow");
    expect(distance(dog.plan.floor, working)).toBeCloseTo(1.1, 1);
    const there = run(dog, 100, (d) => d.phase === "stay", { claude: working });
    expect(petActOf(there.dog)).toBe("sit");
    const gone = { ...working, x: 35.6, z: 6.9 };
    dog = stepOfficeDog(there.dog, input(there.now + 100, { claude: gone }));
    expect(dog.phase).toBe("walk");
  });

  it("goes over to sniff the cat only while it stays down on the floor", () => {
    const cat: PetSighting = {
      x: 34.3,
      y: 0,
      z: 6.7,
      facing: 0,
      planId: "server",
      phase: "stay",
      act: "doze",
    };
    const plans = Array.from(
      { length: 6 },
      (_, i) =>
        stepOfficeDog(
          restless(),
          input(100, { cat, random: dice(0.9, 0.9, 0.9, i / 6) }),
        ).plan.id,
    );
    expect(plans).toContain("visit");
    const perched = { ...cat, y: 0.78 };
    const aloft = Array.from(
      { length: 6 },
      (_, i) =>
        stepOfficeDog(
          restless(),
          input(100, { cat: perched, random: dice(0.9, 0.9, 0.9, i / 6) }),
        ).plan.id,
    );
    expect(aloft).not.toContain("visit");
  });
});
