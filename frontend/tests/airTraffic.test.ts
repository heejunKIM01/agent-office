import { describe, expect, it } from "vitest";
import {
  GATE_XS,
  GATE_Z,
  RUNWAYS,
  RUNWAY_WIDTH,
  TAXIWAY,
  TAXIWAY_Z,
} from "@/constants/isoAirportPlan";
import {
  AirTraffic,
  ARRIVED_MS,
  circuitPath,
  makePath,
  rollX,
  samplePath,
  taxiOutPath,
  type Clearance,
  type Flight,
} from "@/systems/airTraffic";

const DT = 0.05;

/** Run the tower until ``done`` (or ``limit`` seconds), gathering what happened. */
function runUntil(
  traffic: AirTraffic,
  done: () => boolean,
  start = 0,
  limit = 180,
  each?: (now: number, cleared: Clearance[]) => void,
): { now: number; cleared: Clearance[]; gone: string[] } {
  const cleared: Clearance[] = [];
  const gone: string[] = [];
  let now = start;
  while (!done() && now - start < limit * 1000) {
    now += DT * 1000;
    const step = traffic.step(DT, now);
    cleared.push(...step.cleared);
    gone.push(...step.gone);
    each?.(now, step.cleared);
  }
  return { now, cleared, gone };
}

describe("flight paths", () => {
  it("walks a path by distance and wraps a loop", () => {
    const path = makePath([
      { x: 0, y: 0, z: 0, speed: 1 },
      { x: 10, y: 0, z: 0, speed: 3 },
    ]);
    expect(path.total).toBe(10);
    expect(samplePath(path, 5)).toMatchObject({ x: 5, speed: 2, dx: 10 });
    expect(samplePath(path, 20).x).toBe(10);
    const loop = circuitPath(0);
    const a = samplePath(loop, 3);
    const b = samplePath(loop, loop.total + 3);
    expect(b.x).toBeCloseTo(a.x);
    expect(b.z).toBeCloseTo(a.z);
  });

  it("pushes back from the gate tail first and stops short of the runway", () => {
    const runway = RUNWAYS[1];
    const path = taxiOutPath(0, runway);
    expect(samplePath(path, 0)).toMatchObject({
      x: GATE_XS[0],
      z: GATE_Z,
      reverse: true,
    });
    const end = samplePath(path, path.total);
    expect(end.x).toBe(runway.linkX);
    // A plane's nose and tail are about 4.3 from its centre: it waits clear
    // of both the runway and taxiway A.
    expect(end.z + 4.3).toBeLessThan(runway.z - RUNWAY_WIDTH / 2);
    expect(end.z - 4.3).toBeGreaterThan(TAXIWAY.z + TAXIWAY.d);
  });
});

describe("AirTraffic", () => {
  it("sends a boarding plane to a runway, clears it to take off, and it joins the circuit", () => {
    const traffic = new AirTraffic();
    const flight = traffic.add("a", "gate");
    expect(flight.phase).toBe("parked");
    const { cleared } = runUntil(traffic, () => flight.phase === "circling");
    expect(cleared).toHaveLength(1);
    expect(cleared[0]).toMatchObject({ id: "a", kind: "takeoff" });
    expect(RUNWAYS.map((r) => r.names[0])).toContain(cleared[0].runway);
    expect(flight.y).toBeGreaterThan(5);
    expect(traffic.apronHolder).toBeNull();
    expect(traffic.runwayHolders.every((h) => h === null)).toBe(true);
  });

  it("lets one plane at a time on the apron, and spreads departures over the runways", () => {
    const traffic = new AirTraffic();
    const planes = ["a", "b", "c"].map((id) => traffic.add(id, "gate"));
    const used = new Set<string>();
    runUntil(
      traffic,
      () => planes.every((p) => p.phase === "circling"),
      0,
      180,
      (_now, cleared) => {
        for (const c of cleared) used.add(c.runway);
        const onApron = planes.filter(
          (p) => p.phase === "taxiOut" && p.z < TAXIWAY_Z + 3,
        );
        expect(onApron.length).toBeLessThanOrEqual(1);
      },
    );
    expect(planes.every((p) => p.phase === "circling")).toBe(true);
    expect(used.size).toBe(3);
  });

  it("frees a runway once the departure on it starts its roll", () => {
    const traffic = new AirTraffic();
    const flight = traffic.add("a", "gate");
    runUntil(traffic, () => flight.phase === "takeoff");
    const k = flight.runway as number;
    expect(traffic.runwayHolders[k]).toBe("a");
    runUntil(traffic, () => flight.x >= rollX(RUNWAYS[k]) + 1);
    expect(traffic.runwayHolders[k]).toBeNull();
  });

  it("lands a plane whose work is done, taxis it to a gate and lets it go", () => {
    const traffic = new AirTraffic();
    const flight = traffic.add("a", "air");
    expect(flight.phase).toBe("circling");
    traffic.setLeaving("a", true);
    const phases = new Set<Flight["phase"]>();
    const { now, cleared } = runUntil(
      traffic,
      () => flight.phase === "arrived",
      0,
      180,
      () => phases.add(flight.phase),
    );
    expect(cleared).toHaveLength(1);
    expect(cleared[0]).toMatchObject({ id: "a", kind: "landing" });
    expect([...phases]).toEqual(
      expect.arrayContaining(["approach", "exited", "taxiIn", "arrived"]),
    );
    expect(flight.x).toBe(GATE_XS[flight.gate]);
    expect(flight.z).toBe(GATE_Z);
    const after = runUntil(traffic, () => false, now, ARRIVED_MS / 1000 + 0.5);
    expect(after.gone).toEqual(["a"]);
    expect(traffic.flights.size).toBe(0);
  });

  it("never takes off with work already done: it is gone from its gate", () => {
    const traffic = new AirTraffic();
    traffic.add("a", "gate");
    traffic.setLeaving("a", true);
    const { cleared, gone } = runUntil(
      traffic,
      () => false,
      0,
      ARRIVED_MS / 1000 + 1,
    );
    expect(cleared).toEqual([]);
    expect(gone).toEqual(["a"]);
  });

  it("lets planes that took off together drift apart in their lanes", () => {
    const traffic = new AirTraffic();
    const planes = ["a", "b", "c"].map((id) => traffic.add(id, "gate"));
    runUntil(traffic, () => planes.every((p) => p.phase === "circling"));
    const spread = (): number =>
      Math.max(...planes.map((p) => p.d)) - Math.min(...planes.map((p) => p.d));
    const before = spread();
    runUntil(traffic, () => false, 0, 10);
    expect(spread()).toBeGreaterThan(before);
  });

  it("spreads planes put in the air over the circuit's lanes", () => {
    const traffic = new AirTraffic();
    const planes = ["a", "b", "c", "d"].map((id) => traffic.add(id, "air"));
    expect(new Set(planes.slice(0, 3).map((p) => p.lane)).size).toBe(3);
    // Not stacked one above another in different lanes either.
    for (const p of planes) {
      for (const q of planes) {
        if (p !== q) {
          expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThan(20);
        }
      }
    }
  });
});
