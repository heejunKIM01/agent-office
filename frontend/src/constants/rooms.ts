/**
 * Office side rooms: the archive (bottom-left) and the server room (bottom-right).
 *
 * Characters walk to the archive to read and to the server room to run
 * commands (see docs/plan/spec.md). Rendering (OfficeRooms) and the navigation
 * grid both read these values, so the walls you see are the walls agents
 * path around.
 *
 * Each room is walled on top by a low partition (a thin cap seen from above
 * plus a front face seen from inside the room) and on its inner side by a
 * partition with a door gap facing the boss desk. Values are tile-aligned
 * (32px) where they feed the navigation grid.
 */

import type { Position } from "@/types";
import { PLANT_POSITION } from "./positions";

export interface RoomBounds {
  /** Left edge (px) */
  left: number;
  /** Right edge (px), exclusive */
  right: number;
  /** Top edge (px) — where the top partition cap starts */
  top: number;
  /** Bottom edge (px), exclusive — the canvas bottom */
  bottom: number;
}

/** Thickness of a partition cap seen from above */
export const ROOM_WALL_CAP = 10;

/** Height of the top partition's front face, seen from inside the room */
export const ROOM_WALL_FACE = 48;

/** Door gap in the inner side partition (tile-aligned: 27*32 .. 30*32) */
export const ROOM_DOOR_TOP = 864;
export const ROOM_DOOR_BOTTOM = 960;

/** Archive (bottom-left). Inner side partition is the right edge. */
export const ARCHIVE_ROOM: RoomBounds = {
  left: 0,
  right: 330,
  top: 784,
  bottom: 1024,
};

/** Server room (bottom-right). Inner side partition is the left edge. */
export const SERVER_ROOM: RoomBounds = {
  left: 950,
  right: 1280,
  top: 784,
  bottom: 1024,
};

/** Y of the floor line furniture stands on (bottom of shelves and racks) */
export const ROOM_FURNITURE_BASE_Y = 900;

/** Bookshelf centers along the archive's top partition */
export const ARCHIVE_SHELF_XS = [58, 162];

/** Server rack centers along the server room's top partition */
export const SERVER_RACK_XS = [1022, 1112, 1202];

/**
 * Where a reader stands in front of each bookshelf (body-center coordinates,
 * same convention as the boss position). The body overlaps the lower shelves
 * so the reader reads as standing in front of them.
 */
export const ARCHIVE_READING_SPOTS: Position[] = ARCHIVE_SHELF_XS.map((x) => ({
  x,
  y: ROOM_FURNITURE_BASE_Y,
}));

/** Where an operator stands in front of each rack (body-center coordinates) */
export const SERVER_RACK_SPOTS: Position[] = SERVER_RACK_XS.map((x) => ({
  x,
  y: ROOM_FURNITURE_BASE_Y,
}));

/** Floor footprint of the archive plant (bottom of the pot) */
export const PLANT_FOOTPRINT = {
  left: PLANT_POSITION.x - 22,
  right: PLANT_POSITION.x + 22,
  top: PLANT_POSITION.y - 15,
  bottom: PLANT_POSITION.y + 31,
};

/** True when a position lies inside a room's bounds */
export function isInRoom(room: RoomBounds, pos: Position): boolean {
  return (
    pos.x >= room.left &&
    pos.x < room.right &&
    pos.y >= room.top &&
    pos.y < room.bottom
  );
}
