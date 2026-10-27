/**
 * A plane of the isometric airport: a short, round airliner built from the
 * airport's solids, white with its livery colour on the tail, engines and
 * wingtips. It carries its lights: a red beacon on top and below, red and
 * green navigation lights and white strobes at the wingtips, and landing
 * lights at the wing roots, each switched on and off by the scene. It
 * faces +z at rotation 0 with its wheels on the ground at the origin.
 */

import * as THREE from "three";
import { box, cylinder, lamp, material, sphere } from "./airportSolids";

const BODY = "#f7f8fa";
const WING = "#dfe4ea";
const WINDOW = "#2f3a4d";
const COCKPIT = "#253047";
const TYRE = "#2a2d33";
const STRUT = "#9aa4b2";
const INTAKE = "#3a4150";

/** Fuselage radius and the height of its centre line. */
const RADIUS = 0.95;
const BODY_Y = 1.55;
const BODY_LENGTH = 6.6;

export interface PlaneLights {
  /** Red, on top and below: blinking while the engines run. */
  beacons: THREE.Object3D[];
  /** White at the wingtips: flashing on the runway and in the air. */
  strobes: THREE.Object3D[];
  /** Red at the left wingtip, green at the right: on while the engines run. */
  navs: THREE.Object3D[];
  /** At the wing roots: on for takeoff and landing. */
  landing: THREE.Object3D[];
}

export interface PlaneRig {
  root: THREE.Group;
  /** Wheels and struts, folded away in the air. */
  gear: THREE.Group;
  lights: PlaneLights;
  /** Where the data tag hangs, above the tail. */
  tagAnchor: THREE.Object3D;
}

const NAV_RED = "#ff3b3b";
const NAV_GREEN = "#3dff8a";
const STROBE = "#ffffff";

/** Facing +z, the plane's left is +x: its red light goes there. */
function wing(side: 1 | -1, livery: string, lights: PlaneLights): THREE.Group {
  const g = new THREE.Group();
  // Swept back a little, its root at the fuselage.
  g.add(box(3.9, 0.16, 1.6, WING, side * 2.15, 0, 0));
  g.add(box(0.12, 0.55, 0.7, livery, side * 4.05, 0.08, -0.35));
  const nav = sphere(
    0.1,
    lamp(side === 1 ? NAV_RED : NAV_GREEN),
    side * 4.14,
    0.1,
    0.05,
    [8, 6],
  );
  const strobe = sphere(0.11, lamp(STROBE), side * 4.14, 0.1, -0.45, [8, 6]);
  nav.castShadow = false;
  strobe.castShadow = false;
  g.add(nav, strobe);
  lights.navs.push(nav);
  lights.strobes.push(strobe);
  g.position.set(0, 1.08, 0.3);
  g.rotation.y = side * -0.22;
  return g;
}

function engine(side: 1 | -1, livery: string): THREE.Group {
  const g = new THREE.Group();
  const nacelle = cylinder(0.42, 0.36, 1.5, livery, 0, -0.75, 0, 16);
  nacelle.rotation.x = Math.PI / 2;
  g.add(nacelle);
  const intake = cylinder(0.32, 0.32, 0.04, INTAKE, 0, -0.02, 0, 16);
  intake.rotation.x = Math.PI / 2;
  intake.position.z = 0.76;
  g.add(intake);
  // Pylon up to the wing.
  g.add(box(0.12, 0.3, 0.7, WING, 0, 0.32, 0));
  g.position.set(side * 2.05, 0.72, 0.85);
  return g;
}

function wheel(x: number, z: number, strut: number): THREE.Group {
  const g = new THREE.Group();
  const tyre = cylinder(0.26, 0.26, 0.22, TYRE, 0, -0.11, 0, 14);
  tyre.rotation.z = Math.PI / 2;
  tyre.position.y = 0.26;
  g.add(tyre);
  g.add(box(0.08, strut, 0.08, STRUT, 0, 0.26, 0));
  g.position.set(x, 0, z);
  return g;
}

/** Build one plane in ``livery`` at the origin, facing +z. */
export function buildAirplane(livery: string): PlaneRig {
  const root = new THREE.Group();
  root.rotation.order = "YXZ";
  const lights: PlaneLights = {
    beacons: [],
    strobes: [],
    navs: [],
    landing: [],
  };

  const fuselage = new THREE.Mesh(
    new THREE.CapsuleGeometry(RADIUS, BODY_LENGTH, 8, 18),
    material(BODY),
  );
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.y = BODY_Y;
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  root.add(fuselage);

  // Cockpit windows round the nose, and a row of cabin windows a side.
  root.add(
    box(1.2, 0.32, 0.5, COCKPIT, 0, BODY_Y + 0.28, BODY_LENGTH / 2 + 0.3),
  );
  for (const side of [1, -1] as const) {
    for (let i = 0; i < 9; i++) {
      root.add(
        box(
          0.06,
          0.22,
          0.2,
          WINDOW,
          side * (RADIUS - 0.02),
          BODY_Y + 0.12,
          -2.4 + i * 0.6,
          { shadow: false },
        ),
      );
    }
    // A cheat line in the livery under the windows.
    root.add(
      box(0.05, 0.12, 6.2, livery, side * (RADIUS - 0.03), BODY_Y - 0.28, 0, {
        shadow: false,
      }),
    );
    root.add(wing(side, livery, lights), engine(side, livery));
    const landing = box(
      0.3,
      0.14,
      0.08,
      lamp(STROBE),
      side * 1.15,
      1.08,
      1.12,
      { shadow: false },
    );
    root.add(landing);
    lights.landing.push(landing);
  }
  for (const [y, z] of [
    [BODY_Y + RADIUS + 0.04, 0.6],
    [BODY_Y - RADIUS - 0.04, -0.6],
  ]) {
    const beacon = sphere(0.13, lamp(NAV_RED), 0, y, z, [8, 6]);
    beacon.castShadow = false;
    root.add(beacon);
    lights.beacons.push(beacon);
  }

  // Tail: a fin in the livery and the tailplane.
  const fin = box(0.16, 1.9, 1.5, livery, 0, 0, 0);
  const finMount = new THREE.Group();
  finMount.add(fin);
  finMount.position.set(0, BODY_Y + 0.55, -BODY_LENGTH / 2 - 0.2);
  finMount.rotation.x = -0.38;
  root.add(finMount);
  const tailplane = box(
    3.2,
    0.12,
    0.95,
    WING,
    0,
    BODY_Y + 0.25,
    -BODY_LENGTH / 2 - 0.35,
  );
  root.add(tailplane);

  const gear = new THREE.Group();
  gear.add(
    wheel(0, BODY_LENGTH / 2 - 0.2, 0.75),
    wheel(0.85, -0.3, 0.6),
    wheel(-0.85, -0.3, 0.6),
  );
  root.add(gear);

  const tagAnchor = new THREE.Object3D();
  tagAnchor.position.y = 4.4;
  root.add(tagAnchor);
  return { root, gear, lights, tagAnchor };
}
