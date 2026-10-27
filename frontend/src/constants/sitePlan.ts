/**
 * Plan of the isometric construction site, the third place (설정 「장소」).
 *
 * Same axes as the office and the airport: +x along the back right edge,
 * +z along the back left edge, y up, the back corner (0, 0) at the top of
 * the screen. The building goes up in the middle towards the back, a floor
 * for each commit, with the tower crane beside it. The site office and its
 * plan table stand on the left, the rest area in the back left corner, the
 * material yard on the right and the excavator in front; the gate opens in
 * the front fence. People work in front of the building, so a straight
 * walk between two spots only has to go round the building to reach the
 * rest area behind it.
 */

export const SITE_WIDTH = 64;
export const SITE_DEPTH = 50;

export interface SiteRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Where a person stands, turned ``facing`` radians about y (0 faces +z). */
export interface SiteSpot {
  x: number;
  z: number;
  facing: number;
}

/** The building's footprint, how tall a floor is and how many it reaches. */
export const BUILDING: SiteRect = { x: 24, z: 10, w: 16, d: 12 };
export const FOUNDATION_HEIGHT = 0.4;
export const FLOOR_HEIGHT = 2;
export const MAX_FLOORS = 11;

/** The tower crane: its base, mast height and jib length. */
export const CRANE = { x: 46, z: 13, mast: 26, jib: 22 };
/** Where the crane picks up a slab in the yard. */
export const SLAB_STACK = { x: 52, z: 33 };

export const SITE_OFFICE: SiteRect = { x: 3, z: 28, w: 10, d: 3 };
export const PLAN_TABLE = { x: 8.5, z: 37 };
export const SCHEDULE_BOARD = { x: 15.5, z: 30.5 };
export const REST_AREA: SiteRect = { x: 3, z: 3, w: 11, d: 10 };
export const YARD: SiteRect = { x: 46, z: 26, w: 15, d: 14 };
export const EXCAVATOR = { x: 20, z: 43 };
/** The gate in the front fence, and where people come in from outside. */
export const GATE = { x: 32, width: 8 };
export const OUTSIDE: SiteSpot = { x: 32, z: SITE_DEPTH + 3, facing: Math.PI };

const FACING_BACK = Math.PI;
const FACING_RIGHT = Math.PI / 2;
const FACING_LEFT = -Math.PI / 2;

/** Where people go for each kind of work, the first free taken first. */
export const WORK_SPOTS = {
  /** Reading: round the plan table by the site office. */
  plans: [
    { x: PLAN_TABLE.x, z: PLAN_TABLE.z - 1.2, facing: 0 },
    { x: PLAN_TABLE.x + 1.6, z: PLAN_TABLE.z, facing: FACING_LEFT },
    { x: PLAN_TABLE.x - 1.6, z: PLAN_TABLE.z, facing: FACING_RIGHT },
    { x: PLAN_TABLE.x, z: PLAN_TABLE.z + 1.2, facing: FACING_BACK },
  ],
  /** Editing: along the building's front, at the scaffold. */
  build: [26, 29, 32, 35, 38].map((x) => ({
    x,
    z: BUILDING.z + BUILDING.d + 1.8,
    facing: FACING_BACK,
  })),
  /** Commands: running the excavator and the generator. */
  machines: [
    { x: EXCAVATOR.x + 3, z: EXCAVATOR.z - 1.5, facing: FACING_LEFT },
    { x: EXCAVATOR.x + 3, z: EXCAVATOR.z + 1.5, facing: FACING_LEFT },
    { x: 42, z: 44, facing: FACING_BACK },
  ],
  /** The web and outside tools: checking deliveries in the yard. */
  yard: [
    { x: 49, z: 38, facing: FACING_BACK },
    { x: 53, z: 38.5, facing: FACING_BACK },
    { x: 57, z: 38, facing: FACING_BACK },
    { x: 49, z: 29, facing: FACING_RIGHT },
  ],
  /** Plans and to-dos: in front of the schedule board. */
  board: [
    {
      x: SCHEDULE_BOARD.x + 1.5,
      z: SCHEDULE_BOARD.z + 1.8,
      facing: FACING_LEFT,
    },
    {
      x: SCHEDULE_BOARD.x + 1.5,
      z: SCHEDULE_BOARD.z + 3.4,
      facing: FACING_LEFT,
    },
    { x: SCHEDULE_BOARD.x + 3, z: SCHEDULE_BOARD.z + 2.6, facing: FACING_LEFT },
  ],
  /** A question for me: beside where I stand. */
  owner: [
    { x: 16.5, z: 44.5, facing: FACING_LEFT },
    { x: 16.5, z: 46.5, facing: FACING_LEFT },
    { x: 18, z: 45.5, facing: FACING_LEFT },
  ],
  /** Resting: on the benches under the tent. */
  rest: [
    { x: 6, z: 6.6, facing: 0 },
    { x: 7.4, z: 6.6, facing: 0 },
    { x: 8.8, z: 6.6, facing: 0 },
    { x: 10.2, z: 6.6, facing: 0 },
    { x: 6, z: 10.4, facing: FACING_BACK },
    { x: 7.4, z: 10.4, facing: FACING_BACK },
  ],
} satisfies Record<string, SiteSpot[]>;

export type WorkSpot = keyof typeof WORK_SPOTS;

/** Me, the owner, watching the building from beside the site office. */
export const OWNER_SPOT: SiteSpot = { x: 14.5, z: 45.5, facing: FACING_RIGHT };

/**
 * Corners in front of the building to walk round it by: a straight line
 * that would cut through the building goes by one of these.
 */
export const DETOURS = [
  { x: BUILDING.x - 4, z: BUILDING.z + BUILDING.d + 3 },
  { x: BUILDING.x + BUILDING.w + 4, z: BUILDING.z + BUILDING.d + 3 },
];

/** Where the camera looks when the view is reset. */
export const SITE_CENTER = { x: SITE_WIDTH / 2, z: SITE_DEPTH / 2 };

/**
 * The construction hoist at the building's front-left corner. Workers who
 * edit code wait at its foot, ride its cage up the scaffold and step off
 * on the roof; on their way anywhere else they ride it down again.
 */
export const HOIST = { x: BUILDING.x - 1, z: BUILDING.z + BUILDING.d + 0.6 };
export const HOIST_FOOT = { x: HOIST.x, z: HOIST.z + 1.8 };
export const HOIST_TOP = {
  x: BUILDING.x + 1.2,
  z: BUILDING.z + BUILDING.d - 1.2,
};
/** How fast the hoist's cage climbs (m/s). */
export const HOIST_SPEED = 2.4;

/** Editing workers on the roof, one over each scaffold spot. */
export const ROOF_SPOTS: SiteSpot[] = WORK_SPOTS.build.map(({ x }) => ({
  x,
  z: BUILDING.z + BUILDING.d - 2.2,
  facing: FACING_BACK,
}));

/** Where the excavator digs, and where it heaps the earth with no truck by. */
export const DIG_PIT = { x: EXCAVATOR.x - 4.5, z: EXCAVATOR.z };
export const DIRT_HEAP = { x: EXCAVATOR.x - 4, z: EXCAVATOR.z - 4.5 };

/** A leg of a truck's drive: to a point, forwards or backing up. */
export interface DriveLeg {
  x: number;
  z: number;
  reverse?: boolean;
}

const IN_LANE = GATE.x - 2;
const OUT_LANE = GATE.x + 2;
const OUTSIDE_Z = SITE_DEPTH + 3.5;

/** Trucks come in up the left of the gate and leave down its right. */
export const TRUCK_START = { x: IN_LANE, z: OUTSIDE_Z, heading: Math.PI };

/**
 * The concrete mixer backs up to the building's right side to pour, and
 * the dump truck backs up beside the excavator to be loaded.
 */
export const MIXER_STOP = {
  x: BUILDING.x + BUILDING.w + 2.5,
  z: BUILDING.z + 8,
};
export const DUMP_STOP = { x: EXCAVATOR.x + 3.5, z: EXCAVATOR.z - 5 };

export const TRUCK_ROUTES: Record<
  "mixer" | "dump",
  { in: DriveLeg[]; out: DriveLeg[] }
> = {
  mixer: {
    in: [
      { x: IN_LANE, z: BUILDING.z + BUILDING.d + 5 },
      { x: MIXER_STOP.x, z: BUILDING.z + BUILDING.d + 5 },
      { x: MIXER_STOP.x, z: MIXER_STOP.z, reverse: true },
    ],
    out: [
      { x: MIXER_STOP.x, z: BUILDING.z + BUILDING.d + 5 },
      { x: OUT_LANE, z: BUILDING.z + BUILDING.d + 5.5 },
      { x: OUT_LANE, z: OUTSIDE_Z },
    ],
  },
  dump: {
    in: [
      { x: IN_LANE, z: DUMP_STOP.z },
      { x: DUMP_STOP.x, z: DUMP_STOP.z, reverse: true },
    ],
    out: [
      { x: IN_LANE + 1, z: DUMP_STOP.z },
      { x: OUT_LANE, z: DUMP_STOP.z + 6 },
      { x: OUT_LANE, z: OUTSIDE_Z },
    ],
  },
};
