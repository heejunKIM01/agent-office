/**
 * The office dog (docs/plan/spec.md 「작업 공간 기믹」): a golden retriever,
 * getting about as officePets.ts does, and a dog all through. It trots
 * about sniffing the floor, sleeps stretched out on its bed in the lounge,
 * drinks at its water bowl, sits by the elevator watching the door, plays
 * with its ball and carries it in its mouth to wherever it goes next, comes
 * over to sniff the cat (which swats it when it can), lies at Claude's feet
 * while Claude sits at its desk and follows Claude to the room it works
 * in. It runs to the elevator to greet a newcomer, runs to whoever's tests
 * just failed and sits by them, tears round in zoomies when work ships and
 * lies down beside my chair, its ball by it, while Claude waits on me.
 * When I call it to play fetch (officeMe.ts) it runs over with a play
 * bow, chases each ball I throw and brings it back to my feet; while I pat
 * it, it stays put.
 */

import {
  CLAUDE_SEAT,
  DOG_BED,
  DOG_WATER,
  ELEVATOR_DOOR,
  MY_SEAT,
} from "@/constants/isoFloorPlan";
import type { FloorPoint } from "./isoNavGrid";
import { FETCH_PLANS, type MeSighting } from "./officeMe";
import {
  PLAY_PREFIX,
  besidePoint,
  distance,
  openSpot,
  petAt,
  stepPet,
  towards,
  type ClaudeAt,
  type Pet,
  type PetBrain,
  type PetClock,
  type PetPlan,
  type PetSighting,
  sightingOf,
} from "./officePets";

/** What it does once there. */
export type DogAct =
  | "sleep"
  | "drink"
  | "sit"
  | "lie"
  | "play"
  | "visit"
  | "sniff"
  | "greet"
  | "comfort"
  | "pant"
  | "lookUp"
  | "tease"
  | "boop";

export type DogPlan = PetPlan<DogAct>;

export interface OfficeDog extends Pet<DogAct> {
  /** Where its ball lies; null while it carries the ball in its mouth. */
  ball: FloorPoint | null;
  /** When the last ball I threw left my hand (ms), once it has gone after it. */
  chased: number | null;
}

/** What the others see of the dog: where it is, what it is up to and where its ball is. */
export interface DogSighting extends PetSighting {
  ball: FloorPoint | null;
}

export interface DogInput extends PetClock {
  /** Claude has waited on my next prompt a while: go lie down by my chair. */
  napping: boolean;
  claude: ClaudeAt | null;
  cat: PetSighting | null;
  /** A newcomer is stepping out of the elevator. */
  arriving: boolean;
  /** Where someone whose tests just failed is. */
  upset: FloorPoint | null;
  /** Work just shipped: confetti is falling. */
  party: boolean;
  /** Its part in a game with the cat (systems/petPlay.ts), while one goes on. */
  play: DogPlan | null;
  me: MeSighting | null;
}

/** Called away to these, it does not come to play. */
const BUSY = new Set(["greet", "comfort", "myChair", "zoomies"]);

/** A walk, a trot and a run (m/s). */
export const DOG_WALK_SPEED = 1.6;
export const DOG_TROT_SPEED = 2.4;
export const DOG_RUN_SPEED = 4.6;
/** Where its ball lies when the office opens: by its bed. */
export const DOG_BALL_START: FloorPoint = { x: 6.6, z: 29.9 };

/** A plan for the dog: ``floor`` to walk to, what to do there and how long. */
export const dogPlan = (
  id: string,
  floor: FloorPoint & { facing: number },
  act: DogAct,
  stay: [number, number],
  more: Partial<DogPlan> = {},
): DogPlan => ({
  id,
  floor: { ...floor, y: 0 },
  perch: null,
  act,
  stay,
  speed: DOG_TROT_SPEED,
  ...more,
});

/** ``to`` with the dog standing there turned towards ``look``. */
const facingTo = (to: FloorPoint, look: FloorPoint) => ({
  ...to,
  facing: towards(to, look),
});

/** The top of its bed's cushion (isoFurniture.ts), and where it steps up from. */
export const DOG_BED_TOP = 0.15;
const BESIDE_BED: FloorPoint = { x: DOG_BED.x + 1.3, z: DOG_BED.z };
// To the door's screen left, so it shows its side looking at the door.
const GREET_AT: FloorPoint = {
  x: ELEVATOR_DOOR.x - 1.3,
  z: ELEVATOR_DOOR.z + 1.3,
};
const BY_MY_CHAIR: FloorPoint = { x: MY_SEAT.x - 1, z: MY_SEAT.z + 1.4 };
const AT_CLAUDES_FEET: FloorPoint = {
  x: CLAUDE_SEAT.x + 0.9,
  z: CLAUDE_SEAT.z + 1.1,
};

/** Its own spots. */
export const DOG_SPOTS = {
  // Up onto its bed and stretched out on its side.
  bed: dogPlan(
    "bed",
    facingTo(BESIDE_BED, DOG_BED),
    "sleep",
    [20_000, 35_000],
    {
      perch: { ...DOG_BED, y: DOG_BED_TOP, facing: Math.PI / 2 },
      rest: true,
    },
  ),
  water: dogPlan(
    "water",
    { x: DOG_WATER.x, z: DOG_WATER.z - 1, facing: 0 },
    "drink",
    [4_000, 7_000],
  ),
  // Sitting by the elevator, watching the door.
  watch: dogPlan(
    "watch",
    facingTo(GREET_AT, ELEVATOR_DOOR),
    "sit",
    [6_000, 10_000],
  ),
} satisfies Record<string, DogPlan>;

/** Plans it is called to, wherever it is. */
export const DOG_CALLS = {
  greet: dogPlan(
    "greet",
    facingTo(GREET_AT, ELEVATOR_DOOR),
    "greet",
    [3_000, 5_000],
    {
      speed: DOG_RUN_SPEED,
    },
  ),
  myChair: dogPlan("myChair", facingTo(BY_MY_CHAIR, MY_SEAT), "lie", [0, 0], {
    rest: true,
    hold: true,
  }),
  // Lying beside Claude's chair, side on to the camera.
  feet: dogPlan(
    "feet",
    { ...AT_CLAUDES_FEET, facing: -Math.PI / 4 },
    "lie",
    [12_000, 20_000],
    {
      rest: true,
    },
  ),
} satisfies Record<string, DogPlan>;

/** How often it tears round, follows Claude (when it works in a room) and sniffs about. */
const ZOOMIES_CHANCE = 0.06;
const FOLLOW_CHANCE = 0.5;
const ROAM_CHANCE = 0.35;
/** A followed Claude that moved this far from where the dog sits has gone (m). */
const FOLLOW_REACH = 2.6;
/** It visits the cat this close, and gives up once the cat is this far off (m). */
const VISIT_REACH = 1.4;
const VISIT_LOST = 2.2;

/** A few laps at a run round the floor near it, then a pant. */
function zoomies(dog: OfficeDog, input: DogInput): DogPlan | null {
  const via: FloorPoint[] = [];
  let from: FloorPoint = dog;
  for (let lap = 0; lap < 3; lap++) {
    const point = openSpot(from, input, dog, 4);
    if (!point) return null;
    via.push(point);
    from = point;
  }
  const end = via.pop() as FloorPoint;
  return dogPlan(
    "zoomies",
    { ...end, facing: dog.facing },
    "pant",
    [2_000, 3_000],
    {
      speed: DOG_RUN_SPEED,
      via,
    },
  );
}

function comfort(upset: FloorPoint, input: DogInput): DogPlan | null {
  const by = besidePoint(upset, 1.25, input);
  if (!by) return null;
  return dogPlan("comfort", facingTo(by, upset), "comfort", [5_000, 8_000], {
    speed: DOG_RUN_SPEED,
  });
}

function follow(claude: ClaudeAt, input: DogInput): DogPlan | null {
  const by = besidePoint(claude, 1.1, input);
  if (!by) return null;
  return dogPlan("follow", facingTo(by, claude), "sit", [6_000, 12_000]);
}

function fetchBall(ball: FloorPoint, input: DogInput): DogPlan | null {
  const by = besidePoint(ball, 0.8, input);
  if (!by) return null;
  return dogPlan("ball", facingTo(by, ball), "play", [3_000, 5_000], {
    speed: DOG_RUN_SPEED,
  });
}

/** I stand calling it to play fetch. */
const calledToPlay = (me: MeSighting | null): me is MeSighting =>
  me !== null && me.planId === "fetch" && me.staying;

/** Over to me at a run, a play bow, and the ball dropped at my feet. */
function toMe(
  id: "fetchMe" | "bring",
  me: FloorPoint,
  input: DogInput,
): DogPlan | null {
  const by = besidePoint(me, 1.3, input);
  if (!by) return null;
  return dogPlan(id, facingTo(by, me), "play", [0, 0], {
    speed: id === "fetchMe" ? DOG_RUN_SPEED : DOG_TROT_SPEED,
    hold: true,
  });
}

/** After the ball I just threw, to where it lands. */
function chase(to: FloorPoint, input: DogInput): DogPlan | null {
  const by = besidePoint(to, 0.6, input);
  if (!by) return null;
  return dogPlan("chase", facingTo(by, to), "play", [400, 700], {
    speed: DOG_RUN_SPEED,
  });
}

/** Over to the cat, when the cat is down on the floor and staying put. */
function visit(cat: PetSighting | null, input: DogInput): DogPlan | null {
  if (!cat || cat.y > 0 || cat.phase !== "stay") return null;
  const by = besidePoint(cat, VISIT_REACH, input);
  if (!by) return null;
  return dogPlan("visit", facingTo(by, cat), "visit", [3_000, 5_000]);
}

function roam(dog: OfficeDog, input: DogInput): DogPlan | null {
  const to = openSpot(dog, input);
  if (!to) return null;
  return dogPlan(
    "roam",
    { ...to, facing: dog.facing },
    "sniff",
    [2_000, 4_000],
    {
      speed: input.random() < 0.5 ? DOG_WALK_SPEED : DOG_TROT_SPEED,
    },
  );
}

/** The plans it may go to now, other than ``from``. */
function choices(dog: OfficeDog, input: DogInput): DogPlan[] {
  const found: (DogPlan | null)[] = [
    ...Object.values(DOG_SPOTS),
    input.claude?.seated ? DOG_CALLS.feet : null,
    dog.ball ? fetchBall(dog.ball, input) : null,
    visit(input.cat, input),
  ];
  return found.filter((p): p is DogPlan => p !== null && p.id !== dog.plan.id);
}

/** The dog's brain; it reads its ball from the dog it is given. */
export const DOG_BRAIN: PetBrain<DogAct, DogInput> = {
  urgent: (pet, input) => {
    const dog = pet as OfficeDog;
    const id = dog.plan.id;
    const called =
      (input.party && id !== "zoomies" ? zoomies(dog, input) : null) ??
      (input.upset && id !== "comfort" && id !== "zoomies"
        ? comfort(input.upset, input)
        : null);
    if (called) return called;
    // Sitting by someone upset it stays put, newcomer or not.
    if (input.arriving && id !== "greet" && id !== "comfort") {
      return DOG_CALLS.greet;
    }
    if (input.napping) return id !== "myChair" ? DOG_CALLS.myChair : null;
    if (input.play) return id !== input.play.id ? input.play : null;
    if (calledToPlay(input.me)) {
      const { thrown } = input.me;
      if (thrown && thrown.at !== dog.chased) return chase(thrown.to, input);
      if (!FETCH_PLANS.has(id) && !BUSY.has(id)) {
        return toMe("fetchMe", input.me, input);
      }
    }
    return null;
  },
  keeps: (dog, input) => {
    if (dog.plan.id.startsWith(PLAY_PREFIX)) {
      return input.play?.id === dog.plan.id;
    }
    switch (dog.plan.id) {
      case "myChair":
        return input.napping;
      case "feet":
        return input.claude?.seated === true;
      case "follow":
        return (
          input.claude?.working === true &&
          distance(input.claude, dog.plan.floor) < FOLLOW_REACH
        );
      case "fetchMe":
      case "bring":
        return calledToPlay(input.me);
      case "visit":
        return (
          input.cat !== null &&
          input.cat.y === 0 &&
          distance(input.cat, dog.plan.floor) < VISIT_LOST
        );
      default:
        return true;
    }
  },
  next: (pet, input) => {
    const dog = pet as OfficeDog;
    // The ball in its mouth, back to me while I still play.
    if (dog.plan.id === "chase" && calledToPlay(input.me)) {
      const back = toMe("bring", input.me, input);
      if (back) return back;
    }
    const tries: (() => DogPlan | null)[] = [
      () => (input.random() < ZOOMIES_CHANCE ? zoomies(dog, input) : null),
      () =>
        input.claude?.working && input.random() < FOLLOW_CHANCE
          ? follow(input.claude, input)
          : null,
      () => (input.random() < ROAM_CHANCE ? roam(dog, input) : null),
    ];
    for (const attempt of tries) {
      const found = attempt();
      if (found) return found;
    }
    const open = choices(dog, input);
    return open[Math.floor(input.random() * open.length)] ?? DOG_SPOTS.bed;
  },
};

/** Where it puts its ball down: in front of its nose, or beside it. */
function dropBall(dog: OfficeDog, input: DogInput): FloorPoint | null {
  for (const turn of [0, Math.PI / 2, -Math.PI / 2]) {
    const point = {
      x: dog.x + 1 * Math.sin(dog.facing + turn),
      z: dog.z + 1 * Math.cos(dog.facing + turn),
    };
    if (input.walkable(point)) return point;
  }
  return null;
}

/** The dog when the office opens: asleep on its bed, its ball beside it. */
export function dogAt(now: number, random: () => number): OfficeDog {
  return {
    ...petAt(DOG_SPOTS.bed, now, random),
    ball: DOG_BALL_START,
    chased: null,
  };
}

/** I pat it from this close (m). */
const PAT_REACH = 1.6;

/** I crouch beside it patting it. */
export const pattedBy = (me: MeSighting | null, dog: FloorPoint): boolean =>
  me !== null &&
  me.planId === "patDog" &&
  me.staying &&
  distance(me, dog) < PAT_REACH;

/** What the others see of the dog. */
export const dogSightingOf = (dog: OfficeDog): DogSighting => ({
  ...sightingOf(dog),
  ball: dog.ball,
});

/**
 * Move the dog on by ``input.dt``. Leaving its ball's spot it picks the
 * ball up, and it puts it down at the next place it stops.
 */
export function stepOfficeDog(dog: OfficeDog, input: DogInput): OfficeDog {
  // Patted, it stays where it is a while longer.
  const still =
    dog.phase === "stay" && pattedBy(input.me, dog)
      ? { ...dog, until: Math.max(dog.until, input.now + 1000) }
      : dog;
  const moved = stepPet(still, input, DOG_BRAIN) as OfficeDog;
  let { ball, chased } = dog;
  // Off after a ball I threw: it lands where the dog runs to.
  const thrown = input.me?.thrown;
  if (moved.plan.id === "chase" && thrown && thrown.at !== chased) {
    chased = thrown.at;
    ball = thrown.to;
  }
  const leftBall =
    (dog.plan.id === "ball" || dog.plan.id === "chase") &&
    dog.phase === "stay" &&
    moved.phase !== "stay";
  if (leftBall) ball = null;
  const stopped = moved.phase === "stay" && dog.phase !== "stay";
  if (!ball && stopped) ball = dropBall(moved, input);
  return { ...moved, ball, chased };
}
