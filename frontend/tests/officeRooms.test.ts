/**
 * Office side rooms (archive + server room) against the real navigation grid.
 *
 * Pins the layout contract from docs/plan/spec.md: the rooms are walled except
 * for a door facing the boss desk, every reading/rack spot is reachable from
 * the boss, and the moved queue lines stay walkable and outside the rooms.
 */

import { describe, expect, it } from "vitest";
import { findPath } from "@/systems/astar";
import { NavigationGrid } from "@/systems/navigationGrid";
import {
  ARCHIVE_READING_SPOTS,
  ARCHIVE_ROOM,
  ROOM_DOOR_BOTTOM,
  ROOM_DOOR_TOP,
  SERVER_RACK_SPOTS,
  SERVER_ROOM,
  isInRoom,
} from "@/constants/rooms";
import {
  ARRIVAL_QUEUE_POSITIONS,
  DEPARTURE_QUEUE_POSITIONS,
  ELEVATOR_PATHFINDING_TARGET,
  getDeskPosition,
} from "@/systems/queuePositions";
import type { Position } from "@/types";

const grid = new NavigationGrid();

// Where the boss steps out from behind the desk (just above the desk obstacle)
const BOSS_FRONT: Position = { x: 640, y: 860 };

function walkable(pos: Position): boolean {
  const { gx, gy } = grid.worldToGrid(pos.x, pos.y);
  return grid.isWalkable(gx, gy);
}

function pathTiles(from: Position, to: Position) {
  return findPath(from, to, undefined, grid);
}

describe("office rooms layout", () => {
  it("walls the top of both rooms", () => {
    for (const room of [ARCHIVE_ROOM, SERVER_ROOM]) {
      for (let x = room.left + 16; x < room.right - 16; x += 32) {
        expect(walkable({ x, y: room.top + 8 })).toBe(false);
      }
    }
  });

  it("leaves a door in each inner side partition and walls the rest", () => {
    const archiveWallX = ARCHIVE_ROOM.right - 5;
    const serverWallX = SERVER_ROOM.left + 5;
    for (const x of [archiveWallX, serverWallX]) {
      expect(walkable({ x, y: ROOM_DOOR_BOTTOM - 16 })).toBe(true);
      expect(walkable({ x, y: ROOM_DOOR_BOTTOM + 16 })).toBe(false);
      expect(walkable({ x, y: ROOM_DOOR_TOP - 16 })).toBe(false);
    }
  });

  it("keeps every reading and rack spot walkable", () => {
    for (const spot of [...ARCHIVE_READING_SPOTS, ...SERVER_RACK_SPOTS]) {
      expect(walkable(spot)).toBe(true);
    }
  });

  it("reaches each archive spot from the boss through the archive door", () => {
    const doorGx = grid.worldToGrid(ARCHIVE_ROOM.right - 5, 0).gx;
    for (const spot of ARCHIVE_READING_SPOTS) {
      const tiles = pathTiles(BOSS_FRONT, spot);
      expect(tiles.length).toBeGreaterThan(1);
      const last = tiles[tiles.length - 1];
      expect(last).toEqual(grid.worldToGrid(spot.x, spot.y));
      expect(tiles.some((t) => t.gx === doorGx)).toBe(true);
    }
  });

  it("reaches each rack spot from the boss through the server room door", () => {
    const doorGx = grid.worldToGrid(SERVER_ROOM.left + 5, 0).gx;
    for (const spot of SERVER_RACK_SPOTS) {
      const tiles = pathTiles(BOSS_FRONT, spot);
      expect(tiles.length).toBeGreaterThan(1);
      const last = tiles[tiles.length - 1];
      expect(last).toEqual(grid.worldToGrid(spot.x, spot.y));
      expect(tiles.some((t) => t.gx === doorGx)).toBe(true);
    }
  });
});

describe("queue lines after the room move", () => {
  const slots = [...ARRIVAL_QUEUE_POSITIONS, ...DEPARTURE_QUEUE_POSITIONS];

  it("keeps all 8 slots per line (backend MAX_AGENTS)", () => {
    expect(ARRIVAL_QUEUE_POSITIONS).toHaveLength(8);
    expect(DEPARTURE_QUEUE_POSITIONS).toHaveLength(8);
  });

  it("puts every slot on a walkable tile outside both rooms", () => {
    for (const slot of slots) {
      expect(walkable(slot)).toBe(true);
      expect(isInRoom(ARCHIVE_ROOM, slot)).toBe(false);
      expect(isInRoom(SERVER_ROOM, slot)).toBe(false);
    }
  });

  it("connects the elevator to every slot and every desk", () => {
    const desks = Array.from({ length: 8 }, (_, i) => getDeskPosition(i + 1));
    for (const target of [...slots, ...desks]) {
      expect(
        pathTiles(ELEVATOR_PATHFINDING_TARGET, target).length,
      ).toBeGreaterThan(1);
    }
  });
});
