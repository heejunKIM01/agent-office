/**
 * Plan of the isometric reservoir fishing spot, the fourth place
 * (설정 「장소」 · 낚시터).
 *
 * Same axes as the other places: +x along the back right edge, +z along
 * the back left edge, y up, the back corner (0, 0) at the top of the
 * screen. The reservoir fills the middle, with wooded hills along the back
 * and the dam's embankment down the right. On the left bank stand the rest
 * platform (평상), a tent and a campfire; along the front bank run the fishing deck with
 * its numbered seats, the management office with its shop counter, the
 * catch board and the fish tank, and the chalkboard. A pontoon (부교) runs
 * out from the front bank to two floating huts (좌대), the near one mine.
 * People walk only on the banks, the deck, the pontoon and the huts.
 */

export const FISHING_WIDTH = 64;
export const FISHING_DEPTH = 50;

/** The water's surface, below the bank's top at y = 0. */
export const WATER_Y = -0.6;

export interface FishingRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Where a person stands, turned ``facing`` radians about y (0 faces +z). */
export interface FishingSpot {
  x: number;
  z: number;
  facing: number;
}

/** The banks people walk on: down the left, and across the front. */
export const BANK_WEST: FishingRect = { x: 0, z: 4, w: 12, d: 46 };
export const BANK_FRONT: FishingRect = { x: 12, z: 33, w: 52, d: 17 };
/** Wooded hills along the back, and the dam's embankment down the right. */
export const HILLS: FishingRect = { x: 0, z: 0, w: 64, d: 4 };
export const EMBANKMENT: FishingRect = { x: 58, z: 4, w: 6, d: 29 };
/** The reservoir. */
export const WATER: FishingRect = { x: 12, z: 4, w: 46, d: 29 };

/** The fishing deck along the front bank, out over the water. */
export const DECK: FishingRect = { x: 14, z: 31.4, w: 22, d: 1.7 };
/** The pontoon from the front bank out to the huts, and its T at the end. */
export const PONTOON: FishingRect = { x: 41, z: 11, w: 2, d: 22.6 };
export const PONTOON_END: FishingRect = { x: 40, z: 10.8, w: 4.4, d: 2.2 };
/** The floating huts (좌대): mine to the east, a fishing one to the west. */
export const HUT_A: FishingRect = { x: 43, z: 22, w: 6, d: 5 };
export const HUT_B: FishingRect = { x: 35, z: 15, w: 6, d: 5 };
/** Each hut's cabin, on its back half. */
export const CABIN_A: FishingRect = { x: 44.5, z: 22, w: 4.5, d: 2.2 };
export const CABIN_B: FishingRect = { x: 35, z: 15, w: 4.5, d: 1.8 };

/** Ground people can stand and walk on. */
export const WALKABLE: readonly FishingRect[] = [
  BANK_WEST,
  BANK_FRONT,
  DECK,
  PONTOON,
  PONTOON_END,
  HUT_A,
  HUT_B,
];

/** The management office, its shop counter on the front. */
export const OFFICE: FishingRect = { x: 2, z: 37, w: 12, d: 5 };
export const TANK: FishingRect = { x: 2.5, z: 45, w: 5, d: 2 };
/** The chalkboard of the day's to-dos, facing the bank. */
export const CHALKBOARD = { x: 20.2, z: 38, width: 5.6 };
/** The rest platform (평상) on the left bank, and the tent behind it. */
export const REST_DECK: FishingRect = { x: 2.5, z: 24.5, w: 6, d: 3 };
export const TENT = { x: 5, z: 20 };
/** The campfire in front of the rest platform, lit at night. */
export const CAMPFIRE = { x: 3, z: 30.6 };
/** The shrimp net off the pontoon's end. */
export const NET = { x: 42, z: 9.2 };
/** The office's rowing boat, tied up beside the pontoon. */
export const BOAT = { x: 37.4, z: 29.9, length: 3.6, beam: 1.6 };
export const PARKING: FishingRect = { x: 44, z: 40, w: 12, d: 8 };

/** In the way of a walk, on top of the water's edges. */
export const OBSTACLES: readonly FishingRect[] = [
  OFFICE,
  TANK,
  CABIN_A,
  CABIN_B,
  { x: CHALKBOARD.x - 2.8, z: CHALKBOARD.z - 0.4, w: 5.6, d: 0.8 },
  { x: REST_DECK.x, z: REST_DECK.z, w: REST_DECK.w, d: 1.7 },
  { x: TENT.x - 2, z: TENT.z - 2, w: 4, d: 4 },
  { x: CAMPFIRE.x - 0.8, z: CAMPFIRE.z - 0.8, w: 1.6, d: 1.6 },
];

/** The entrance in the front edge, and where people come in from outside. */
export const ENTRANCE = { x: 30, width: 5 };
export const OUTSIDE: FishingSpot = {
  x: ENTRANCE.x,
  z: FISHING_DEPTH + 3,
  facing: Math.PI,
};
export const ENTRANCE_INSIDE = { x: ENTRANCE.x, z: FISHING_DEPTH - 2.5 };

const FACING_BACK = Math.PI;
const FACING_RIGHT = Math.PI / 2;
const FACING_LEFT = -Math.PI / 2;

/**
 * Where people go for each kind of work, the first free taken first. The
 * camera looks along the diagonal, so the places at one spot differ in
 * x − z by a unit or more and nobody sits right behind another.
 */
export const WORK_SPOTS = {
  /** Reading: on the pontoon, looking into the water for a spot. */
  pontoon: [31.2, 28.6, 21.2].map((z) => ({ x: 41.6, z, facing: FACING_LEFT })),
  /** Editing: in the seats on the deck, then on the west hut. */
  seats: [
    ...[16, 20, 24, 28, 32].map((x) => ({ x, z: 32.2, facing: FACING_BACK })),
    { x: 36.6, z: 19.3, facing: 0 },
    { x: 39.2, z: 19.3, facing: 0 },
  ],
  /** Commands: the shrimp net off the pontoon's end. */
  net: [
    { x: 42, z: 11.4, facing: FACING_BACK },
    { x: 40.6, z: 12.5, facing: FACING_LEFT },
    { x: 43.8, z: 12, facing: FACING_RIGHT },
  ],
  /** The web and outside tools: buying bait at the office's counter. */
  shop: [
    { x: 10.6, z: 43.4, facing: FACING_BACK },
    { x: 12.6, z: 43.4, facing: FACING_BACK },
    { x: 15.2, z: 40.2, facing: FACING_LEFT },
  ],
  /** Plans and to-dos: in front of the chalkboard. */
  board: [
    { x: 18.8, z: 39.6, facing: FACING_BACK },
    { x: 20.6, z: 39.9, facing: FACING_BACK },
    { x: 22.4, z: 39.6, facing: FACING_BACK },
  ],
  /** A question for me: on my hut, beside my chair. */
  guest: [
    { x: 45, z: 26.4, facing: FACING_RIGHT },
    { x: 46.3, z: 25, facing: 0.9 },
  ],
  /** Resting: on the edge of the rest platform. */
  rest: [3.6, 5.6, 7.6].map((x) => ({ x, z: 27.2, facing: 0 })),
  /** The boss's own place: at the office door. */
  office: [{ x: 6.2, z: 43.6, facing: 0 }],
} satisfies Record<string, FishingSpot[]>;

export type FishingWorkSpot = keyof typeof WORK_SPOTS;

/** Me, the guest, fishing from the front of my hut. */
export const GUEST_SPOT: FishingSpot = { x: 47.6, z: 26, facing: 0 };

/**
 * Turning points for walks a straight line cannot make: the corner of the
 * banks, round the office and the chalkboard, the pontoon's root, where it
 * meets each hut and its T at the end, and the entrance.
 */
export const WAYPOINTS = [
  { x: 11.2, z: 34.2 },
  { x: 15.4, z: 44.4 },
  { x: 15.4, z: 35.6 },
  { x: 42, z: 34.4 },
  { x: 42, z: 25.4 },
  { x: 42, z: 18.2 },
  { x: 42, z: 12.4 },
  ENTRANCE_INSIDE,
];

/** Where the camera looks when the view is reset. */
export const FISHING_CENTER = { x: FISHING_WIDTH / 2, z: FISHING_DEPTH / 2 };
