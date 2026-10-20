/**
 * OfficeRooms Component
 *
 * Renders the two side rooms characters walk to (docs/plan/spec.md):
 * - Archive (bottom-left): parquet floor, bookshelves, room sign
 * - Server room (bottom-right): raised floor, server racks with blinking LEDs,
 *   and a console on the first rack that scrolls while a command runs
 *
 * Everything here is static floor/wall/furniture art drawn below the Y-sorted
 * character layer, so characters standing in front of a shelf or rack overlap
 * its lower part. Geometry comes from constants/rooms.ts, which also feeds the
 * navigation grid.
 */

"use client";

import { memo, useCallback, useRef, useState, type ReactNode } from "react";
import { useTick } from "@pixi/react";
import { Graphics } from "pixi.js";
import {
  ARCHIVE_ROOM,
  ARCHIVE_SHELF_XS,
  ROOM_DOOR_BOTTOM,
  ROOM_DOOR_TOP,
  ROOM_FURNITURE_BASE_Y,
  ROOM_WALL_CAP,
  ROOM_WALL_FACE,
  SERVER_RACK_XS,
  SERVER_ROOM,
  type RoomBounds,
} from "@/constants/rooms";
import { useTranslation } from "@/hooks/useTranslation";

// ============================================================================
// CONSTANTS
// ============================================================================

const SIDE_WALL_WIDTH = 10;

// Wall colors match the back wall in OfficeBackground
const WALL_CAP_COLOR = 0x585858;
const WALL_CAP_HIGHLIGHT = 0x6a6a6a;
const WALL_FACE_COLOR = 0x3a3a3a;
const WALL_TRIM_COLOR = 0x4a4a4a;

const SHELF_WIDTH = 96;
const SHELF_HEIGHT = 118;
const SHELF_COMPARTMENTS = 4;
const BOOK_COLORS = [
  0x9f1239, 0x1e40af, 0x166534, 0xa16207, 0x6d28d9, 0x0f766e, 0xbe185d,
  0x374151, 0xb45309, 0x1d4ed8,
];

const RACK_WIDTH = 64;
const RACK_HEIGHT = 124;
const RACK_UNITS = 8;
const RACK_UNIT_HEIGHT = 11;
const RACK_UNIT_GAP = 2;
const LED_BLINK_INTERVAL_MS = 180;
const LED_BUSY_BLINK_INTERVAL_MS = 60;
const CONSOLE_SCROLL_INTERVAL_MS = 120;
const CONSOLE_IDLE_BLINK_INTERVAL_MS = 500;
// Console screen on the first rack, above the head of whoever stands there
const CONSOLE_WIDTH = 44;
const CONSOLE_HEIGHT = 30;
const CONSOLE_TOP = ROOM_FURNITURE_BASE_Y - RACK_HEIGHT + 9;
const CONSOLE_LINES = 5;
const LED_COLORS = [0x22c55e, 0xf59e0b, 0x38bdf8];

// ============================================================================
// HELPERS
// ============================================================================

/** Face bottom of a room's top partition (where its floor becomes visible) */
function faceBottom(room: RoomBounds): number {
  return room.top + ROOM_WALL_CAP + ROOM_WALL_FACE;
}

/** Deterministic pseudo-random sequence so shelves look the same every frame */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

/** Integer hash used to decide which LEDs are lit in a blink frame */
function ledHash(a: number, b: number, c: number): number {
  let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  h = (h ^ (h >>> 13)) * 1274126177;
  return Math.abs(h ^ (h >>> 16));
}

// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================

/** Parquet floor for the archive */
function drawArchiveFloor(g: Graphics): void {
  const room = ARCHIVE_ROOM;
  const top = faceBottom(room);
  const width = room.right - SIDE_WALL_WIDTH - room.left;
  const plankHeight = 12;
  const plankLength = 64;

  g.rect(room.left, top, width, room.bottom - top);
  g.fill(0x5a412c);

  for (let row = 0, y = top; y < room.bottom; row++, y += plankHeight) {
    const h = Math.min(plankHeight, room.bottom - y);
    g.rect(room.left, y, width, h);
    g.fill(row % 2 === 0 ? 0x664a32 : 0x5f452f);
    // Row seam
    g.rect(room.left, y, width, 1);
    g.fill(0x47331f);
    // Staggered plank joints
    const offset = (row * 37) % plankLength;
    for (let x = room.left + offset; x < room.left + width; x += plankLength) {
      g.rect(x, y, 1, h);
      g.fill(0x3f2c1d);
    }
  }
}

/** Raised-floor panels for the server room */
function drawServerFloor(g: Graphics): void {
  const room = SERVER_ROOM;
  const top = faceBottom(room);
  const left = room.left + SIDE_WALL_WIDTH;
  const width = room.right - left;
  const panel = 32;

  g.rect(left, top, width, room.bottom - top);
  g.fill(0x56606b);

  // Panel grid aligned to the 32px tile grid
  const firstRow = Math.floor(top / panel) * panel;
  for (let y = firstRow; y < room.bottom; y += panel) {
    for (let x = left; x < room.right; x += panel) {
      const isPerforated = (x / panel + y / panel) % 2 === 0;
      if (isPerforated) {
        for (let dy = 8; dy < panel; dy += 8) {
          for (let dx = 8; dx < panel; dx += 8) {
            if (y + dy >= top) {
              g.rect(x + dx - 1, y + dy - 1, 2, 2);
              g.fill(0x4a535e);
            }
          }
        }
      }
      if (y >= top) {
        g.rect(x, y, panel, 1);
        g.fill(0x3f4852);
      }
      g.rect(x, Math.max(y, top), 1, Math.min(panel, y + panel - top));
      g.fill(0x3f4852);
    }
  }
}

/**
 * Room partitions: the top partition (cap + front face + trim) and the inner
 * side partition with a door gap facing the boss desk.
 */
function drawRoomWalls(g: Graphics, room: RoomBounds, sideX: number): void {
  const width = room.right - room.left;
  const capBottom = room.top + ROOM_WALL_CAP;
  const bottom = faceBottom(room);

  // Front face (seen from inside the room)
  g.rect(room.left, capBottom, width, ROOM_WALL_FACE);
  g.fill(WALL_FACE_COLOR);
  // Base trim
  g.rect(room.left, bottom - 4, width, 4);
  g.fill(WALL_TRIM_COLOR);
  // Soft shadow on the floor under the face
  g.rect(room.left, bottom, width, 6);
  g.fill({ color: 0x000000, alpha: 0.18 });

  // Top cap (seen from above)
  g.rect(room.left, room.top, width, ROOM_WALL_CAP);
  g.fill(WALL_CAP_COLOR);
  g.rect(room.left, room.top, width, 2);
  g.fill(WALL_CAP_HIGHLIGHT);

  // Side partition cap, split by the door gap
  g.rect(sideX, room.top, SIDE_WALL_WIDTH, ROOM_DOOR_TOP - room.top);
  g.fill(WALL_CAP_COLOR);
  g.rect(
    sideX,
    ROOM_DOOR_BOTTOM,
    SIDE_WALL_WIDTH,
    room.bottom - ROOM_DOOR_BOTTOM,
  );
  g.fill(WALL_CAP_COLOR);
  // Door jambs
  g.rect(sideX - 2, ROOM_DOOR_TOP - 4, SIDE_WALL_WIDTH + 4, 4);
  g.fill(WALL_CAP_HIGHLIGHT);
  g.rect(sideX - 2, ROOM_DOOR_BOTTOM, SIDE_WALL_WIDTH + 4, 4);
  g.fill(WALL_CAP_HIGHLIGHT);
}

/** One bookshelf standing on the room floor, centered at x */
function drawBookshelf(g: Graphics, cx: number, seed: number): void {
  const base = ROOM_FURNITURE_BASE_Y;
  const left = cx - SHELF_WIDTH / 2;
  const top = base - SHELF_HEIGHT;
  const innerLeft = left + 6;
  const innerWidth = SHELF_WIDTH - 12;
  const innerTop = top + 6;
  const innerHeight = SHELF_HEIGHT - 14;
  const compartment = innerHeight / SHELF_COMPARTMENTS;
  const random = seededRandom(seed);

  // Frame and crown
  g.rect(left, top, SHELF_WIDTH, SHELF_HEIGHT);
  g.fill(0x5b3a1f);
  g.rect(left - 2, top - 4, SHELF_WIDTH + 4, 6);
  g.fill(0x70482a);
  g.rect(left - 2, top - 4, SHELF_WIDTH + 4, 2);
  g.fill(0x8a5c36);

  // Back panel
  g.rect(innerLeft, innerTop, innerWidth, innerHeight);
  g.fill(0x2b1a0e);

  for (let i = 0; i < SHELF_COMPARTMENTS; i++) {
    const floorY = innerTop + compartment * (i + 1) - 3;
    // Books, left to right
    let x = innerLeft + 1;
    while (x < innerLeft + innerWidth - 4) {
      const bookWidth = 4 + Math.floor(random() * 5);
      if (x + bookWidth > innerLeft + innerWidth - 1) break;
      if (random() < 0.12) {
        x += bookWidth; // gap on the shelf
        continue;
      }
      const bookHeight = compartment - 9 + Math.floor(random() * 6);
      const color = BOOK_COLORS[Math.floor(random() * BOOK_COLORS.length)];
      g.rect(x, floorY - bookHeight, bookWidth, bookHeight);
      g.fill(color);
      // Spine band and separator
      g.rect(x, floorY - bookHeight + 3, bookWidth, 1);
      g.fill({ color: 0xffffff, alpha: 0.22 });
      g.rect(x, floorY - bookHeight, 1, bookHeight);
      g.fill({ color: 0x000000, alpha: 0.3 });
      x += bookWidth;
    }
    // Shelf board
    g.rect(innerLeft, floorY, innerWidth, 3);
    g.fill(0x6b4423);
  }

  // Inner right side in shadow, plinth
  g.rect(innerLeft + innerWidth - 3, innerTop, 3, innerHeight);
  g.fill({ color: 0x000000, alpha: 0.25 });
  g.rect(left, base - 8, SHELF_WIDTH, 8);
  g.fill(0x4a2f17);
}

/** Server rack cabinet (LEDs are drawn separately so they can blink) */
function drawServerRack(g: Graphics, cx: number): void {
  const base = ROOM_FURNITURE_BASE_Y;
  const left = cx - RACK_WIDTH / 2;
  const top = base - RACK_HEIGHT;

  // Cabinet body, bevels, top cap
  g.rect(left, top, RACK_WIDTH, RACK_HEIGHT);
  g.fill(0x1b1f25);
  g.rect(left, top, 3, RACK_HEIGHT);
  g.fill(0x2f3640);
  g.rect(left + RACK_WIDTH - 3, top, 3, RACK_HEIGHT);
  g.fill(0x111418);
  g.rect(left, top, RACK_WIDTH, 5);
  g.fill(0x2c333c);

  // Mounted units
  for (let i = 0; i < RACK_UNITS; i++) {
    const y = top + 9 + i * (RACK_UNIT_HEIGHT + RACK_UNIT_GAP);
    g.rect(left + 6, y, RACK_WIDTH - 12, RACK_UNIT_HEIGHT);
    g.fill(i % 2 === 0 ? 0x2d343d : 0x262c34);
    // Handle
    g.rect(left + 7, y + 1, 2, RACK_UNIT_HEIGHT - 2);
    g.fill(0x3b434d);
    // Vent grooves
    for (let v = 0; v < 4; v++) {
      g.rect(left + 30 + v * 6, y + 3, 4, 1);
      g.fill(0x1a1e23);
      g.rect(left + 30 + v * 6, y + 7, 4, 1);
      g.fill(0x1a1e23);
    }
  }

  // Feet
  g.rect(left + 2, base - 6, RACK_WIDTH - 4, 6);
  g.fill(0x101317);
}

/** Status LEDs for one rack in a given blink frame */
function drawRackLeds(
  g: Graphics,
  cx: number,
  rackIndex: number,
  frame: number,
): void {
  g.clear();
  const left = cx - RACK_WIDTH / 2;
  const top = ROOM_FURNITURE_BASE_Y - RACK_HEIGHT;
  for (let unit = 0; unit < RACK_UNITS; unit++) {
    const y = top + 9 + unit * (RACK_UNIT_HEIGHT + RACK_UNIT_GAP) + 4;
    for (let led = 0; led < 3; led++) {
      const color = LED_COLORS[(unit + led + rackIndex) % LED_COLORS.length];
      // Power LEDs (led 0) stay on; activity LEDs flicker
      const isOn =
        led === 0 || ledHash(rackIndex, unit * 3 + led, frame) % 3 !== 0;
      g.rect(left + 12 + led * 4, y, 2, 2);
      g.fill({ color, alpha: isOn ? 1 : 0.2 });
    }
  }
}

/** Rack-mounted console: scrolling output while busy, a blinking cursor when idle */
function drawRackConsole(
  g: Graphics,
  cx: number,
  isBusy: boolean,
  frame: number,
): void {
  g.clear();
  const left = cx - CONSOLE_WIDTH / 2;
  g.rect(left - 2, CONSOLE_TOP - 2, CONSOLE_WIDTH + 4, CONSOLE_HEIGHT + 4);
  g.fill(0x0b0f14);
  g.rect(left, CONSOLE_TOP, CONSOLE_WIDTH, CONSOLE_HEIGHT);
  g.fill(isBusy ? 0x052e16 : 0x0a1a10);
  if (!isBusy) {
    if (frame % 2 === 0) {
      g.rect(left + 3, CONSOLE_TOP + 4, 4, 5);
      g.fill(0x22c55e);
    }
    return;
  }
  for (let line = 0; line < CONSOLE_LINES; line++) {
    const width = 8 + (ledHash(line + frame, 7, 3) % (CONSOLE_WIDTH - 12));
    g.rect(left + 3, CONSOLE_TOP + 3 + line * 5, width, 2);
    g.fill({ color: 0x4ade80, alpha: line === CONSOLE_LINES - 1 ? 1 : 0.7 });
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function RackConsole({
  cx,
  isBusy,
}: {
  cx: number;
  isBusy: boolean;
}): ReactNode {
  const [frame, setFrame] = useState(0);
  const elapsedRef = useRef(0);
  const interval = isBusy
    ? CONSOLE_SCROLL_INTERVAL_MS
    : CONSOLE_IDLE_BLINK_INTERVAL_MS;

  useTick((ticker) => {
    elapsedRef.current += ticker.deltaMS;
    if (elapsedRef.current >= interval) {
      elapsedRef.current = 0;
      setFrame((f) => f + 1);
    }
  });

  const draw = useCallback(
    (g: Graphics) => drawRackConsole(g, cx, isBusy, frame),
    [cx, isBusy, frame],
  );

  return <pixiGraphics draw={draw} />;
}

interface RackLedsProps {
  cx: number;
  rackIndex: number;
  isBusy: boolean;
}

function RackLeds({ cx, rackIndex, isBusy }: RackLedsProps): ReactNode {
  const [frame, setFrame] = useState(0);
  const elapsedRef = useRef(0);
  const interval = isBusy ? LED_BUSY_BLINK_INTERVAL_MS : LED_BLINK_INTERVAL_MS;

  useTick((ticker) => {
    elapsedRef.current += ticker.deltaMS;
    if (elapsedRef.current >= interval) {
      elapsedRef.current = 0;
      setFrame((f) => f + 1);
    }
  });

  const draw = useCallback(
    (g: Graphics) => drawRackLeds(g, cx, rackIndex, frame),
    [cx, rackIndex, frame],
  );

  return <pixiGraphics draw={draw} />;
}

interface RoomSignProps {
  x: number;
  y: number;
  label: string;
  accent: number;
}

/** Name plate standing on a room's top partition */
function RoomSign({ x, y, label, accent }: RoomSignProps): ReactNode {
  const w = Math.max(84, label.length * 7 + 28);
  const h = 22;
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      g.roundRect(-w / 2, -h / 2, w, h, 4);
      g.fill({ color: 0x1e1e1e, alpha: 0.92 });
      g.roundRect(-w / 2, -h / 2, w, h, 4);
      g.stroke({ color: accent, width: 1.5, alpha: 0.85 });
    },
    [w, accent],
  );

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={draw} />
      <pixiContainer scale={0.5}>
        <pixiText
          text={label}
          anchor={0.5}
          resolution={2}
          style={{
            fontSize: 22,
            fill: "#ffffff",
            fontFamily: "monospace",
            fontWeight: "bold",
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface OfficeRoomsProps {
  /** Someone is running a command at the racks: LEDs flicker faster */
  isServerBusy?: boolean;
}

function OfficeRoomsComponent({
  isServerBusy = false,
}: OfficeRoomsProps): ReactNode {
  const { t } = useTranslation();

  const drawFloors = useCallback((g: Graphics) => {
    g.clear();
    drawArchiveFloor(g);
    drawServerFloor(g);
  }, []);

  const drawWalls = useCallback((g: Graphics) => {
    g.clear();
    drawRoomWalls(g, ARCHIVE_ROOM, ARCHIVE_ROOM.right - SIDE_WALL_WIDTH);
    drawRoomWalls(g, SERVER_ROOM, SERVER_ROOM.left);
  }, []);

  const drawFurniture = useCallback((g: Graphics) => {
    g.clear();
    ARCHIVE_SHELF_XS.forEach((x, i) => drawBookshelf(g, x, 1234 + i * 97));
    SERVER_RACK_XS.forEach((x) => drawServerRack(g, x));
  }, []);

  // Plates float just above the tallest furniture (rack tops at base - 124)
  const signY = ROOM_FURNITURE_BASE_Y - RACK_HEIGHT - 14;

  return (
    <>
      <pixiGraphics draw={drawFloors} />
      <pixiGraphics draw={drawWalls} />
      <pixiGraphics draw={drawFurniture} />
      {SERVER_RACK_XS.map((x, i) => (
        <RackLeds
          key={`rack-leds-${i}`}
          cx={x}
          rackIndex={i}
          isBusy={isServerBusy}
        />
      ))}
      <RackConsole cx={SERVER_RACK_XS[0]} isBusy={isServerBusy} />
      <RoomSign
        x={(ARCHIVE_ROOM.left + ARCHIVE_ROOM.right) / 2}
        y={signY}
        label={`📚 ${t("office.archive")}`}
        accent={0xd97706}
      />
      <RoomSign
        x={(SERVER_ROOM.left + SERVER_ROOM.right) / 2}
        y={signY}
        label={`🖥️ ${t("office.serverRoom")}`}
        accent={0x06b6d4}
      />
    </>
  );
}

export const OfficeRooms = memo(OfficeRoomsComponent);
