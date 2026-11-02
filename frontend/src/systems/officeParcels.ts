/**
 * Parcels for installs (docs/plan/spec.md 「작업 공간 기믹」, 2026-11-02): when
 * a command that installs packages goes through, a courier steps out of the
 * elevator with a box, sets it down on the stack beside Claude's desk and
 * rides back down. The box's label is the packages it brought. Pure: no
 * three.js.
 */

import { FRESH_MS } from "./roomGimmicks";
import { distance, stepWalk, type Point, type Walker } from "./placeWalk";

/** Commands that install packages, with the words their package names follow. */
const INSTALLS: readonly RegExp[] = [
  /\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|i)\b/,
  /\buv\s+(?:add|pip\s+install)\b/,
  /\bpip3?\s+install\b/,
  /\bpoetry\s+add\b/,
  /\bcargo\s+(?:add|install)\b/,
  /\bgo\s+(?:get|install)\b/,
  /\bbrew\s+install\b/,
  /\bgem\s+install\b/,
];

/** Where an install's own part of a chained command ends. */
const COMMAND_END = /&&|\|\||[;|\n]/;

/**
 * What a box from ``command`` is labelled: the packages it installs, or the
 * install itself (``npm install``) when it names none. Null when the command
 * installs nothing.
 */
export function parcelLabel(command: unknown): string | null {
  if (typeof command !== "string") return null;
  for (const install of INSTALLS) {
    const found = install.exec(command);
    if (!found) continue;
    const rest = command.slice(found.index + found[0].length);
    const names = rest
      .split(COMMAND_END)[0]
      .trim()
      .split(/\s+/)
      .map((word) => word.replace(/^["']|["']$/g, ""))
      .filter((word) => word !== "" && !word.startsWith("-"));
    return names.length > 0 ? names.join(", ") : found[0].replace(/\s+/g, " ");
  }
  return null;
}

/** The stack beside Claude's desk holds this many boxes. */
export const MAX_PARCELS = 6;

export interface Parcel {
  id: string;
  label: string;
  /** When the install finished (ms). */
  at: number;
}

/**
 * The session's installs that went through: how many, and the latest one
 * (the log is newest first).
 */
export function parcelsDelivered(
  eventLog: readonly {
    id: string;
    type: string;
    timestamp: Date;
    detail?: { toolInput?: unknown; errorType?: string };
  }[],
): { count: number; last: Parcel | null } {
  let count = 0;
  let last: Parcel | null = null;
  for (const entry of eventLog) {
    if (entry.type !== "post_tool_use" || entry.detail?.errorType) continue;
    const input = entry.detail?.toolInput as { command?: unknown } | undefined;
    const label = parcelLabel(input?.command);
    if (label === null) continue;
    count += 1;
    last ??= { id: entry.id, label, at: entry.timestamp.getTime() };
  }
  return { count, last };
}

/** Whether a new parcel is one to deliver now: unseen and just installed. */
export function isFreshParcel(
  last: Parcel | null,
  seen: string | null,
  now: number,
): last is Parcel {
  return last !== null && last.id !== seen && now - last.at < FRESH_MS;
}

/**
 * How the courier is getting on: stepping out of the cab, walking to the
 * stack with the box, setting it down, waving, walking back, stepping in.
 */
export type CourierLeg = "out" | "deliver" | "drop" | "wave" | "back" | "in";

export interface Courier {
  walker: Walker;
  leg: CourierLeg;
  /** When the drop or wave ends (ms). */
  until: number | null;
  parcel: Parcel;
}

export interface CourierWay {
  /** The elevator cab and the door it steps out of. */
  cab: Point;
  door: Point;
  /** Where it stands to set the box down, facing ``dropFacing``. */
  drop: Point;
  dropFacing: number;
  findPath: (from: Point, to: Point) => Point[];
}

/** Setting the box down, then waving, take this long (ms). */
export const DROP_MS = 1_200;
export const WAVE_MS = 1_000;
/** Couriers walk a little brisker than the office. */
export const COURIER_SPEED = 3.8;
/** Near the door this close, it is open for the courier (m). */
const DOOR_RANGE = 1.6;

/** A courier in the cab with ``parcel``, about to step out. */
export function startCourier(parcel: Parcel, way: CourierWay): Courier {
  const { cab, door } = way;
  return {
    walker: {
      x: cab.x,
      z: cab.z,
      facing: Math.atan2(door.x - cab.x, door.z - cab.z),
      path: [door],
    },
    leg: "out",
    until: null,
    parcel,
  };
}

/** A path from ``from`` to ``to`` on the floor, straight when none is found. */
function route(way: CourierWay, from: Point, to: Point): Point[] {
  const path = way.findPath(from, to);
  return path.length > 0 ? path : [to];
}

/**
 * Move the courier one frame. ``dropped`` is true the frame its box lands
 * on the stack; ``courier`` is null once it has ridden back down.
 */
export function stepCourier(
  courier: Courier,
  way: CourierWay,
  now: number,
  dt: number,
): { courier: Courier | null; dropped: boolean } {
  const walker = stepWalk(courier.walker, dt, COURIER_SPEED);
  const next = { ...courier, walker };
  const arrived = walker.path.length === 0;
  switch (courier.leg) {
    case "out":
      if (!arrived) return { courier: next, dropped: false };
      return {
        courier: {
          ...next,
          leg: "deliver",
          walker: { ...walker, path: route(way, way.door, way.drop) },
        },
        dropped: false,
      };
    case "deliver":
      if (!arrived) return { courier: next, dropped: false };
      return {
        courier: {
          ...next,
          leg: "drop",
          until: now + DROP_MS,
          walker: { ...walker, facing: way.dropFacing },
        },
        dropped: false,
      };
    case "drop":
      if (now < (courier.until ?? now))
        return { courier: next, dropped: false };
      return {
        courier: { ...next, leg: "wave", until: now + WAVE_MS },
        dropped: true,
      };
    case "wave":
      if (now < (courier.until ?? now))
        return { courier: next, dropped: false };
      return {
        courier: {
          ...next,
          leg: "back",
          until: null,
          walker: { ...walker, path: route(way, walker, way.door) },
        },
        dropped: false,
      };
    case "back":
      if (!arrived) return { courier: next, dropped: false };
      return {
        courier: { ...next, leg: "in", walker: { ...walker, path: [way.cab] } },
        dropped: false,
      };
    case "in":
      return { courier: arrived ? null : next, dropped: false };
  }
}

/** Whether the elevator stands open for the courier: in the cab's doorway or near it. */
export function courierAtDoor(courier: Courier | null, door: Point): boolean {
  if (!courier) return false;
  if (courier.leg === "out" || courier.leg === "in") return true;
  return distance(courier.walker, door) < DOOR_RANGE;
}

/** Whether it still has the box in its hands. */
export const carrying = (courier: Courier): boolean =>
  courier.leg === "out" || courier.leg === "deliver" || courier.leg === "drop";
