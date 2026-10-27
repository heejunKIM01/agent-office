import { describe, expect, it } from "vitest";
import {
  HOIST,
  HOIST_FOOT,
  ROOF_SPOTS,
  TRUCK_ROUTES,
  TRUCK_START,
  WORK_SPOTS,
} from "@/constants/sitePlan";
import {
  carrying,
  DIG_CYCLE,
  digPose,
  dumpsBetween,
  rideSeconds,
  stepVehicle,
  type Vehicle,
} from "@/systems/siteMachines";
import { clearOfBuilding } from "@/systems/siteWalk";

const DIG = -Math.PI / 2;
const DUMP = 2.8;

describe("digPose", () => {
  it("ends a dig where it began", () => {
    const start = digPose(0, DIG, DUMP);
    const end = digPose(DIG_CYCLE - 1e-9, DIG, DUMP);
    expect(end.boom).toBeCloseTo(start.boom, 5);
    expect(end.stick).toBeCloseTo(start.stick, 5);
    expect(end.bucket).toBeCloseTo(start.bucket, 5);
    expect(Math.cos(end.swing - start.swing)).toBeCloseTo(1, 5);
  });

  it("scoops at the pit and dumps at the other angle", () => {
    expect(digPose(1.5, DIG, DUMP).swing).toBeCloseTo(DIG, 5);
    expect(Math.cos(digPose(4, DIG, DUMP).swing - DUMP)).toBeCloseTo(1, 5);
  });

  it("carries earth from the scoop to the dump, once a cycle", () => {
    expect(carrying(1)).toBe(false);
    expect(carrying(3)).toBe(true);
    expect(carrying(5)).toBe(false);
    expect(carrying(3 + DIG_CYCLE)).toBe(true);
    expect(dumpsBetween(0, 4)).toBe(0);
    expect(dumpsBetween(4, 5)).toBe(1);
    expect(dumpsBetween(0, DIG_CYCLE * 3)).toBe(3);
  });
});

describe("stepVehicle", () => {
  const drive = (vehicle: Vehicle): Vehicle => {
    let v = vehicle;
    for (let i = 0; i < 2000 && v.legs.length > 0; i++)
      v = stepVehicle(v, 0.05);
    return v;
  };

  it("drives forwards nose first", () => {
    const v = stepVehicle(
      { x: 0, z: 0, heading: 0, legs: [{ x: 0, z: 10 }] },
      0.5,
    );
    expect(v.z).toBeGreaterThan(0);
    expect(v.heading).toBeCloseTo(0, 5);
  });

  it("backs up tail first", () => {
    const v = drive({
      x: 0,
      z: 0,
      heading: Math.PI / 2,
      legs: [{ x: -6, z: 0, reverse: true }],
    });
    expect(v.x).toBeCloseTo(-6, 5);
    expect(Math.cos(v.heading - Math.PI / 2)).toBeCloseTo(1, 3);
  });

  it("brings each truck to its stop and back out of the gate", () => {
    for (const kind of ["mixer", "dump"] as const) {
      const route = TRUCK_ROUTES[kind];
      const stopped = drive({ ...TRUCK_START, legs: route.in });
      const stop = route.in[route.in.length - 1];
      expect(stopped.x).toBeCloseTo(stop.x, 5);
      expect(stopped.z).toBeCloseTo(stop.z, 5);
      const out = drive({ ...stopped, legs: route.out });
      expect(out.z).toBeGreaterThan(TRUCK_START.z - 1);
    }
  });

  it("keeps the trucks' ways off the building", () => {
    for (const kind of ["mixer", "dump"] as const) {
      const route = TRUCK_ROUTES[kind];
      let at = { x: TRUCK_START.x, z: TRUCK_START.z };
      for (const leg of [...route.in, ...route.out]) {
        expect(clearOfBuilding(at, leg, 1)).toBe(true);
        at = leg;
      }
    }
  });
});

describe("the hoist", () => {
  it("takes longer to ride higher", () => {
    expect(rideSeconds(20)).toBeGreaterThan(rideSeconds(4));
    expect(rideSeconds(-4)).toBeCloseTo(rideSeconds(4), 5);
  });

  it("stands by the scaffold, with a roof spot over each scaffold spot", () => {
    expect(clearOfBuilding(HOIST_FOOT, WORK_SPOTS.build[0])).toBe(true);
    expect(
      Math.hypot(HOIST.x - HOIST_FOOT.x, HOIST.z - HOIST_FOOT.z),
    ).toBeLessThan(2);
    expect(ROOF_SPOTS.map((s) => s.x)).toEqual(
      WORK_SPOTS.build.map((s) => s.x),
    );
  });
});
