/**
 * Me, up from my desk (docs/plan/spec.md 「작업 공간 기믹」): while Claude
 * works I do not just sit there. I get up and stretch, play fetch with the
 * dog, dangle a teaser wand for the cat, crouch to pat whichever of them
 * stays put, look over Claude's shoulder, have a coffee in the cafe or
 * stroll about, and now and then sit back down at my desk a while. When I
 * send a question I hurry back to my desk and type it out, and when Claude
 * comes to ask me something I sit down to answer. When work ships I stop
 * wherever I am to clap.
 *
 * I get about as the pets do (officePets.ts), on the floor only.
 * `stepOfficeMe` is pure: the path finder, the clock and the dice are
 * passed in.
 */

import { MY_SEAT } from "@/constants/isoFloorPlan";
import { ISO_WALK_SPEED } from "./isoErrands";
import { PARTY_MS } from "./roomGimmicks";
import type { FloorPoint } from "./isoNavGrid";
import type { DogSighting } from "./officeDog";
import {
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
} from "./officePets";

/** What I do once there. */
export type MeAct =
  "desk" | "type" | "coffee" | "look" | "peek" | "fetch" | "wand" | "pat";

export type MePlan = PetPlan<MeAct>;

/** A ball I threw: from where, where it lands, and when (ms; it tells throws apart). */
export interface MeThrow {
  from: FloorPoint;
  to: FloorPoint;
  at: number;
}

export interface OfficeMe extends Pet<MeAct> {
  /** The question I typed out last (its time), so that a new one sends me to my desk. */
  typed: number | null;
  /** A new question waits to be typed out: I hurry to my desk. */
  toType: boolean;
  /** Balls thrown in this game of fetch, and the latest one. */
  throws: number;
  thrown: MeThrow | null;
}

export interface MeInput extends PetClock {
  /** When I last sent a question (any clock), or null. */
  typedAt: number | null;
  /** Claude has come to my desk to ask me something. */
  asked: boolean;
  /** Work just shipped: confetti is falling, and I stop to clap. */
  party: boolean;
  claude: ClaudeAt | null;
  dog: DogSighting | null;
  cat: PetSighting | null;
}

/** What the pets see of me. */
export interface MeSighting {
  x: number;
  z: number;
  planId: string;
  /** Standing where I meant to be, not on my way. */
  staying: boolean;
  thrown: MeThrow | null;
}

export const ME_WALK_SPEED = ISO_WALK_SPEED;
export const ME_RUN_SPEED = 5;
/** How long I type at my desk after sending a question (ms). */
export const ME_TYPING_MS = 4000;
/** Throws in a game of fetch, and the least time between two (ms). */
export const FETCH_THROWS = 3;
export const THROW_GAP_MS = 1200;
/** A thrown ball lands at least this far from me, and at most about this far (m). */
const THROW_LEAST = 2.5;
const THROW_REACH = 5;
/** How long a throw takes to swing through (ms); the ball flies as long. */
export const THROW_MS = 700;

const plan = (
  id: string,
  floor: FloorPoint & { facing: number },
  act: MeAct,
  stay: [number, number],
  more: Partial<MePlan> = {},
): MePlan => ({
  id,
  floor: { ...floor, y: 0 },
  perch: null,
  act,
  stay,
  speed: ME_WALK_SPEED,
  ...more,
});

const facingTo = (to: FloorPoint, look: FloorPoint) => ({
  ...to,
  facing: towards(to, look),
});

/** Between the cafe tables' far ends. */
const CAFE_SPOT: FloorPoint = { x: 33.55, z: 28.9 };
/** Turned this way I face the camera, the mug in my hand showing. */
const TO_CAMERA = 0.8;

/** My own spots. */
export const ME_SPOTS = {
  // In my chair; getting up I stretch first.
  desk: plan("desk", MY_SEAT, "desk", [15_000, 30_000], { rest: true }),
  type: plan("type", MY_SEAT, "type", [ME_TYPING_MS, ME_TYPING_MS], {
    speed: ME_RUN_SPEED,
  }),
  coffee: plan(
    "coffee",
    { ...CAFE_SPOT, facing: TO_CAMERA },
    "coffee",
    [8_000, 14_000],
  ),
} satisfies Record<string, MePlan>;

/** The dog is up to something it should not be called away from. */
const DOG_BUSY = new Set(["greet", "comfort", "myChair", "zoomies"]);
/** The dog's plans in a game of fetch with me. */
export const FETCH_PLANS = new Set(["fetchMe", "chase", "bring"]);
/** The cat's spots up off the floor or curled up asleep: no wand there. */
const CAT_RESTING = new Set([
  "tower",
  "sofa",
  "snuggle",
  "box",
  "keyboard",
  "server",
]);
/** Higher than this the cat is out of reach of a pat (m). */
const PAT_HEIGHT = 0.8;
/** I give up on a pet or Claude this far from where I meant to find them (m). */
const LOST_REACH = 2.4;

const dogPlays = (dog: DogSighting | null): dog is DogSighting =>
  dog !== null &&
  dog.y === 0 &&
  !DOG_BUSY.has(dog.planId) &&
  dog.planId !== "bed";

/** Awake on the floor and staying put: game for the wand. */
const catPlays = (cat: PetSighting | null): cat is PetSighting =>
  cat !== null &&
  cat.y === 0 &&
  cat.phase === "stay" &&
  !CAT_RESTING.has(cat.planId);

const stays = (pet: PetSighting | null): pet is PetSighting =>
  pet !== null && pet.phase === "stay";

/** Off to play fetch: by the ball where it lies, or by the dog that has it. */
function fetch(me: OfficeMe, input: MeInput): MePlan | null {
  const { dog } = input;
  if (!dogPlays(dog) || FETCH_PLANS.has(dog.planId)) return null;
  const ball = dog.ball ?? dog;
  const by = besidePoint(ball, dog.ball ? 0.9 : 1.6, input);
  if (!by) return null;
  return plan("fetch", facingTo(by, ball), "fetch", [25_000, 35_000]);
}

function wand(input: MeInput): MePlan | null {
  if (!catPlays(input.cat)) return null;
  const by = besidePoint(input.cat, 1.5, input);
  if (!by) return null;
  return plan("wand", facingTo(by, input.cat), "wand", [7_000, 11_000]);
}

function pat(
  id: "patDog" | "patCat",
  pet: PetSighting | null,
  input: MeInput,
): MePlan | null {
  if (!stays(pet) || pet.y > PAT_HEIGHT) return null;
  if (id === "patDog" && (DOG_BUSY.has(pet.planId) || pet.y > 0.3)) {
    return null;
  }
  if (id === "patCat" && pet.planId === "keyboard") return null;
  const by = besidePoint(pet, id === "patDog" ? 1.1 : 0.9, input);
  if (!by) return null;
  return plan(id, facingTo(by, pet), "pat", [4_000, 7_000]);
}

/**
 * Watching Claude while it sits at its desk or works in a room: a head
 * apart, so that neither of us hides the other (our heads are 1.4 m across).
 */
const PEEK_REACH = 2.2;

function peek(input: MeInput): MePlan | null {
  const { claude } = input;
  if (!claude || !(claude.seated || claude.working)) return null;
  const by = besidePoint(claude, PEEK_REACH, input);
  if (!by) return null;
  return plan("peek", facingTo(by, claude), "peek", [5_000, 9_000]);
}

function stroll(me: OfficeMe, input: MeInput): MePlan | null {
  const to = openSpot(me, input);
  if (!to) return null;
  return plan("stroll", { ...to, facing: me.facing }, "look", [2_000, 4_000]);
}

/** The plans I may go to now, other than the one I am on. */
export function meChoices(me: OfficeMe, input: MeInput): MePlan[] {
  const found: (MePlan | null)[] = [
    fetch(me, input),
    wand(input),
    pat("patDog", input.dog, input),
    pat("patCat", input.cat, input),
    peek(input),
    ME_SPOTS.coffee,
    stroll(me, input),
    ME_SPOTS.desk,
  ];
  return found.filter((p): p is MePlan => p !== null && p.id !== me.plan.id);
}

/** A game of fetch is over: every ball thrown and brought back. */
const fetchDone = (me: OfficeMe, dog: DogSighting | null): boolean =>
  me.throws >= FETCH_THROWS &&
  dog !== null &&
  dog.planId === "bring" &&
  dog.phase === "stay";

export const ME_BRAIN: PetBrain<MeAct, MeInput> = {
  urgent: (pet, input) => {
    const me = pet as OfficeMe;
    if (me.toType && me.plan.id !== "type") return ME_SPOTS.type;
    const atDesk = me.plan.id === "desk" || me.plan.id === "type";
    if (input.asked && !atDesk) {
      return { ...ME_SPOTS.desk, speed: ME_RUN_SPEED };
    }
    // On my way somewhere when work ships, I stop where I am to clap.
    if (input.party && me.phase === "walk" && me.plan.id !== "clap") {
      return plan("clap", { x: me.x, z: me.z, facing: me.facing }, "look", [
        PARTY_MS,
        PARTY_MS,
      ]);
    }
    return null;
  },
  keeps: (pet, input) => {
    const me = pet as OfficeMe;
    const target = me.plan.floor;
    switch (me.plan.id) {
      case "desk":
        return true;
      case "fetch":
        return dogPlays(input.dog) && !fetchDone(me, input.dog);
      case "patDog":
        return stays(input.dog) && distance(input.dog, target) < LOST_REACH;
      case "patCat":
        return stays(input.cat) && distance(input.cat, target) < LOST_REACH;
      case "peek":
        return (
          input.claude !== null &&
          (input.claude.seated || input.claude.working) &&
          distance(input.claude, target) < PEEK_REACH + 0.8
        );
      default:
        return true;
    }
  },
  next: (pet, input) => {
    const me = pet as OfficeMe;
    // Typed out, I watch the screen a while before I get up.
    if (me.plan.id === "type") {
      return { ...ME_SPOTS.desk, stay: [8_000, 15_000] };
    }
    if (input.asked) return ME_SPOTS.desk;
    const open = meChoices(me, input);
    return open[Math.floor(input.random() * open.length)] ?? ME_SPOTS.desk;
  },
};

/** Me when the office opens: in my chair. */
export function meAt(
  typedAt: number | null,
  now: number,
  random: () => number,
): OfficeMe {
  return {
    ...petAt(ME_SPOTS.desk, now, random),
    typed: typedAt,
    toType: false,
    throws: 0,
    thrown: null,
  };
}

/** Where the dog's ball lies for me to throw: on the floor near me, waiting. */
function ballToThrow(me: OfficeMe, input: MeInput): boolean {
  const { dog } = input;
  return (
    me.plan.id === "fetch" &&
    me.phase === "stay" &&
    me.throws < FETCH_THROWS &&
    dog !== null &&
    (dog.planId === "fetchMe" || dog.planId === "bring") &&
    dog.phase === "stay" &&
    dog.ball !== null &&
    distance(dog.ball, me) < 3 &&
    input.now - (me.thrown?.at ?? me.since) >= THROW_GAP_MS
  );
}

/** Somewhere open a few metres off, for the ball to land. */
function landing(me: OfficeMe, input: MeInput): FloorPoint | null {
  for (let tries = 0; tries < 4; tries++) {
    const to = openSpot(me, input, me, THROW_REACH);
    if (to && distance(to, me) >= THROW_LEAST) return to;
  }
  return null;
}

/**
 * Move me on by ``input.dt``. A new question sends me to my desk to type it
 * out (straight from my chair, if I sit there); playing fetch I throw the
 * ball each time the dog has brought it back.
 */
export function stepOfficeMe(me: OfficeMe, input: MeInput): OfficeMe {
  let next = me;
  if (input.typedAt !== me.typed) {
    next = { ...next, typed: input.typedAt, toType: input.typedAt !== null };
  }
  const seated = next.plan.id === "desk" && next.phase === "stay";
  if (next.toType && seated) {
    next = {
      ...next,
      plan: ME_SPOTS.type,
      since: input.now,
      until: input.now + ME_TYPING_MS,
    };
  }
  const moved = stepPet(next, input, ME_BRAIN) as OfficeMe;
  const toType = moved.plan.id === "type" ? false : moved.toType;
  // A new game of fetch starts counting afresh.
  const playing = moved.plan.id === "fetch";
  let throws = playing ? moved.throws : 0;
  let thrown = playing ? moved.thrown : null;
  let facing = moved.facing;
  if (playing && ballToThrow({ ...moved, throws, thrown }, input)) {
    const to = landing(moved, input);
    if (to) {
      throws += 1;
      thrown = {
        from: { x: moved.x, z: moved.z },
        to,
        at: input.now,
      };
      facing = towards(moved, to);
    }
  }
  return { ...moved, toType, throws, thrown, facing };
}

/** What the pets see of me. */
export function meSightingOf(me: OfficeMe): MeSighting {
  return {
    x: me.x,
    z: me.z,
    planId: me.plan.id,
    staying: me.phase === "stay",
    thrown: me.thrown,
  };
}
