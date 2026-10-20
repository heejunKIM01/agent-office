/**
 * Floor plan of the isometric office (docs/plan/spec.md "화면 재설계").
 *
 * World units are roughly metres on one floor plate. +x runs along the back
 * right wall (towards the right corner of the screen), +z along the back left
 * wall (towards the left corner), y is up. The back corner (0, 0) is the top
 * of the screen. Positions follow the reference video: the library sits in
 * the back corner, meeting room and lounge down the left wall, the dev room
 * and the elevator on the right wall, the server room in the right corner,
 * my desk in the middle, the search room and the cafe at the front.
 */

export const FLOOR_WIDTH = 40;
export const FLOOR_DEPTH = 32;
export const WALL_HEIGHT = 2.6;
export const LOW_WALL_HEIGHT = 1.0;
export const GLASS_HEIGHT = 2.2;

export type RoomId =
  | "library"
  | "meeting"
  | "lounge"
  | "dev"
  | "server"
  | "search"
  | "cafe"
  | "mydesk";

export type FloorFinish =
  "wood" | "beige" | "meeting" | "server" | "mint" | "checker" | "rug";

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
  | "serverRack"
  | "kiosk"
  | "globe"
  | "workDesk"
  | "cafeTable"
  | "cafeChair"
  | "receptionDesk"
  | "plant"
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
    rect: { x: 0, z: 0, w: 14, d: 11 },
    finish: "wood",
    label: { ko: "자료실", en: "LIBRARY", x: 7, z: 0, along: "x", on: "wall" },
  },
  {
    id: "meeting",
    rect: { x: 0, z: 12, w: 9, d: 7 },
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
    rect: { x: 0, z: 20, w: 10, d: 12 },
    finish: "beige",
    label: { ko: "라운지", en: "LOUNGE", x: 0, z: 26, along: "z", on: "wall" },
  },
  {
    id: "dev",
    rect: { x: 15, z: 0, w: 16, d: 12 },
    finish: "meeting",
    label: { ko: "개발실", en: "DEV", x: 23, z: 0, along: "x", on: "wall" },
  },
  {
    id: "server",
    rect: { x: 33, z: 3, w: 7, d: 11 },
    finish: "server",
    label: {
      ko: "서버실",
      en: "SERVER",
      x: 36.5,
      z: 15,
      along: "x",
      on: "floor",
    },
  },
  {
    id: "mydesk",
    rect: { x: 12, z: 15, w: 8, d: 6 },
    finish: "rug",
    label: { ko: "내 자리", x: 13, z: 20.3, along: "x", on: "floor" },
  },
  {
    id: "search",
    rect: { x: 22, z: 17, w: 11, d: 11 },
    finish: "mint",
    label: { ko: "정보검색실", x: 27.5, z: 27.2, along: "x", on: "floor" },
  },
  {
    id: "cafe",
    rect: { x: 12, z: 25, w: 10, d: 7 },
    finish: "checker",
    label: { ko: "카페", x: 17, z: 31.4, along: "x", on: "floor" },
  },
];

export const WALLS: Wall[] = [
  // Outer back walls (the two front edges are open, as in the video).
  { from: [0, 0], to: [FLOOR_WIDTH, 0], kind: "solid" },
  { from: [0, 0], to: [0, FLOOR_DEPTH], kind: "solid" },
  // Library: wall to the meeting room, low divider towards the dev room.
  { from: [0, 11], to: [6, 11], kind: "solid" },
  { from: [14, 0], to: [14, 4], kind: "low" },
  // Meeting room front divider.
  { from: [9, 12], to: [9, 16], kind: "low" },
  // Lounge divider from the meeting room.
  { from: [0, 20], to: [4, 20], kind: "low" },
  // Server room glass, with a gap for the door.
  { from: [33, 3], to: [33, 14], kind: "glass" },
  { from: [33, 14], to: [36, 14], kind: "glass" },
  { from: [37.6, 14], to: [FLOOR_WIDTH, 14], kind: "glass" },
];

function row<T>(count: number, make: (i: number) => T): T[] {
  return Array.from({ length: count }, (_, i) => make(i));
}

/** Long desks of the dev room: three rows of iMacs facing the windows. */
const DEV_ROWS = [3.4, 6.8, 10.2];
const DEV_SEATS_X = row(6, (i) => 17.4 + i * 2);

export const FURNITURE: Furniture[] = [
  // Library
  ...row(4, (i): Furniture => ({ kind: "bookshelf", x: 2 + i * 2.8, z: 0.45 })),
  ...row(3, (i): Furniture => ({
    kind: "bookshelf",
    x: 0.45,
    z: 2.4 + i * 2.8,
    rot: 1,
  })),
  { kind: "roundTable", x: 7.5, z: 6 },
  { kind: "chair", x: 7.5, z: 4.8 },
  { kind: "chair", x: 7.5, z: 7.2, rot: 2 },
  { kind: "chair", x: 6.3, z: 6, rot: 3 },
  { kind: "chair", x: 8.7, z: 6, rot: 1 },
  { kind: "plant", x: 13, z: 1.2 },
  // Meeting room
  { kind: "whiteboard", x: 0.12, z: 15.5, rot: 1 },
  { kind: "meetingTable", x: 4.6, z: 15.5 },
  ...row(3, (i): Furniture => ({
    kind: "meetingChair",
    x: 3.4 + i * 1.2,
    z: 14.2,
  })),
  ...row(3, (i): Furniture => ({
    kind: "meetingChair",
    x: 3.4 + i * 1.2,
    z: 16.8,
    rot: 2,
  })),
  // Lounge
  { kind: "tvStand", x: 0.5, z: 25, rot: 1 },
  { kind: "sofa", x: 5.2, z: 23.4 },
  { kind: "sofa", x: 5.2, z: 27.4, rot: 2 },
  { kind: "coffeeTable", x: 5.2, z: 25.4 },
  { kind: "armchair", x: 8.2, z: 25.4, rot: 3 },
  { kind: "sideTable", x: 2.4, z: 29.5 },
  { kind: "plant", x: 1, z: 30.8 },
  // Dev room: windows on the back wall, rows of desks with iMacs
  ...row(5, (i): Furniture => ({ kind: "window", x: 16.5 + i * 2.8, z: 0.05 })),
  { kind: "clock", x: 30.4, z: 0.06 },
  ...DEV_ROWS.map((z): Furniture => ({ kind: "longDesk", x: 22.4, z })),
  ...DEV_ROWS.flatMap((z) =>
    DEV_SEATS_X.flatMap((x): Furniture[] => [
      { kind: "imac", x, z: z - 0.25, y: 0.75, rot: 0 },
      { kind: "officeChair", x, z: z + 0.75, rot: 2 },
    ]),
  ),
  { kind: "plant", x: 15.6, z: 1.1 },
  // Elevator between the dev and server rooms
  { kind: "elevator", x: 32, z: 0.1 },
  // Server room
  ...row(3, (i): Furniture => ({
    kind: "serverRack",
    x: 35,
    z: 5.2 + i * 2.6,
    rot: 1,
  })),
  ...row(3, (i): Furniture => ({
    kind: "serverRack",
    x: 38.4,
    z: 5.2 + i * 2.6,
    rot: 3,
  })),
  // My desk on the blue rug
  { kind: "receptionDesk", x: 16, z: 18.6 },
  { kind: "officeChair", x: 15, z: 17.2 },
  { kind: "chair", x: 13.4, z: 19.6 },
  { kind: "plant", x: 12.6, z: 15.6 },
  // Search room
  ...row(3, (i): Furniture => ({
    kind: "kiosk",
    x: 26 + i * 2.6,
    z: 19 + i * 1.6,
  })),
  { kind: "workDesk", x: 24.6, z: 24.4 },
  { kind: "globe", x: 31.6, z: 25.8 },
  // Cafe
  { kind: "cafeTable", x: 14.6, z: 27.4 },
  { kind: "cafeChair", x: 14.6, z: 26.5 },
  { kind: "cafeChair", x: 14.6, z: 28.3, rot: 2 },
  { kind: "cafeTable", x: 18.6, z: 27.4 },
  { kind: "cafeChair", x: 17.7, z: 27.4, rot: 3 },
  { kind: "cafeChair", x: 19.5, z: 27.4, rot: 1 },
  { kind: "cafeTable", x: 16.6, z: 30.2 },
  { kind: "cafeChair", x: 16.6, z: 29.3 },
  { kind: "cafeChair", x: 15.7, z: 30.2, rot: 3 },
  { kind: "cafeChair", x: 17.5, z: 30.2, rot: 1 },
  // Plants around the open floor
  { kind: "plant", x: 11.2, z: 13 },
  { kind: "plant", x: 21, z: 14 },
  { kind: "plant", x: 20.8, z: 21.8 },
  { kind: "plant", x: 32.6, z: 16 },
  { kind: "plant", x: 11, z: 24 },
  { kind: "plant", x: 22.8, z: 30.4 },
  { kind: "plant", x: 33.8, z: 29 },
];

/** Where the camera looks when the view is reset. */
export const FLOOR_CENTER = { x: FLOOR_WIDTH / 2, z: FLOOR_DEPTH / 2 };
