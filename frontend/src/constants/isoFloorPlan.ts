/**
 * Floor plan of the isometric office (docs/plan/spec.md "화면 재설계").
 *
 * World units are roughly metres on one floor plate. +x runs along the back
 * right wall (towards the right corner of the screen), +z along the back left
 * wall (towards the left corner), y is up. The back corner (0, 0) is the top
 * of the screen. Positions are read off the reference video: the library sits
 * in the back corner, the meeting room and the lounge down the left wall, the
 * dev room, the elevator and the glass server room along the right wall, my
 * desk in the middle, the search room and the cafe along the front right edge.
 */

export const FLOOR_WIDTH = 40;
export const FLOOR_DEPTH = 31;
export const WALL_HEIGHT = 3.4;
export const LOW_WALL_HEIGHT = 1.7;
export const GLASS_HEIGHT = 2.3;

export type RoomId =
  | "library"
  | "meeting"
  | "lounge"
  | "dev"
  | "server"
  | "search"
  | "cafe"
  | "mydesk";

/** ``plain`` keeps the plate's own tiles. */
export type FloorFinish =
  | "wood"
  | "beige"
  | "meeting"
  | "server"
  | "mint"
  | "checker"
  | "rug"
  | "plain";

/** Axis-aligned area on the floor: x..x+w, z..z+d. */
export interface FloorRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Where a room's name is written: on the floor, or on a back wall. */
export interface RoomLabel {
  ko: string;
  en?: string;
  x: number;
  z: number;
  /** Text runs along this axis. */
  along: "x" | "z";
  on: "floor" | "wall";
}

export interface Room {
  id: RoomId;
  rect: FloorRect;
  finish: FloorFinish;
  label: RoomLabel;
}

export type WallKind = "solid" | "low" | "glass";

/** A straight wall from one floor point to another (axis-aligned). */
export interface Wall {
  from: [number, number];
  to: [number, number];
  kind: WallKind;
}

export type FurnitureKind =
  | "bookshelf"
  | "roundTable"
  | "chair"
  | "officeChair"
  | "longDesk"
  | "imac"
  | "meetingTable"
  | "meetingChair"
  | "whiteboard"
  | "sofa"
  | "armchair"
  | "coffeeTable"
  | "sideTable"
  | "tvStand"
  | "picture"
  | "locker"
  | "serverRack"
  | "kiosk"
  | "globe"
  | "workDesk"
  | "cafeTable"
  | "cafeChair"
  | "receptionDesk"
  | "plant"
  | "bush"
  | "elevator"
  | "clock"
  | "window";

/**
 * One piece of furniture. ``rot`` turns it about y in quarter turns; a piece
 * at ``rot`` 0 faces +z (towards the viewer's left-front).
 */
export interface Furniture {
  kind: FurnitureKind;
  x: number;
  z: number;
  rot?: 0 | 1 | 2 | 3;
  /** Height its base sits at (e.g. a monitor on a desk). */
  y?: number;
}

export const ROOMS: Room[] = [
  {
    id: "library",
    rect: { x: 0, z: 0, w: 11.2, d: 11.3 },
    finish: "wood",
    label: {
      ko: "자료실",
      en: "LIBRARY",
      x: 6.2,
      z: 0,
      along: "x",
      on: "wall",
    },
  },
  {
    id: "meeting",
    rect: { x: 0, z: 11.3, w: 10, d: 9.3 },
    finish: "meeting",
    label: {
      ko: "회의실",
      en: "MEETING",
      x: 0,
      z: 15.5,
      along: "z",
      on: "wall",
    },
  },
  {
    id: "lounge",
    rect: { x: 0, z: 20.6, w: 10.5, d: 10.4 },
    finish: "beige",
    label: {
      ko: "라운지",
      en: "LOUNGE",
      x: 0,
      z: 25.3,
      along: "z",
      on: "wall",
    },
  },
  {
    id: "dev",
    rect: { x: 11.2, z: 0, w: 16, d: 12 },
    finish: "plain",
    label: { ko: "개발실", en: "DEV", x: 19, z: 0, along: "x", on: "wall" },
  },
  {
    id: "server",
    rect: { x: 32.3, z: 0, w: 7.7, d: 11.3 },
    finish: "server",
    label: {
      ko: "서버실",
      en: "SERVER",
      x: 35.8,
      z: 10.4,
      along: "x",
      on: "floor",
    },
  },
  {
    id: "mydesk",
    rect: { x: 14.4, z: 16.2, w: 9, d: 7.3 },
    finish: "rug",
    label: { ko: "내 자리", x: 19.5, z: 24.6, along: "x", on: "floor" },
  },
  {
    id: "search",
    rect: { x: 28, z: 14.3, w: 12, d: 9.3 },
    finish: "mint",
    label: { ko: "정보검색실", x: 33.6, z: 22.8, along: "x", on: "floor" },
  },
  {
    id: "cafe",
    rect: { x: 28, z: 24.8, w: 12, d: 6.2 },
    finish: "checker",
    label: { ko: "카페", x: 33.8, z: 30.3, along: "x", on: "floor" },
  },
];

export const WALLS: Wall[] = [
  // Outer back walls (the two front edges are open, as in the video).
  { from: [0, 0], to: [FLOOR_WIDTH, 0], kind: "solid" },
  { from: [0, 0], to: [0, FLOOR_DEPTH], kind: "solid" },
  // Library: half walls towards the meeting room and the dev room, open
  // at the corner between them.
  { from: [0, 11.3], to: [7.5, 11.3], kind: "low" },
  { from: [11.2, 0], to: [11.2, 6], kind: "low" },
  // Meeting room and lounge divider.
  { from: [0, 20.6], to: [7.5, 20.6], kind: "low" },
  // Server room glass, open towards the elevator.
  { from: [32.3, 0], to: [32.3, 6.9], kind: "glass" },
  { from: [32.3, 11.3], to: [FLOOR_WIDTH, 11.3], kind: "glass" },
];

function row<T>(count: number, make: (i: number) => T): T[] {
  return Array.from({ length: count }, (_, i) => make(i));
}

/** Long desks of the dev room: two rows of iMacs facing the windows. */
const DEV_ROWS = [3.9, 8.3];
const DEV_SEATS_X = row(6, (i) => 14.3 + i * 1.5);

export const FURNITURE: Furniture[] = [
  // Library: shelves along both back walls, a round table in the middle
  ...row(4, (i): Furniture => ({
    kind: "bookshelf",
    x: 2.15 + i * 2.3,
    z: 0.3,
  })),
  ...row(3, (i): Furniture => ({
    kind: "bookshelf",
    x: 0.3,
    z: 2.15 + i * 2.3,
    rot: 1,
  })),
  { kind: "plant", x: 0.7, z: 0.7 },
  { kind: "roundTable", x: 5.9, z: 6.1 },
  { kind: "chair", x: 5.9, z: 4.4 },
  { kind: "chair", x: 5.9, z: 7.8, rot: 2 },
  { kind: "chair", x: 4.2, z: 6.1, rot: 1 },
  { kind: "chair", x: 7.6, z: 6.1, rot: 3 },
  // Meeting room: whiteboard on the wall, a long table with chairs both sides
  { kind: "whiteboard", x: 0.12, z: 15.5, rot: 1 },
  { kind: "meetingTable", x: 6.1, z: 15.9, rot: 1 },
  ...[14.3, 15.9, 17.5].flatMap((z): Furniture[] => [
    { kind: "meetingChair", x: 4.0, z, rot: 1 },
    { kind: "meetingChair", x: 8.2, z, rot: 3 },
  ]),
  { kind: "bush", x: 9.3, z: 12.6 },
  // Lounge: TV cabinet, pictures and a locker on the wall, two sofas
  { kind: "tvStand", x: 0.45, z: 23.3, rot: 1 },
  { kind: "picture", x: 0.12, z: 23.3, rot: 1, y: 1.75 },
  { kind: "locker", x: 0.6, z: 26.7, rot: 1 },
  { kind: "picture", x: 0.12, z: 29.2, rot: 1, y: 1.5 },
  { kind: "sofa", x: 4.9, z: 22.2 },
  { kind: "coffeeTable", x: 4.9, z: 24 },
  { kind: "sofa", x: 5, z: 25.8, rot: 2 },
  { kind: "sideTable", x: 3.4, z: 27.9 },
  { kind: "armchair", x: 7.2, z: 28.5, rot: 2 },
  { kind: "bush", x: 1, z: 29.7 },
  { kind: "plant", x: 9.5, z: 21.8 },
  // Dev room: windows and a clock on the back wall, two rows of iMac desks
  ...[14.6, 18.95, 23.3].map((x): Furniture => ({
    kind: "window",
    x,
    z: 0.05,
  })),
  { kind: "clock", x: 26.8, z: 0.06 },
  ...DEV_ROWS.map((z): Furniture => ({ kind: "longDesk", x: 18.05, z })),
  ...DEV_ROWS.flatMap((z) =>
    DEV_SEATS_X.flatMap((x): Furniture[] => [
      { kind: "imac", x, z: z - 0.3, y: 0.75 },
      { kind: "officeChair", x, z: z + 1.3, rot: 2 },
    ]),
  ),
  { kind: "plant", x: 12.4, z: 0.9 },
  // Elevator between the dev and server rooms
  { kind: "elevator", x: 29.2, z: 0.1 },
  // Server room: two rows of racks behind the glass, a desk by the front
  ...[34.8, 36.8, 38.8].map((x): Furniture => ({
    kind: "serverRack",
    x,
    z: 0.8,
  })),
  ...[35.6, 37.4, 39.2].map((x): Furniture => ({
    kind: "serverRack",
    x,
    z: 5.4,
  })),
  { kind: "workDesk", x: 38.5, z: 9 },
  { kind: "officeChair", x: 38.5, z: 10.2, rot: 2 },
  // My desk: a long reception desk on the blue rug
  { kind: "receptionDesk", x: 18.8, z: 19.7, rot: 1 },
  { kind: "officeChair", x: 17.4, z: 19, rot: 1 },
  { kind: "cafeChair", x: 17.3, z: 21.6, rot: 1 },
  { kind: "plant", x: 14.3, z: 14.4 },
  { kind: "bush", x: 15, z: 23 },
  // Search room: kiosks in a row, a desk and a globe
  ...[30.4, 33.4, 36.5].map((x): Furniture => ({ kind: "kiosk", x, z: 14.8 })),
  { kind: "workDesk", x: 31.6, z: 18.4 },
  { kind: "globe", x: 38.4, z: 14.2 },
  { kind: "plant", x: 38.8, z: 20.6 },
  { kind: "bush", x: 25.2, z: 11.4 },
  { kind: "bush", x: 26.4, z: 13.8 },
  { kind: "bush", x: 27.6, z: 14.6 },
  // Cafe: two tables with three chairs each
  ...[31.3, 35.8].flatMap((x): Furniture[] => [
    { kind: "cafeTable", x, z: 26.8 },
    { kind: "cafeChair", x: x - 1.05, z: 26.8, rot: 1 },
    { kind: "cafeChair", x, z: 27.85, rot: 2 },
    { kind: "cafeChair", x: x + 1.05, z: 26.8, rot: 3 },
  ]),
  { kind: "plant", x: 28.4, z: 30 },
  { kind: "bush", x: 39.2, z: 25.5 },
];

/** Where the camera looks when the view is reset. */
export const FLOOR_CENTER = { x: FLOOR_WIDTH / 2, z: FLOOR_DEPTH / 2 };
