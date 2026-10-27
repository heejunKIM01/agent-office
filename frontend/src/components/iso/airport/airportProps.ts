/**
 * Things standing about the airport, built from the airport's own solids:
 * trees and shrubs, terminal seating, self check-in kiosks, the gate
 * agent's podium, a swivel chair, cafe tables, and the ground vehicles —
 * pushback tug, baggage train, fuel truck and fire truck. Each faces +z
 * with its origin on the ground at its centre.
 */

import * as THREE from "three";
import { AIR } from "./airportPalette";
import { box, cylinder, sphere } from "./airportSolids";

/** A rounded tree, varied a little by ``seed``. */
export function tree(seed: number): THREE.Group {
  const g = new THREE.Group();
  const height = 1.6 + (seed % 3) * 0.3;
  g.add(cylinder(0.12, 0.16, height, AIR.trunk, 0, 0, 0, 8));
  const crown = seed % 2 === 0 ? AIR.leafA : AIR.leafB;
  g.add(sphere(0.9, crown, 0, height + 0.4, 0, [12, 10]));
  g.add(sphere(0.65, crown, 0.45, height + 0.1, 0.2, [10, 8]));
  return g;
}

/** A low round shrub. */
export function shrub(seed: number): THREE.Group {
  const g = new THREE.Group();
  const color = seed % 2 === 0 ? AIR.leafB : AIR.leafA;
  g.add(sphere(0.5, color, 0, 0.35, 0, [10, 8]));
  g.add(sphere(0.38, color, 0.42, 0.28, 0.1, [10, 8]));
  g.add(sphere(0.34, color, -0.36, 0.25, -0.12, [10, 8]));
  return g;
}

/** A potted plant for indoors. */
export function pottedPlant(seed: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(0.26, 0.2, 0.42, AIR.pot, 0, 0, 0, 12));
  const color = seed % 2 === 0 ? AIR.leafA : AIR.leafB;
  g.add(sphere(0.42, color, 0, 0.82, 0, [10, 8]));
  return g;
}

/** A row of four joined seats, 4.2 long. */
export function bench(): THREE.Group {
  const g = new THREE.Group();
  const length = 4.2;
  g.add(box(0.12, 0.42, 0.5, AIR.seatFrame, -length / 2 + 0.3, 0, 0));
  g.add(box(0.12, 0.42, 0.5, AIR.seatFrame, length / 2 - 0.3, 0, 0));
  g.add(box(length, 0.06, 0.6, AIR.seatFrame, 0, 0.4, 0));
  for (let i = 0; i < 4; i++) {
    const sx = -length / 2 + 0.55 + i * 1.03;
    g.add(box(0.92, 0.12, 0.62, AIR.seat, sx, 0.46, 0));
    g.add(box(0.92, 0.6, 0.12, AIR.seat, sx, 0.52, -0.3));
  }
  return g;
}

/** A self check-in kiosk, its screen facing +z. */
export function kiosk(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.8, 0.12, 0.56, AIR.kiosk, 0, 0, 0));
  g.add(box(0.62, 1.7, 0.4, AIR.kiosk, 0, 0.12, -0.05));
  g.add(box(0.5, 0.6, 0.04, AIR.kioskScreen, 0, 1.05, 0.17, { shadow: false }));
  return g;
}

/** The gate agent's podium with a screen and a desk phone, facing +z. */
export function podium(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.8, 1.05, 0.7, AIR.deskFront, 0, 0, 0));
  g.add(box(1.9, 0.06, 0.8, AIR.desk, 0, 1.05, 0));
  const screen = box(0.62, 0.42, 0.05, AIR.screenFrame, -0.35, 1.11, -0.15);
  screen.rotation.x = -0.25;
  g.add(screen);
  g.add(box(0.26, 0.08, 0.2, AIR.white, 0.55, 1.11, -0.1));
  return g;
}

/** A swivel chair, its seat facing +z. */
export function chair(): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(0.32, 0.32, 0.06, AIR.chair, 0, 0.02, 0, 12));
  g.add(cylinder(0.05, 0.05, 0.4, AIR.steel, 0, 0.06, 0, 8));
  g.add(box(0.62, 0.1, 0.6, AIR.chair, 0, 0.46, 0));
  g.add(box(0.6, 0.68, 0.1, AIR.chair, 0, 0.52, -0.3));
  return g;
}

/** A cafe table with a chair either side. */
export function cafeSet(): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(0.06, 0.06, 0.7, AIR.steel, 0, 0, 0, 8));
  g.add(cylinder(0.55, 0.55, 0.05, AIR.cafeTable, 0, 0.7, 0, 18));
  for (const side of [-1, 1]) {
    const seat = new THREE.Group();
    seat.add(box(0.5, 0.06, 0.5, AIR.cafeChair, 0, 0.42, 0));
    seat.add(box(0.5, 0.5, 0.06, AIR.cafeChair, 0, 0.45, -0.22));
    for (const [lx, lz] of [
      [-0.2, -0.2],
      [0.2, -0.2],
      [-0.2, 0.2],
      [0.2, 0.2],
    ]) {
      seat.add(box(0.05, 0.42, 0.05, AIR.steel, lx, 0, lz));
    }
    seat.position.x = side * 1.05;
    seat.rotation.y = (side * -Math.PI) / 2;
    g.add(seat);
  }
  return g;
}

function wheel(x: number, z: number, radius = 0.22): THREE.Mesh {
  const mesh = cylinder(radius, radius, 0.16, AIR.tyre, 0, -0.08, 0, 12);
  mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, radius, z);
  return mesh;
}

/** A low yellow pushback tug, its cab at the back and its bar at the front. */
export function pushbackTug(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.5, 0.45, 2.2, AIR.tug, 0, 0.22, 0));
  g.add(box(0.9, 0.55, 0.7, AIR.tugDark, 0, 0.67, -0.55));
  g.add(box(0.8, 0.3, 0.05, AIR.window, 0, 0.85, -0.18, { shadow: false }));
  g.add(box(0.12, 0.12, 1.2, AIR.tugDark, 0, 0.3, 1.6));
  for (const [x, z] of [
    [-0.72, -0.7],
    [0.72, -0.7],
    [-0.72, 0.7],
    [0.72, 0.7],
  ]) {
    g.add(wheel(x, z));
  }
  return g;
}

/** A baggage tug pulling two carts of suitcases behind it (towards -z). */
export function baggageTrain(seed: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.9, 0.5, 1.1, AIR.tug, 0, 0.18, 0));
  g.add(box(0.8, 0.45, 0.45, AIR.tugDark, 0, 0.68, -0.2));
  for (const [x, z] of [
    [-0.45, -0.35],
    [0.45, -0.35],
    [-0.45, 0.35],
    [0.45, 0.35],
  ]) {
    g.add(wheel(x, z, 0.18));
  }
  for (let c = 0; c < 2; c++) {
    const cz = -1.35 - c * 1.35;
    g.add(box(0.06, 0.06, 0.4, AIR.tugDark, 0, 0.25, cz + 0.75));
    g.add(box(0.95, 0.12, 1.1, AIR.cart, 0, 0.25, cz));
    for (let i = 0; i < 3; i++) {
      const bag = AIR.cartBag[(seed + c * 3 + i) % AIR.cartBag.length];
      g.add(
        box(0.32, 0.38, 0.5, bag, -0.28 + i * 0.28, 0.37, cz + (i % 2) * 0.1),
      );
    }
    for (const [x, z] of [
      [-0.42, cz - 0.35],
      [0.42, cz - 0.35],
      [-0.42, cz + 0.35],
      [0.42, cz + 0.35],
    ]) {
      g.add(wheel(x, z, 0.14));
    }
  }
  return g;
}

/** A fuel truck: a cab at the front and a white tank behind. */
export function fuelTruck(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.4, 1.2, 1.5, AIR.tug, 0, 0.3, 1.6));
  g.add(box(1.25, 0.5, 0.06, AIR.window, 0, 1.0, 2.36, { shadow: false }));
  const tank = cylinder(0.7, 0.7, 3, AIR.fuel, 0, -1.5, 0, 14);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(0, 1.05, -0.4);
  g.add(tank);
  g.add(box(1.5, 0.3, 4.6, AIR.tugDark, 0, 0.15, 0.4));
  return g;
}

/** A red fire truck with its water cannon on the roof. */
export function fireTruck(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.6, 1.4, 4, AIR.fireTruck, 0, 0.3, 0));
  g.add(box(1.4, 0.5, 0.06, AIR.window, 0, 1.15, 2.02, { shadow: false }));
  g.add(box(1.6, 0.3, 4, AIR.tugDark, 0, 0, 0));
  g.add(cylinder(0.18, 0.22, 0.3, AIR.steel, 0, 1.7, 0.6, 10));
  const nozzle = cylinder(0.08, 0.1, 0.9, AIR.steel, 0, 0, 0, 8);
  nozzle.rotation.x = Math.PI / 3;
  nozzle.position.set(0, 2.15, 0.95);
  g.add(nozzle);
  for (const [x, z] of [
    [-0.8, -1.3],
    [0.8, -1.3],
    [-0.8, 1.3],
    [0.8, 1.3],
  ]) {
    g.add(wheel(x, z, 0.3));
  }
  return g;
}
