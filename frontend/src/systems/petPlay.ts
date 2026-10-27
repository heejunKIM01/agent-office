/**
 * The office cat and dog playing together (docs/plan/spec.md 「작업 공간
 * 기믹」), each in its own way. Now and then, when both are up and about on
 * the floor near each other, a game starts:
 *
 * - tag: the dog bows to the cat to ask it to play, the cat dashes off with
 *   the dog after it and leaps up onto its tower, out of reach; the dog
 *   sits at the foot looking up, wagging.
 * - tail: the dog lies down swishing its tail and the cat creeps up behind
 *   it, wiggles and pounces on the tail, again and again.
 * - boop: they walk up to each other and touch noses, a heart over each.
 * - snub: the dog bows to ask, and the cat turns its back and washes.
 *
 * The director gives each pet its part as a plan it holds until the game
 * ends (officeCat.ts, officeDog.ts take it ahead of anything but being
 * called to my desk, to a newcomer or to someone upset). `stepPlay` is
 * pure: the clock, the dice and the floor are passed in.
 */

import type { FloorPoint } from "./isoNavGrid";
import { CAT_DASH_SPEED, CAT_SPOTS, catPlan, type CatPlan } from "./officeCat";
import { dogPlan, type DogPlan } from "./officeDog";
import {
  PLAY_PREFIX,
  besidePoint,
  distance,
  openSpot,
  towards,
  type PetClock,
  type PetSighting,
} from "./officePets";

export type PlayGame = "tag" | "tail" | "boop" | "snub";

export interface Playdate {
  game: PlayGame;
  /** Tells this game's plans from the last one's. */
  serial: number;
  /** Tag starts with the bow, then the run; the rest have one stage. */
  stage: "bow" | "play";
  stageSince: number;
  /** When each first got where its part put it this stage (ms). */
  catThere: number | null;
  dogThere: number | null;
  cat: CatPlan;
  dog: DogPlan;
}

export interface PlayState {
  date: Playdate | null;
  /** When to look for a chance to play next (ms). */
  nextCheck: number;
  serial: number;
}

export interface PlayInput extends PetClock {
  cat: PetSighting | null;
  dog: PetSighting | null;
  /** Claude has waited on my next prompt a while: both go to my desk. */
  napping: boolean;
}

export const NO_PLAY: PlayState = { date: null, nextCheck: 0, serial: 0 };

/** How often to look for a chance to play, and how likely one starts (ms). */
const CHECK_MS = 12_000;
const START_CHANCE = 0.5;
/** After a game, a rest before the next (ms). */
const COOLDOWN_MS = 40_000;
/** They play only this close to each other (m). */
const PLAY_REACH = 14;
/** Each takes its part within this long, or the game is off (ms). */
const JOIN_MS = 4_000;
/** No stage lasts longer than this (ms). */
const STAGE_MS = 30_000;
/** Once both are in place, a stage goes on this long (ms). */
const LASTS: Record<PlayGame, number> = {
  tag: 4_000,
  tail: 7_000,
  boop: 3_000,
  snub: 3_000,
};
const BOW_MS = 1_500;
/** The games, likeliest first, and how likely each is. */
const GAMES: [PlayGame, number][] = [
  ["tag", 0.3],
  ["tail", 0.25],
  ["boop", 0.25],
  ["snub", 0.2],
];
/** Turned these ways they show their sides to the camera. */
const SIDE_ON = [(3 * Math.PI) / 4, -Math.PI / 4];
/** The dog chases a little slower than the cat flees, so stays behind (m/s). */
const CHASE_SPEED = 3.3;

/** Up and about on the floor: not asleep, perched or called elsewhere. */
function catFree(cat: PetSighting | null): cat is PetSighting {
  return (
    cat !== null &&
    cat.y === 0 &&
    cat.phase !== "stretch" &&
    !["sleep", "doze", "snuggle", "keyboard", "hop"].includes(cat.act)
  );
}

function dogFree(dog: PetSighting | null): dog is PetSighting {
  return (
    dog !== null &&
    dog.y === 0 &&
    dog.phase !== "stretch" &&
    dog.act !== "sleep" &&
    !["myChair", "comfort", "greet", "zoomies"].includes(dog.planId)
  );
}

const unit = (facing: number): FloorPoint => ({
  x: Math.sin(facing),
  z: Math.cos(facing),
});
const along = (from: FloorPoint, facing: number, by: number): FloorPoint => ({
  x: from.x + unit(facing).x * by,
  z: from.z + unit(facing).z * by,
});

/** What both play, worked out where they are; null when there is no room. */
function parts(
  game: PlayGame,
  stage: Playdate["stage"],
  serial: number,
  cat: PetSighting,
  dog: PetSighting,
  input: PetClock,
): { cat: CatPlan; dog: DogPlan } | null {
  const id = (who: string) => `${PLAY_PREFIX}${game}:${serial}:${stage}:${who}`;
  const hold = { hold: true };
  const at = { x: cat.x, z: cat.z };
  if (game === "boop") {
    // Nose to nose, side on to the camera.
    for (const facing of SIDE_ON) {
      const dogAt = along(at, facing, 1.3);
      if (!input.walkable(dogAt)) continue;
      return {
        cat: catPlan(id("cat"), { ...at, facing }, "boop", [0, 0], hold),
        dog: dogPlan(
          id("dog"),
          { ...dogAt, facing: facing + Math.PI },
          "boop",
          [0, 0],
          hold,
        ),
      };
    }
    return null;
  }
  if (game === "tail") {
    // The dog lies where it is; the cat crouches behind its tail.
    for (const facing of SIDE_ON) {
      const catAt = along(dog, facing, -1.7);
      if (!input.walkable(catAt)) continue;
      return {
        cat: catPlan(id("cat"), { ...catAt, facing }, "hunt", [0, 0], hold),
        dog: dogPlan(
          id("dog"),
          { x: dog.x, z: dog.z, facing },
          "tease",
          [0, 0],
          hold,
        ),
      };
    }
    return null;
  }
  if (game === "snub" || stage === "bow") {
    // The dog bows a little way off; the cat watches it, or turns its back.
    const bowAt = besidePoint(at, 1.8, input);
    if (!bowAt) return null;
    const toDog = towards(at, bowAt);
    const snub = game === "snub";
    return {
      cat: catPlan(
        id("cat"),
        { ...at, facing: snub ? toDog + Math.PI : toDog },
        snub ? "groom" : "look",
        [0, 0],
        hold,
      ),
      dog: dogPlan(
        id("dog"),
        { ...bowAt, facing: towards(bowAt, at) },
        "play",
        [0, 0],
        hold,
      ),
    };
  }
  // Tag: off round a couple of points near, then up the tower and out of reach.
  const first = openSpot(at, input, at, 4);
  const second = first && openSpot(first, input, first, 4);
  const tower = CAT_SPOTS.tower;
  const below = besidePoint(tower.floor, 1.1, input);
  if (!first || !second || !below) return null;
  const via = [first, second];
  return {
    cat: catPlan(id("cat"), tower.floor, "look", [0, 0], {
      ...hold,
      perch: tower.perch,
      speed: CAT_DASH_SPEED,
      via,
    }),
    dog: dogPlan(
      id("dog"),
      { ...below, facing: towards(below, tower.floor) },
      "lookUp",
      [0, 0],
      {
        ...hold,
        speed: CHASE_SPEED,
        via,
      },
    ),
  };
}

function pickGame(random: () => number): PlayGame {
  let roll = random();
  for (const [game, chance] of GAMES) {
    if (roll < chance) return game;
    roll -= chance;
  }
  return "boop";
}

/** Whether ``pet`` is where its part puts it, staying. */
const there = (pet: PetSighting | null, part: { id: string }): boolean =>
  pet !== null && pet.planId === part.id && pet.phase === "stay";
const onPart = (pet: PetSighting | null, part: { id: string }): boolean =>
  pet !== null && pet.planId === part.id;

/** Start, move on or end the game for this moment. */
export function stepPlay(state: PlayState, input: PlayInput): PlayState {
  const { now, cat, dog } = input;
  const date = state.date;
  if (!date) {
    if (now < state.nextCheck) return state;
    const waited = { ...state, nextCheck: now + CHECK_MS };
    if (input.napping || !catFree(cat) || !dogFree(dog)) return waited;
    if (distance(cat, dog) > PLAY_REACH) return waited;
    if (input.random() >= START_CHANCE) return waited;
    const game = pickGame(input.random);
    const stage = game === "tag" ? "bow" : "play";
    const serial = state.serial + 1;
    const roles = parts(game, stage, serial, cat, dog, input);
    if (!roles) return waited;
    return {
      nextCheck: waited.nextCheck,
      serial,
      date: {
        game,
        serial,
        stage,
        stageSince: now,
        catThere: null,
        dogThere: null,
        ...roles,
      },
    };
  }
  const over: PlayState = {
    ...state,
    date: null,
    nextCheck: now + COOLDOWN_MS,
  };
  const since = now - date.stageSince;
  // Called away (to my desk, a newcomer, someone upset) or never came: off.
  const missing =
    since > JOIN_MS && (!onPart(cat, date.cat) || !onPart(dog, date.dog));
  if (input.napping || missing || since > STAGE_MS) return over;
  const catThere = date.catThere ?? (there(cat, date.cat) ? now : null);
  const dogThere = date.dogThere ?? (there(dog, date.dog) ? now : null);
  const both = catThere !== null && dogThere !== null;
  const lasts = date.stage === "bow" ? BOW_MS : LASTS[date.game];
  if (!both || now - Math.max(catThere, dogThere) < lasts) {
    return { ...state, date: { ...date, catThere, dogThere } };
  }
  if (date.stage === "bow" && cat && dog) {
    // The bow is answered: the cat runs, the dog after it.
    const roles = parts(date.game, "play", date.serial, cat, dog, input);
    if (!roles) return over;
    return {
      ...state,
      date: {
        ...date,
        ...roles,
        stage: "play",
        stageSince: now,
        catThere: null,
        dogThere: null,
      },
    };
  }
  return over;
}
