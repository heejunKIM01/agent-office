/**
 * The office cat (docs/plan/spec.md 「작업 공간 기믹」), getting about as
 * officePets.ts does. It roams: now and then it ambles to some open bit of
 * floor and looks about, or tears off across the office at a dash, and in
 * between it visits its favourite spots: naps curled up on its tower in the
 * lounge or scratches the tower's post, loafs on the sofa's armrest, washes
 * on the library table, dozes by the warm server racks, sits in its
 * cardboard box, eats at its bowl, sniffs the search room's plant and rubs
 * against Claude's legs while Claude sits at its desk. When the dog sleeps
 * on its bed, the cat may curl up on its back. When Claude has waited on my
 * next prompt a while it heads for my keyboard and lies on it until I type.
 * When I dangle a teaser wand by it (officeMe.ts) it turns to it and leaps
 * at the feather, and while I pat it, it stays put.
 */

import {
  CAT_BOWL,
  CAT_BOX,
  CAT_TOWER,
  CLAUDE_SEAT,
  DOG_BED,
  MY_SEAT,
} from "@/constants/isoFloorPlan";
import type { FloorPoint } from "./isoNavGrid";
import type { MeSighting } from "./officeMe";
import {
  PLAY_PREFIX,
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

/** What it does once there. */
export type CatAct =
  | "sleep"
  | "loaf"
  | "groom"
  | "doze"
  | "eat"
  | "sniff"
  | "rub"
  | "keyboard"
  | "scratch"
  | "box"
  | "look"
  | "snuggle"
  | "hunt"
  | "boop"
  | "play";

export type CatPlan = PetPlan<CatAct>;
export type OfficeCat = Pet<CatAct>;

export interface CatInput extends PetClock {
  /** Claude has waited on my next prompt a while: go lie on my keyboard. */
  napping: boolean;
  claude: ClaudeAt | null;
  dog: PetSighting | null;
  /** Its part in a game with the dog (systems/petPlay.ts), while one goes on. */
  play: CatPlan | null;
  me: MeSighting | null;
}

/** An amble, slower than people, and a dash. */
export const CAT_WALK_SPEED = 1.3;
export const CAT_DASH_SPEED = 3.6;
/** The height of the bed on its tower and of the dog's back (isoFurniture.ts, isoDog.ts). */
const CAT_TOWER_BED = 1.67;
const DOG_BACK = 0.75;
/** Turned this way it faces the camera; this way it shows its side as well. */
const TO_CAMERA = 0.8;
const THREE_QUARTER = 0.15;

const SEARCH_PLANT: FloorPoint = { x: 38.8, z: 20.6 };
const SNIFF_AT: FloorPoint = { x: 38.1, z: 21.3 };
const CLAUDE_RUB: FloorPoint = {
  x: CLAUDE_SEAT.x - 0.8,
  z: CLAUDE_SEAT.z + 0.6,
};
const TOWER_FOOT: FloorPoint = { x: CAT_TOWER.x, z: CAT_TOWER.z + 1.3 };

/** A plan for the cat: ``floor`` to walk to, what to do there and how long. */
export const catPlan = (
  id: string,
  floor: FloorPoint & { facing: number },
  act: CatAct,
  stay: [number, number],
  more: Partial<CatPlan> = {},
): CatPlan => ({
  id,
  floor: { ...floor, y: 0 },
  perch: null,
  act,
  stay,
  speed: CAT_WALK_SPEED,
  ...more,
});

/** Its favourite spots. */
export const CAT_SPOTS = {
  tower: catPlan(
    "tower",
    { ...TOWER_FOOT, facing: Math.PI },
    "sleep",
    [25_000, 45_000],
    {
      perch: {
        x: CAT_TOWER.x,
        y: CAT_TOWER_BED,
        z: CAT_TOWER.z,
        facing: TO_CAMERA,
      },
      rest: true,
    },
  ),
  // Up on its hind legs, clawing the tower's post.
  scratch: catPlan(
    "scratch",
    { ...TOWER_FOOT, facing: Math.PI },
    "scratch",
    [4_000, 6_000],
  ),
  // The armrest at the sofa's left end, beside whoever rests there.
  sofa: catPlan(
    "sofa",
    { x: 2.75, z: 22.75, facing: Math.PI / 2 },
    "loaf",
    [12_000, 20_000],
    {
      perch: { x: 3.41, y: 0.72, z: 22.25, facing: 0 },
      rest: true,
    },
  ),
  library: catPlan(
    "library",
    { x: 7.6, z: 7.6, facing: -2.4 },
    "groom",
    [10_000, 16_000],
    {
      perch: { x: 6.5, y: 0.78, z: 6.7, facing: THREE_QUARTER },
    },
  ),
  // On the floor in front of the racks, where the air is warm.
  server: catPlan(
    "server",
    { x: 34.3, z: 6.7, facing: THREE_QUARTER },
    "doze",
    [15_000, 25_000],
    {
      rest: true,
    },
  ),
  // Into the cardboard box, only its head showing.
  box: catPlan(
    "box",
    { x: CAT_BOX.x, z: CAT_BOX.z + 1.15, facing: Math.PI },
    "box",
    [10_000, 18_000],
    {
      perch: { x: CAT_BOX.x, y: 0.06, z: CAT_BOX.z, facing: TO_CAMERA },
      rest: true,
    },
  ),
  bowl: catPlan(
    "bowl",
    { x: CAT_BOWL.x, z: CAT_BOWL.z - 0.6, facing: 0 },
    "eat",
    [6_000, 9_000],
  ),
  // The plant in the corner of the search room.
  plant: catPlan(
    "plant",
    { ...SNIFF_AT, facing: towards(SNIFF_AT, SEARCH_PLANT) },
    "sniff",
    [3_000, 5_000],
  ),
  claude: catPlan(
    "claude",
    { ...CLAUDE_RUB, facing: towards(CLAUDE_RUB, CLAUDE_SEAT) },
    "rub",
    [5_000, 8_000],
  ),
  // Curled up on the sleeping dog's back.
  snuggle: catPlan(
    "snuggle",
    { x: DOG_BED.x - 1.1, z: DOG_BED.z, facing: Math.PI / 2 },
    "snuggle",
    [15_000, 25_000],
    {
      perch: { x: DOG_BED.x, y: DOG_BACK, z: DOG_BED.z, facing: TO_CAMERA },
      rest: true,
    },
  ),
  // Behind my desk, then up onto the keyboard in front of my chair.
  keyboard: catPlan(
    "keyboard",
    { x: 17.6, z: 18, facing: Math.PI / 2 },
    "keyboard",
    [0, 0],
    {
      perch: {
        x: MY_SEAT.x + 0.85 * Math.sin(MY_SEAT.facing),
        y: 1.01,
        z: MY_SEAT.z + 0.85 * Math.cos(MY_SEAT.facing),
        facing: TO_CAMERA,
      },
      rest: true,
      hold: true,
    },
  ),
} satisfies Record<string, CatPlan>;

export type CatSpotId = keyof typeof CAT_SPOTS;

/** How often it roams the open floor instead of going to a spot, and how often it dashes. */
const ROAM_CHANCE = 0.3;
const DASH_CHANCE = 0.1;

/** The dog lies asleep on its bed: a warm back to curl up on. */
const dogAsleep = (dog: PetSighting | null): boolean =>
  dog !== null && dog.planId === "bed" && dog.phase === "stay";

/** The spots it may go to now, other than where it is. */
export function catChoices(
  from: string,
  input: Pick<CatInput, "claude" | "dog">,
): CatSpotId[] {
  return (Object.keys(CAT_SPOTS) as CatSpotId[]).filter(
    (id) =>
      id !== from &&
      id !== "keyboard" &&
      (id !== "claude" || input.claude?.seated === true) &&
      (id !== "snuggle" || dogAsleep(input.dog)),
  );
}

/** Off across the open floor to look about, now and then at a dash. */
function roam(cat: OfficeCat, input: CatInput): CatPlan | null {
  const to = openSpot(cat, input);
  if (!to) return null;
  const dash = input.random() < DASH_CHANCE;
  return catPlan("roam", { ...to, facing: TO_CAMERA }, "look", [2_000, 5_000], {
    speed: dash ? CAT_DASH_SPEED : CAT_WALK_SPEED,
  });
}

/** I am this close or closer to play with it or pat it (m). */
const PLAY_REACH = 2.4;
const PAT_REACH = 1.4;

/** I stand dangling the teaser wand by it. */
const wandBy = (me: MeSighting | null, cat: FloorPoint): me is MeSighting =>
  me !== null &&
  me.planId === "wand" &&
  me.staying &&
  distance(me, cat) < PLAY_REACH;

/** I crouch beside it patting it. */
export const pattedBy = (me: MeSighting | null, cat: FloorPoint): boolean =>
  me !== null &&
  me.planId === "patCat" &&
  me.staying &&
  distance(me, cat) < PAT_REACH;

/** Where it is, turned to the feather on my wand. */
const play = (cat: OfficeCat, me: FloorPoint): CatPlan =>
  catPlan(
    "play",
    { x: cat.x, z: cat.z, facing: towards(cat, me) },
    "play",
    [0, 0],
    { hold: true },
  );

export const CAT_BRAIN: PetBrain<CatAct, CatInput> = {
  urgent: (cat, input) => {
    if (input.napping) {
      return cat.plan.id !== "keyboard" ? CAT_SPOTS.keyboard : null;
    }
    if (input.play) return cat.plan.id !== input.play.id ? input.play : null;
    const down = cat.y === 0 && cat.phase === "stay";
    if (down && cat.plan.id !== "play" && wandBy(input.me, cat)) {
      return play(cat, input.me);
    }
    return null;
  },
  keeps: (cat, input) => {
    if (cat.plan.id.startsWith(PLAY_PREFIX)) {
      return input.play?.id === cat.plan.id;
    }
    switch (cat.plan.id) {
      case "play":
        return wandBy(input.me, cat);
      case "keyboard":
        return input.napping;
      case "claude":
        return input.claude?.seated === true;
      case "snuggle":
        return dogAsleep(input.dog);
      default:
        return true;
    }
  },
  next: (cat, input) => {
    if (input.random() < ROAM_CHANCE) {
      const roaming = roam(cat, input);
      if (roaming) return roaming;
    }
    const choices = catChoices(cat.plan.id, input);
    return CAT_SPOTS[
      choices[Math.floor(input.random() * choices.length)] ?? "tower"
    ];
  },
};

/** The cat when the office opens: curled up asleep on its tower. */
export const catAt = (
  spot: CatSpotId,
  now: number,
  random: () => number,
): OfficeCat => petAt(CAT_SPOTS[spot], now, random);

/** Move the cat on by ``input.dt``; patted, it stays where it is a while longer. */
export function stepOfficeCat(cat: OfficeCat, input: CatInput): OfficeCat {
  const still =
    cat.phase === "stay" && pattedBy(input.me, cat)
      ? { ...cat, until: Math.max(cat.until, input.now + 1000) }
      : cat;
  return stepPet(still, input, CAT_BRAIN);
}
