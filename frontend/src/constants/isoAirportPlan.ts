/**
 * Plan of the isometric airport, the office's other place (설정 「장소」).
 *
 * Same axes as the office (constants/isoFloorPlan.ts): +x along the back
 * right edge (east), +z along the back left edge (south), y up, the back
 * corner (0, 0) at the top of the screen. The terminal runs along the back
 * with its gates facing the apron, the tower and the hangar stand east of
 * it, and three parallel runways run east-west across the front half of
 * the field, each farther one longer at both ends. Taxiway A runs between
 * the apron and the runways; each runway has a link from it at its west
 * end (to take off towards the east) and an exit at its east end, and the
 * links of the farther runways pass round the ends of the nearer ones, so
 * no plane crosses a runway on the ground. Planes circle the whole field
 * on a rounded rectangle.
 */

/** Axis-aligned area on the ground: x..x+w, z..z+d. */
export interface AirRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Where a person stands or sits, turned ``facing`` radians about y (0 faces +z). */
export interface AirSpot {
  x: number;
  z: number;
  facing: number;
}

export const AIRPORT_WIDTH = 120;
export const AIRPORT_DEPTH = 89;

export interface Runway {
  /** Its two ends' names, west end first: 09L/27R and so on. */
  names: [string, string];
  /** Centre line. */
  z: number;
  /** The paved strip from ``west`` to ``east``. */
  west: number;
  east: number;
  /** The link to it from taxiway A at its west end, and its exit at the east end. */
  linkX: number;
  exitX: number;
}

export const RUNWAY_WIDTH = 6.5;

const runway = (
  names: [string, string],
  z: number,
  west: number,
  east: number,
): Runway => ({ names, z, west, east, linkX: west - 4, exitX: east + 4 });

/** North (towards the terminal) is -z, so 09L is the nearest. */
export const RUNWAYS: Runway[] = [
  runway(["09L", "27R"], 51, 30, 88),
  runway(["09C", "27C"], 63, 22, 96),
  runway(["09R", "27L"], 75, 14, 104),
];

/** Taxiway A: its centre line, and its strip from the westmost link to the eastmost exit. */
export const TAXIWAY_Z = 37;
export const TAXIWAY: AirRect = {
  x: 8.6,
  z: TAXIWAY_Z - 1.4,
  w: 100.8,
  d: 2.8,
};

/** Concrete in front of the terminal where planes park at their gates. */
export const APRON: AirRect = { x: 5, z: 13, w: 68, d: 22.6 };

/** The terminal: back walls, a glass front facing the apron. */
export const TERMINAL: AirRect = { x: 4, z: 2, w: 66, d: 11 };
export const TERMINAL_HEIGHT = 3.4;

/** Gate stands, nose towards the terminal: where a parked plane's centre is. */
export const GATE_XS = [12, 20.5, 29, 37.5, 46, 54.5, 63];
export const GATE_Z = 23.5;

/** The hangar in the back right corner, open towards the field. */
export const HANGAR: AirRect = { x: 90, z: 2, w: 20, d: 15 };
export const HANGAR_HEIGHT = 6;

/** The control tower: its shaft, and its glass cab on top. */
export const TOWER = { x: 80, z: 24, shaft: 3, cabFloor: 8.4, cab: 5.4 };

/** The controller (Claude) at the console, facing the runways. */
export const CONTROLLER_SEAT: AirSpot = {
  x: TOWER.x,
  z: TOWER.z - 0.6,
  facing: 0,
};
/** The controller's console in the cab. */
export const CONSOLE = { x: TOWER.x, z: TOWER.z + 1.25 };

/** Me, the gate agent, behind a podium by the glass facing the apron. */
export const GATE_AGENT_SPOT: AirSpot = { x: 33.25, z: 10.7, facing: 0 };
export const PODIUM = { x: 33.25, z: 11.6 };

/** Two fire trucks either side of taxiway A past the apron, for the water salute. */
export const FIRE_TRUCKS = [
  { x: 76, z: 31.8 },
  { x: 76, z: 42.2 },
];

/** Height planes circle at, one lane above another. */
export const CIRCUIT_ALTITUDE = 8.5;
export const CIRCUIT_LANE_STEP = 1.7;
export const CIRCUIT_LANES = 3;
/**
 * The circuit round the field: a rectangle from ``left`` to ``right`` and
 * ``top`` to ``bottom`` with corners of ``corner`` radius. Planes fly it
 * west along the top (over the terminal), south down the left, east along
 * the bottom and north up the right.
 */
export const CIRCUIT = { left: 6, right: 114, top: 8, bottom: 83, corner: 8 };

/** Where the camera looks when the view is reset. */
export const AIRPORT_CENTER = { x: AIRPORT_WIDTH / 2, z: AIRPORT_DEPTH / 2 };
