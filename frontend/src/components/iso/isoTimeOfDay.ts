/**
 * The office's real time on screen (systems/officeHours.ts says what part of
 * the day it is): the dev room clock's hands show the local time, and at
 * night a desk lamp lights up at each desk someone types at and an open
 * pizza box waits on Claude's desk once anyone has worked tonight.
 */

import * as THREE from "three";
import { CLAUDE_SEAT, type IsoSpot } from "@/constants/isoFloorPlan";
import { clockAngles, dayPart, workedTonight } from "@/systems/officeHours";
import { box, cylinder, material } from "./isoFurniture";
import { ISO_COLORS as C } from "./isoPalette";

/** The dev desks' top. */
const DESK_TOP = 0.75;
/** From a chair to the desk lamp beside its iMac, to the iMac's left. */
const LAMP_FROM_SEAT = { x: -0.5, z: -1.65 };
/** Lamps enough for a full row of typists. */
const LAMPS = 8;

/** A desk lamp, its base on the desk: an arm leaning in and a lit shade. */
function deskLamp(): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(0.08, 0.09, 0.03, C.lampMetal, 0, 0, 0, 14));
  const arm = box(0.03, 0.42, 0.03, C.lampMetal, 0, 0.03, 0);
  arm.rotation.x = 0.35;
  g.add(arm);
  const shade = cylinder(0.05, 0.12, 0.1, C.lampShade, 0, 0.36, 0.15, 16);
  shade.material = material(C.lampShade, {
    emissive: C.lampGlow,
  });
  g.add(shade);
  // A warm pool of light on the desk under the shade.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 24),
    new THREE.MeshBasicMaterial({
      color: C.lampGlow,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.005, 0.22);
  g.add(pool);
  g.visible = false;
  return g;
}

/** An open pizza box, its lid up at the back, a few slices of pepperoni pizza in it. */
function pizzaBox(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.44, 0.04, 0.44, C.pizzaBox, 0, 0, 0));
  const lid = new THREE.Group();
  lid.position.set(0, 0.04, -0.22);
  lid.add(box(0.44, 0.02, 0.44, C.pizzaBox, 0, 0, 0.22));
  lid.add(box(0.2, 0.004, 0.12, C.pizzaLogo, 0, 0.02, 0.22));
  lid.rotation.x = -1.85;
  g.add(lid);
  g.add(cylinder(0.19, 0.19, 0.02, C.pizzaCrust, 0, 0.04, 0, 24));
  g.add(cylinder(0.165, 0.165, 0.01, C.pizzaCheese, 0, 0.06, 0, 24));
  for (const [x, z] of [
    [-0.08, -0.05],
    [0.07, -0.08],
    [0.02, 0.07],
    [-0.09, 0.08],
    [0.1, 0.04],
  ]) {
    g.add(cylinder(0.028, 0.028, 0.008, C.pizzaPepperoni, x, 0.07, z, 10));
  }
  g.visible = false;
  return g;
}

export class IsoTimeOfDay {
  private readonly hands: { which: string; pivot: THREE.Object3D }[] = [];
  private readonly lamps: THREE.Group[] = [];
  private readonly pizza = pizzaBox();
  private lastWorkAt: number | null = null;

  constructor(office: THREE.Object3D) {
    office.traverse((object) => {
      const which = object.userData.clockHand as string | undefined;
      if (which) this.hands.push({ which, pivot: object });
    });
    for (let i = 0; i < LAMPS; i++) {
      const lamp = deskLamp();
      this.lamps.push(lamp);
      office.add(lamp);
    }
    // On Claude's desk past its iMac, at the end of the desk.
    this.pizza.position.set(
      CLAUDE_SEAT.x - 0.82,
      DESK_TOP,
      CLAUDE_SEAT.z - 1.4,
    );
    this.pizza.rotation.y = 0.15;
    office.add(this.pizza);
  }

  /** When the session last saw work (ms), to know whether anyone worked tonight. */
  setLastWork(at: number | null): void {
    this.lastWorkAt = at;
  }

  /** Set the clock, the lamps at ``typingSeats`` and the pizza for ``date``. */
  update(date: Date, typingSeats: readonly IsoSpot[]): void {
    const angles = clockAngles(date);
    for (const { which, pivot } of this.hands) {
      pivot.rotation.z = -angles[which as keyof typeof angles];
    }
    const night = dayPart(date) === "night";
    this.lamps.forEach((lamp, i) => {
      const seat = night ? typingSeats[i] : undefined;
      lamp.visible = seat !== undefined;
      if (seat) {
        lamp.position.set(
          seat.x + LAMP_FROM_SEAT.x,
          DESK_TOP,
          seat.z + LAMP_FROM_SEAT.z,
        );
      }
    });
    this.pizza.visible = workedTonight(this.lastWorkAt, date);
  }
}
