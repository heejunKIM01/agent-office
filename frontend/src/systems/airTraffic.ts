/**
 * Air traffic at the isometric airport (설정 「장소」 · 공항): each plane is a
 * subagent, or the lead agent of another session working now. A plane made
 * while the airport is watched boards at a gate, pushes back, taxis to one
 * of the runways and takes off; while its work goes on it circles the
 * field. When the work is done it lands, leaves the runway at its far end,
 * taxis back to a gate and is gone a moment later. A snapshot puts the
 * planes already at work straight into the air.
 *
 * The tower (Claude) shares out the ground and the runways. The apron and
 * taxiway A take one plane at a time: a departure from pushback until it
 * turns into its runway's link, an arrival from the top of its runway's
 * exit until it turns into its gate's lead-in. Each runway takes one plane
 * at a time too: a departure from the hold line until it starts its
 * takeoff roll, an arrival from the approach until it is off at the far
 * end, where it taxis up the exit to wait. A plane waits holding nothing, so
 * no two planes wait on each other. Arrivals go first, and the tower
 * spreads the traffic over the runways, the one used longest ago first.
 *
 * Pure: no three.js. The scene reads each flight's position and attitude.
 */

import {
  CIRCUIT,
  CIRCUIT_ALTITUDE,
  CIRCUIT_LANES,
  CIRCUIT_LANE_STEP,
  GATE_XS,
  GATE_Z,
  RUNWAYS,
  TAXIWAY_Z,
  type Runway,
} from "@/constants/isoAirportPlan";

/** A point a plane passes, how fast it goes there, and whether it is pushed backwards. */
export interface PathPoint {
  x: number;
  y: number;
  z: number;
  speed: number;
  reverse?: boolean;
}

export interface FlightPath {
  points: PathPoint[];
  /** Distance along the path to each point. */
  at: number[];
  total: number;
  /** Whether the last point joins the first again (the circuit). */
  loop: boolean;
}

const distance = (a: PathPoint, b: PathPoint): number =>
  Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

export function makePath(points: PathPoint[], loop = false): FlightPath {
  const at = [0];
  for (let i = 1; i < points.length; i++) {
    at.push(at[i - 1] + distance(points[i - 1], points[i]));
  }
  const closing = loop ? distance(points[points.length - 1], points[0]) : 0;
  return { points, at, total: at[at.length - 1] + closing, loop };
}

export interface PathSample {
  x: number;
  y: number;
  z: number;
  speed: number;
  /** Which way it moves there (not normalised). */
  dx: number;
  dy: number;
  dz: number;
  reverse: boolean;
}

/** Where the point ``d`` along ``path`` is (wrapped on a loop, clamped otherwise). */
export function samplePath(path: FlightPath, d: number): PathSample {
  const { points, at, total, loop } = path;
  const along = loop
    ? ((d % total) + total) % total
    : Math.min(Math.max(d, 0), total);
  let i = 0;
  while (i < at.length - 1 && at[i + 1] <= along) i++;
  const a = points[i];
  const last = i === points.length - 1;
  const b = last ? (loop ? points[0] : a) : points[i + 1];
  const length = (last ? total : at[i + 1]) - at[i];
  const t = length > 0 ? (along - at[i]) / length : 0;
  // At the very end of an open path, keep the last leg's direction.
  const from = last && !loop && i > 0 ? points[i - 1] : a;
  const to = last && !loop && i > 0 ? a : b;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    speed: a.speed + (b.speed - a.speed) * t,
    dx: to.x - from.x,
    dy: to.y - from.y,
    dz: to.z - from.z,
    reverse: a.reverse ?? false,
  };
}

/**
 * Points along a quarter circle about (cx, cz): ``offset(φ)`` for φ from 0
 * to π/2 is the point's offset from the centre. The start is left out.
 */
function quarter(
  cx: number,
  cz: number,
  offset: (phi: number) => [number, number],
  y: (t: number) => number,
  speed: (t: number) => number,
  steps = 8,
): PathPoint[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps;
    const [dx, dz] = offset((t * Math.PI) / 2);
    return { x: cx + dx, y: y(t), z: cz + dz, speed: speed(t) };
  });
}

/** Planes circle at this speed (units a second). */
export const CIRCUIT_SPEED = 12;
const TAXI_SPEED = 8;
const PUSH_SPEED = 3;

export const laneAltitude = (lane: number): number =>
  CIRCUIT_ALTITUDE + lane * CIRCUIT_LANE_STEP;

/**
 * How fast planes circle in ``lane``: each lane up a little slower, so
 * planes that took off together drift apart instead of flying in formation.
 */
export const laneSpeed = (lane: number): number =>
  CIRCUIT_SPEED * (1 - 0.12 * lane);

const { left: L, right: R, top: T, bottom: B, corner: C } = CIRCUIT;
const steady = (): number => CIRCUIT_SPEED;

/** Where a plane waits before a runway, and where it stops after leaving one. */
export const holdZ = (runway: Runway): number => runway.z - 8;
/**
 * Where a plane that has left a runway waits for taxiway A: at the top of
 * the exit, the link being its own until then.
 */
export const EXIT_WAIT_Z = TAXIWAY_Z + 6;
/** A plane this far north of a runway's centre line is off it. */
const OFF_RUNWAY = 8;
/** Where a departure starts its takeoff roll: past here the runway is free again. */
export const rollX = (runway: Runway): number => runway.west + 6;
/** Where an arrival turns off the circuit for every runway: over the terminal, east of the bases. */
const ENTRY_X = RUNWAYS[0].west - 10 + C;
/** A plane done with its work asks to land this far before the turn-off. */
export const APPROACH_CALL = 50;

/**
 * The circuit in ``lane``: north up the right side, west along the top
 * over the terminal, south down the left and east along the bottom.
 */
export function circuitPath(lane: number): FlightPath {
  const y = laneAltitude(lane);
  const flat = (): number => y;
  return makePath(
    [
      { x: R, y, z: B - C, speed: CIRCUIT_SPEED },
      { x: R, y, z: T + C, speed: CIRCUIT_SPEED },
      ...quarter(
        R - C,
        T + C,
        (p) => [C * Math.cos(p), -C * Math.sin(p)],
        flat,
        steady,
      ),
      { x: L + C, y, z: T, speed: CIRCUIT_SPEED },
      ...quarter(
        L + C,
        T + C,
        (p) => [-C * Math.sin(p), -C * Math.cos(p)],
        flat,
        steady,
      ),
      { x: L, y, z: B - C, speed: CIRCUIT_SPEED },
      ...quarter(
        L + C,
        B - C,
        (p) => [-C * Math.cos(p), C * Math.sin(p)],
        flat,
        steady,
      ),
      { x: R - C, y, z: B, speed: CIRCUIT_SPEED },
      // The last corner ends where the circuit starts.
      ...quarter(
        R - C,
        B - C,
        (p) => [C * Math.sin(p), C * Math.cos(p)],
        flat,
        steady,
      ).slice(0, -1),
    ],
    true,
  );
}

/** How far round the circuit the point (``x``, top) on the top straight is. */
function alongTop(circuit: FlightPath, x: number): number {
  const corner = circuit.points.findIndex(
    (p) => Math.abs(p.x - (R - C)) < 1e-6 && Math.abs(p.z - T) < 1e-6,
  );
  return circuit.at[corner] + (R - C - x);
}

/** How far round the circuit the point (right, ``z``) on the right straight is. */
const alongRight = (z: number): number => B - C - z;

/** How far round the circuit arrivals turn off to land. */
export const approachEntry = (circuit: FlightPath): number =>
  alongTop(circuit, ENTRY_X);

/** From a gate: pushed back onto taxiway A, taxi to the runway's link and down it to the hold line. */
export function taxiOutPath(gate: number, runway: Runway): FlightPath {
  const gx = GATE_XS[gate];
  const way = Math.sign(runway.linkX - gx) || 1;
  const points: PathPoint[] = [
    { x: gx, y: 0, z: GATE_Z, speed: PUSH_SPEED, reverse: true },
    { x: gx, y: 0, z: TAXIWAY_Z - 0.8, speed: 1.2, reverse: true },
    { x: gx + way * 0.6, y: 0, z: TAXIWAY_Z, speed: 2 },
  ];
  // A gate right by the link turns straight in.
  if ((runway.linkX - way * 2 - (gx + way * 0.6)) * way > 0) {
    points.push({
      x: runway.linkX - way * 2,
      y: 0,
      z: TAXIWAY_Z,
      speed: TAXI_SPEED,
    });
  }
  points.push(
    { x: runway.linkX, y: 0, z: TAXIWAY_Z + 2, speed: 5 },
    { x: runway.linkX, y: 0, z: holdZ(runway) - 3, speed: TAXI_SPEED },
    { x: runway.linkX, y: 0, z: holdZ(runway), speed: 2 },
  );
  return makePath(points);
}

/** From the hold line: line up, take off east, climb out and turn north onto the circuit. */
export function takeoffPath(runway: Runway, lane: number): FlightPath {
  const y = laneAltitude(lane);
  return makePath([
    { x: runway.linkX, y: 0, z: holdZ(runway), speed: 3 },
    { x: runway.linkX, y: 0, z: runway.z - 2.2, speed: 3 },
    { x: runway.linkX + 2.2, y: 0, z: runway.z, speed: 3.5 },
    { x: rollX(runway), y: 0, z: runway.z, speed: 5 },
    { x: runway.west + 34, y: 0, z: runway.z, speed: 15 },
    { x: runway.west + 48, y: 2.8, z: runway.z, speed: 14 },
    { x: R - C, y: y * 0.85, z: runway.z, speed: CIRCUIT_SPEED },
    ...quarter(
      R - C,
      runway.z - C,
      (p) => [C * Math.sin(p), C * Math.cos(p)],
      (t) => y * (0.85 + 0.15 * t),
      steady,
    ),
    { x: R, y, z: runway.z - C - 4, speed: CIRCUIT_SPEED },
  ]);
}

/** How far round the circuit a departure from ``runway`` joins it. */
const joinAt = (runway: Runway): number => alongRight(runway.z - C - 4);

/**
 * From the turn-off: along the top to the runway's base leg, down it
 * descending, onto the final, touchdown, roll out and off at the far end
 * to the exit's stop line.
 */
export function approachPath(runway: Runway, lane: number): FlightPath {
  const y = laneAltitude(lane);
  const base = runway.west - 10;
  const onFinal = 4;
  const points: PathPoint[] = [{ x: ENTRY_X, y, z: T, speed: CIRCUIT_SPEED }];
  if (base + C < ENTRY_X - 0.01) {
    points.push({ x: base + C, y, z: T, speed: CIRCUIT_SPEED });
  }
  points.push(
    ...quarter(
      base + C,
      T + C,
      (p) => [-C * Math.sin(p), -C * Math.cos(p)],
      () => y,
      steady,
    ),
    { x: base, y: onFinal, z: runway.z - C, speed: 10 },
    ...quarter(
      base + C,
      runway.z - C,
      (p) => [-C * Math.cos(p), C * Math.sin(p)],
      (t) => onFinal - 1.6 * t,
      (t) => 10 - 1.5 * t,
    ),
    { x: runway.west + 10, y: 0, z: runway.z, speed: 8 },
    { x: runway.east - 12, y: 0, z: runway.z, speed: 4.5 },
    { x: runway.east, y: 0, z: runway.z, speed: 3 },
    ...quarter(
      runway.east,
      runway.z - 4,
      (p) => [4 * Math.sin(p), 4 * Math.cos(p)],
      () => 0,
      () => 3,
      6,
    ),
    { x: runway.exitX, y: 0, z: runway.z - OFF_RUNWAY, speed: 5 },
    { x: runway.exitX, y: 0, z: EXIT_WAIT_Z + 3, speed: TAXI_SPEED },
    { x: runway.exitX, y: 0, z: EXIT_WAIT_Z, speed: 2 },
  );
  return makePath(points);
}

/** From a runway's exit: up to taxiway A, west along it and nose in at ``gate``. */
export function taxiInPath(runway: Runway, gate: number): FlightPath {
  const gx = GATE_XS[gate];
  return makePath([
    { x: runway.exitX, y: 0, z: EXIT_WAIT_Z, speed: 2 },
    { x: runway.exitX, y: 0, z: TAXIWAY_Z + 2, speed: 5 },
    { x: runway.exitX - 2, y: 0, z: TAXIWAY_Z, speed: 4 },
    { x: gx + 2, y: 0, z: TAXIWAY_Z, speed: TAXI_SPEED },
    { x: gx, y: 0, z: TAXIWAY_Z - 2, speed: 2.5 },
    { x: gx, y: 0, z: GATE_Z, speed: 1.2 },
  ]);
}

/** How long a plane stays at its gate after landing, its passengers getting off (ms). */
export const ARRIVED_MS = 3500;

export type FlightPhase =
  | "parked"
  | "taxiOut"
  | "holding"
  | "takeoff"
  | "circling"
  | "approach"
  | "exited"
  | "taxiIn"
  | "arrived";

export interface Flight {
  id: string;
  gate: number;
  /** The runway it is going to, using, or has just left. */
  runway: number | null;
  lane: number;
  phase: FlightPhase;
  /** The path it follows now (the circuit while circling, none at a gate). */
  path: FlightPath | null;
  d: number;
  /** Its work is done: it lands as soon as the tower lets it. */
  leaving: boolean;
  /** When it asked the tower for what it waits for (ms), while it waits. */
  askedAt: number | null;
  /** When it reached its gate after landing (ms). */
  arrivedAt: number | null;
  x: number;
  y: number;
  z: number;
  /** Heading about y (0 faces +z), nose up and bank, eased from the path's. */
  yaw: number;
  pitch: number;
  roll: number;
}

/** The tower's word to a plane, for the radio. */
export interface Clearance {
  id: string;
  kind: "takeoff" | "landing";
  /** The runway's name from where the plane uses it (09L and so on). */
  runway: string;
}

/** Facing the terminal (-z), as a plane parks at its gate. */
const AT_GATE_YAW = Math.PI;
const GROUND_TURN = 2.2;
const AIR_TURN = 3.5;
const MAX_BANK = 0.45;

const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export class AirTraffic {
  readonly flights = new Map<string, Flight>();
  /** Who has the apron and taxiway A now. */
  private apron: string | null = null;
  /** Who has each runway now (or has it kept for its landing). */
  private readonly runways: (string | null)[] = RUNWAYS.map(() => null);
  /** When each runway was last given out (ms), to spread the traffic. */
  private readonly lastUsed: number[] = RUNWAYS.map(() => -Infinity);
  private readonly circuits = Array.from({ length: CIRCUIT_LANES }, (_, i) =>
    circuitPath(i),
  );
  private readonly entry = approachEntry(this.circuits[0]);

  /** Who has each runway, for the runway lights. */
  get runwayHolders(): readonly (string | null)[] {
    return this.runways;
  }

  /** Who has the apron, for tests. */
  get apronHolder(): string | null {
    return this.apron;
  }

  /**
   * Bring in a plane: boarding at a free gate (``gate``), or already in the
   * air on a free stretch of the circuit (``air``).
   */
  add(id: string, where: "gate" | "air"): Flight {
    const lane = this.freeLane();
    const flight: Flight = {
      id,
      gate: this.freeGate(),
      runway: null,
      lane,
      phase: where === "gate" ? "parked" : "circling",
      path: where === "gate" ? null : this.circuits[lane],
      d: where === "gate" ? 0 : this.freeStretch(lane),
      leaving: false,
      askedAt: null,
      arrivedAt: null,
      x: 0,
      y: 0,
      z: 0,
      yaw: AT_GATE_YAW,
      pitch: 0,
      roll: 0,
    };
    this.place(flight, 0, true);
    this.flights.set(id, flight);
    return flight;
  }

  /** Its work is done (or not after all). */
  setLeaving(id: string, leaving: boolean): void {
    const flight = this.flights.get(id);
    if (flight) flight.leaving = leaving;
  }

  remove(id: string): void {
    this.flights.delete(id);
    if (this.apron === id) this.apron = null;
    this.runways.forEach((holder, k) => {
      if (holder === id) this.runways[k] = null;
    });
  }

  clear(): void {
    this.flights.clear();
    this.apron = null;
    this.runways.fill(null);
  }

  /**
   * Move every plane ``dt`` seconds on; ``now`` in ms. Returns the tower's
   * clearances given this step and the planes that are gone.
   */
  step(dt: number, now: number): { cleared: Clearance[]; gone: string[] } {
    const gone: string[] = [];
    for (const flight of this.flights.values()) {
      if (this.advance(flight, dt, now)) gone.push(flight.id);
    }
    for (const id of gone) this.remove(id);
    return { cleared: this.giveOut(now), gone };
  }

  /** Hand the apron and the free runways to the planes waiting for them. */
  private giveOut(now: number): Clearance[] {
    const cleared: Clearance[] = [];
    if (this.apron === null) {
      const next = this.first(
        (f) =>
          f.phase === "exited" ||
          (f.phase === "parked" && !f.leaving && this.freeHold(f) !== null),
        (f) => f.phase === "exited",
      );
      if (next) {
        this.apron = next.id;
        next.askedAt = null;
        if (next.phase === "parked") {
          const k = this.freeHold(next) as number;
          this.lastUsed[k] = now;
          next.runway = k;
          next.phase = "taxiOut";
          next.path = taxiOutPath(next.gate, RUNWAYS[k]);
        } else {
          next.gate = this.freeGate(next.id);
          next.phase = "taxiIn";
          next.path = taxiInPath(RUNWAYS[next.runway as number], next.gate);
        }
        next.d = 0;
      }
    }
    const byAge = RUNWAYS.map((_, k) => k).sort(
      (a, b) => this.lastUsed[a] - this.lastUsed[b],
    );
    for (const k of byAge) {
      if (this.runways[k] !== null) continue;
      const next = this.first(
        (f) =>
          (f.phase === "holding" && f.runway === k) ||
          (f.phase === "circling" &&
            f.leaving &&
            f.runway === null &&
            this.nearEntry(f) &&
            !this.exitTaken(k)),
        (f) => f.phase === "circling",
      );
      if (!next) continue;
      this.runways[k] = next.id;
      this.lastUsed[k] = now;
      next.askedAt = null;
      const name = RUNWAYS[k].names[0];
      if (next.phase === "holding") {
        next.phase = "takeoff";
        next.path = takeoffPath(RUNWAYS[k], next.lane);
        next.d = 0;
        cleared.push({ id: next.id, kind: "takeoff", runway: name });
      } else {
        // Kept for it: it turns off to land when it reaches the turn-off.
        next.runway = k;
        cleared.push({ id: next.id, kind: "landing", runway: name });
      }
    }
    return cleared;
  }

  /** The plane waiting longest among those that ``can`` go, ``ahead`` ones first. */
  private first(
    can: (flight: Flight) => boolean,
    ahead: (flight: Flight) => boolean,
  ): Flight | undefined {
    return [...this.flights.values()]
      .filter((f) => f.askedAt !== null && can(f))
      .sort(
        (a, b) =>
          Number(ahead(b)) - Number(ahead(a)) ||
          (a.askedAt ?? 0) - (b.askedAt ?? 0),
      )[0];
  }

  /** One plane's step; true when it is gone. */
  private advance(flight: Flight, dt: number, now: number): boolean {
    const move = (): FlightPath => {
      const path = flight.path as FlightPath;
      flight.d = Math.min(
        path.total,
        flight.d + samplePath(path, flight.d).speed * dt,
      );
      return path;
    };
    switch (flight.phase) {
      case "parked":
        if (flight.leaving) {
          // Done before it ever left: its passengers get off again.
          flight.askedAt = null;
          flight.phase = "arrived";
          flight.arrivedAt = now;
        } else {
          flight.askedAt ??= now;
        }
        break;
      case "taxiOut": {
        const path = move();
        if (this.apron === flight.id && flight.z >= TAXIWAY_Z + 3) {
          this.apron = null;
        }
        if (flight.d >= path.total) flight.phase = "holding";
        break;
      }
      case "holding":
        flight.askedAt ??= now;
        break;
      case "takeoff": {
        const path = move();
        const k = flight.runway as number;
        const runway = RUNWAYS[k];
        const rolling =
          flight.x >= rollX(runway) && Math.abs(flight.z - runway.z) < 0.01;
        if (rolling && this.runways[k] === flight.id) this.runways[k] = null;
        if (flight.d >= path.total) {
          flight.phase = "circling";
          flight.path = this.circuits[flight.lane];
          flight.d = joinAt(runway);
          flight.runway = null;
        }
        break;
      }
      case "circling": {
        const path = flight.path as FlightPath;
        const before = flight.d;
        flight.d = (flight.d + laneSpeed(flight.lane) * dt) % path.total;
        const crossed =
          before <= flight.d
            ? before < this.entry && this.entry <= flight.d
            : before < this.entry || this.entry <= flight.d;
        if (!flight.leaving) break;
        const kept =
          flight.runway !== null && this.runways[flight.runway] === flight.id;
        if (kept && crossed) {
          flight.phase = "approach";
          flight.path = approachPath(
            RUNWAYS[flight.runway as number],
            flight.lane,
          );
          flight.d = (flight.d - this.entry + path.total) % path.total;
        } else if (!kept) {
          flight.askedAt ??= now;
        }
        break;
      }
      case "approach": {
        const path = move();
        const k = flight.runway as number;
        // Off the runway at its far end: the next plane may use it.
        const off =
          flight.x >= RUNWAYS[k].east && flight.z <= RUNWAYS[k].z - OFF_RUNWAY;
        if (off && this.runways[k] === flight.id) this.runways[k] = null;
        if (flight.d >= path.total) flight.phase = "exited";
        break;
      }
      case "exited":
        flight.askedAt ??= now;
        break;
      case "taxiIn": {
        const path = move();
        // Off taxiway A onto its gate's lead-in: the next plane may go.
        if (this.apron === flight.id && flight.z <= TAXIWAY_Z - 2.5) {
          this.apron = null;
        }
        if (flight.d >= path.total) {
          flight.phase = "arrived";
          flight.arrivedAt = now;
          flight.path = null;
          flight.d = 0;
          flight.runway = null;
          if (this.apron === flight.id) this.apron = null;
        }
        break;
      }
      case "arrived":
        if (now - (flight.arrivedAt ?? now) >= ARRIVED_MS) return true;
        break;
    }
    this.place(flight, dt, false);
    return false;
  }

  /** Whether a plane circling is nearly at the turn-off. */
  private nearEntry(flight: Flight): boolean {
    const total = (flight.path as FlightPath).total;
    return (this.entry - flight.d + total) % total <= APPROACH_CALL;
  }

  /**
   * The runway whose hold line no one is headed for, used longest ago
   * (nearest the gate when two are even); null when every one is taken.
   */
  private freeHold(flight: Flight): number | null {
    const taken = new Set(
      [...this.flights.values()]
        .filter((f) => f.phase === "taxiOut" || f.phase === "holding")
        .map((f) => f.runway),
    );
    const free = RUNWAYS.map((_, k) => k).filter((k) => !taken.has(k));
    if (free.length === 0) return null;
    const gx = GATE_XS[flight.gate];
    return free.sort(
      (a, b) =>
        this.lastUsed[a] - this.lastUsed[b] ||
        Math.abs(RUNWAYS[a].linkX - gx) - Math.abs(RUNWAYS[b].linkX - gx),
    )[0];
  }

  /** Whether a plane is landing on, or stopped off, runway ``k``. */
  private exitTaken(k: number): boolean {
    return [...this.flights.values()].some(
      (f) =>
        f.runway === k &&
        (f.phase === "approach" ||
          f.phase === "exited" ||
          (f.phase === "circling" && this.runways[k] === f.id)),
    );
  }

  /** Put a plane where its path says, turning and banking it smoothly. */
  private place(flight: Flight, dt: number, snap: boolean): void {
    if (!flight.path) {
      flight.x = GATE_XS[flight.gate];
      flight.y = 0;
      flight.z = GATE_Z;
      flight.pitch = 0;
      flight.roll = 0;
      flight.yaw = snap
        ? AT_GATE_YAW
        : flight.yaw +
          Math.max(
            -GROUND_TURN * dt,
            Math.min(GROUND_TURN * dt, wrapAngle(AT_GATE_YAW - flight.yaw)),
          );
      return;
    }
    const at = samplePath(flight.path, flight.d);
    flight.x = at.x;
    flight.y = at.y;
    flight.z = at.z;
    const flat = Math.hypot(at.dx, at.dz);
    if (flat < 1e-6) return;
    const heading = at.reverse
      ? Math.atan2(-at.dx, -at.dz)
      : Math.atan2(at.dx, at.dz);
    const airborne = at.y > 0.05;
    const turn = wrapAngle(heading - flight.yaw);
    const maxTurn = (airborne ? AIR_TURN : GROUND_TURN) * dt;
    const step = snap ? turn : Math.max(-maxTurn, Math.min(maxTurn, turn));
    flight.yaw = wrapAngle(flight.yaw + step);
    const climb = at.reverse ? 0 : Math.atan2(at.dy, flat);
    flight.pitch = snap ? climb : flight.pitch + (climb - flight.pitch) * 0.1;
    const bank =
      airborne && dt > 0
        ? Math.max(-MAX_BANK, Math.min(MAX_BANK, (step / dt) * 0.35))
        : 0;
    flight.roll = snap ? bank : flight.roll + (bank - flight.roll) * 0.08;
  }

  /** The gate fewest planes use (``except`` aside), lowest first. */
  private freeGate(except?: string): number {
    const used = GATE_XS.map(() => 0);
    for (const f of this.flights.values()) {
      if (f.id === except) continue;
      const onStand =
        f.phase === "parked" ||
        f.phase === "arrived" ||
        f.phase === "taxiIn" ||
        (f.phase === "taxiOut" && f.d < 12);
      if (onStand) used[f.gate]++;
    }
    return used.indexOf(Math.min(...used));
  }

  /** The circuit lane fewest planes fly in. */
  private freeLane(): number {
    const used = this.circuits.map(() => 0);
    for (const f of this.flights.values()) used[f.lane]++;
    return used.indexOf(Math.min(...used));
  }

  /**
   * The stretch of the circuit farthest from the planes already circling:
   * the lanes share one track, so planes in other lanes count too, or they
   * would stack one above another.
   */
  private freeStretch(lane: number): number {
    const total = this.circuits[lane].total;
    const taken = [...this.flights.values()]
      .filter((f) => f.phase === "circling")
      .map((f) => f.d);
    if (taken.length === 0) return total * 0.3;
    let best = 0;
    let bestGap = -1;
    for (let i = 0; i < 48; i++) {
      const d = (i / 48) * total;
      const gap = Math.min(
        ...taken.map((t) => {
          const apart = Math.abs(t - d) % total;
          return Math.min(apart, total - apart);
        }),
      );
      if (gap > bestGap) {
        bestGap = gap;
        best = d;
      }
    }
    return best;
  }
}
