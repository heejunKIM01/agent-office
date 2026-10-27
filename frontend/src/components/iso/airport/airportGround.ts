/**
 * The ground crew at each gate (설정 「장소」 · 공항). The jet bridge reaches
 * out to a plane at the gate and draws back when it leaves. The pushback
 * tug drives up to a boarding plane's nose, pushes it back onto taxiway A
 * and drives home again. A baggage train comes to a parked plane's side
 * and goes when it leaves. The marshaller waves an arriving plane in,
 * crosses the wands as it stops, and waves a departing one off.
 */

import * as THREE from "three";
import { GATE_XS, GATE_Z, TERMINAL } from "@/constants/isoAirportPlan";
import { samplePath, type Flight } from "@/systems/airTraffic";
import {
  buildCrew,
  poseCrew,
  type CrewPose,
  type CrewRig,
} from "./airportFigures";
import { AIR } from "./airportPalette";
import { baggageTrain, pushbackTug } from "./airportProps";
import { box } from "./airportSolids";

/** The terminal's glass front, where the jet bridges start. */
const GLASS_Z = TERMINAL.z + TERMINAL.d + 0.1;
/** A plane's nose at the gate, and how far a bridge reaches either way. */
const NOSE_Z = GATE_Z - 4.25;
const BRIDGE_SHORT = 2.6;
const BRIDGE_LONG = NOSE_Z - GLASS_Z - 0.9;
/** From a plane's centre to its nose wheel, and on to the tug's centre. */
const NOSE_WHEEL = 3.1;
const TUG_REACH = 2.3;
const TUG_SPEED = 5;
const BRIDGE_SPEED = 0.6;
const TRAIN_SPEED = 0.45;
/** An arriving plane this close to its stand is waved in; closer still, stopped. */
const WAVE_IN = 16;
const STOP_AT = 1.5;

interface Bridge {
  tunnel: THREE.Object3D;
  cab: THREE.Object3D;
  reach: number;
}

interface Gate {
  x: number;
  bridge: Bridge;
  tug: THREE.Group;
  train: THREE.Group;
  trainOut: number;
  marshal: CrewRig;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

function moveToward(from: number, to: number, step: number): number {
  return Math.abs(to - from) <= step ? to : from + Math.sign(to - from) * step;
}

const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

function buildBridge(x: number): { group: THREE.Group; bridge: Bridge } {
  const group = new THREE.Group();
  group.position.set(x, 0, GLASS_Z);
  // A unit-long tunnel, stretched to the reach.
  const tunnel = new THREE.Group();
  tunnel.add(box(1.5, 1.3, 1, AIR.bridge, 0, 1.9, 0.5));
  tunnel.add(
    box(1.54, 0.34, 0.9, AIR.bridgeGlass, 0, 2.55, 0.5, { opacity: 0.6 }),
  );
  group.add(tunnel);
  const cab = new THREE.Group();
  cab.add(box(1.9, 1.5, 1, AIR.bridgeCab, 0, 1.8, 0.4));
  cab.add(box(0.3, 1.9, 0.3, AIR.steel, 0, 0, -0.6));
  cab.add(box(0.9, 0.25, 0.5, AIR.tugDark, 0, 0, -0.6));
  group.add(cab);
  return { group, bridge: { tunnel, cab, reach: 0 } };
}

function setReach(bridge: Bridge): void {
  const length =
    BRIDGE_SHORT + (BRIDGE_LONG - BRIDGE_SHORT) * smooth(bridge.reach);
  bridge.tunnel.scale.z = length;
  bridge.cab.position.z = length;
}

const tugHome = (x: number): { x: number; z: number } => ({
  x: x - 3.4,
  z: GLASS_Z + 3.3,
});
const trainHome = (x: number): { x: number; z: number } => ({
  x: x + 2.6,
  z: GLASS_Z + 3.5,
});
const trainAtPlane = (x: number): { x: number; z: number } => ({
  x: x + 2.6,
  z: GATE_Z + 3.4,
});

export class GateCrews {
  private readonly gates: Gate[];
  private readonly root = new THREE.Group();

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    this.gates = GATE_XS.map((x, i) => {
      const { group, bridge } = buildBridge(x);
      setReach(bridge);
      const tug = pushbackTug();
      const home = tugHome(x);
      tug.position.set(home.x, 0, home.z);
      const train = baggageTrain(i);
      const parked = trainHome(x);
      train.position.set(parked.x, 0, parked.z);
      train.rotation.y = Math.PI;
      const marshal = buildCrew("marshal");
      marshal.root.position.set(x - 1.8, 0, NOSE_Z - 1.7);
      this.root.add(group, tug, train, marshal.root);
      return { x, bridge, tug, train, trainOut: 0, marshal };
    });
  }

  /** Move each gate's crew for this frame; ``now`` in ms, ``dt`` in s. */
  update(flights: Iterable<Flight>, now: number, dt: number): void {
    const byGate = new Map<number, Flight[]>();
    for (const flight of flights) {
      byGate.set(flight.gate, [...(byGate.get(flight.gate) ?? []), flight]);
    }
    this.gates.forEach((gate, g) => {
      const here = byGate.get(g) ?? [];
      const atStand = here.find(
        (f) => f.phase === "parked" || f.phase === "arrived",
      );
      const comingIn = here.find((f) => f.phase === "taxiIn");
      const remaining = comingIn?.path
        ? comingIn.path.total - comingIn.d
        : Infinity;
      const pushing = here.find(
        (f) =>
          f.phase === "taxiOut" &&
          f.path !== null &&
          samplePath(f.path, f.d).reverse,
      );
      const docked = atStand !== undefined || remaining < 2;
      // The bridge.
      gate.bridge.reach = moveToward(
        gate.bridge.reach,
        docked ? 1 : 0,
        BRIDGE_SPEED * dt,
      );
      setReach(gate.bridge);
      // The tug: on the nose while pushing, up to a boarding plane's nose,
      // home otherwise.
      if (pushing) {
        const ahead = NOSE_WHEEL + TUG_REACH;
        gate.tug.position.set(
          pushing.x + Math.sin(pushing.yaw) * ahead,
          0,
          pushing.z + Math.cos(pushing.yaw) * ahead,
        );
        gate.tug.rotation.y = pushing.yaw + Math.PI;
      } else {
        const target =
          atStand?.phase === "parked"
            ? { x: gate.x, z: GATE_Z - NOSE_WHEEL - TUG_REACH }
            : tugHome(gate.x);
        this.drive(gate.tug, target, 0, dt);
      }
      // The baggage train, out by a parked plane's side.
      gate.trainOut = moveToward(
        gate.trainOut,
        atStand ? 1 : 0,
        TRAIN_SPEED * dt,
      );
      const from = trainHome(gate.x);
      const to = trainAtPlane(gate.x);
      const t = smooth(gate.trainOut);
      gate.train.position.set(from.x, 0, from.z + (to.z - from.z) * t);
      // The marshaller.
      let pose: CrewPose = "stand";
      if (comingIn && remaining < WAVE_IN) {
        pose = remaining < STOP_AT ? "stop" : "signal";
      } else if (
        atStand?.phase === "arrived" &&
        now - (atStand.arrivedAt ?? now) < 1500
      ) {
        pose = "stop";
      } else if (pushing) {
        pose = "signal";
      }
      poseCrew(gate.marshal, pose, now / 1000);
    });
  }

  /** Drive a vehicle towards ``target``, facing where it goes, then ``facing``. */
  private drive(
    vehicle: THREE.Object3D,
    target: { x: number; z: number },
    facing: number,
    dt: number,
  ): void {
    const dx = target.x - vehicle.position.x;
    const dz = target.z - vehicle.position.z;
    const distance = Math.hypot(dx, dz);
    const step = TUG_SPEED * dt;
    if (distance > 0.05) {
      const k = Math.min(1, step / distance);
      vehicle.position.x += dx * k;
      vehicle.position.z += dz * k;
    }
    const heading = distance > 0.3 ? Math.atan2(dx, dz) : facing;
    const turn = wrapAngle(heading - vehicle.rotation.y);
    vehicle.rotation.y += Math.max(-3 * dt, Math.min(3 * dt, turn));
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
