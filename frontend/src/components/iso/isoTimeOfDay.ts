/**
 * The office's real time on screen (systems/officeHours.ts says what part of
 * the day it is): the dev room clock's hands show the local time, and at
 * night a desk lamp lights up at each desk someone types at and an open
 * pizza box waits on the reception desk once anyone has worked tonight.
 */

import * as THREE from "three";
import {
  FURNITURE,
  type Furniture,
  type IsoSpot,
} from "@/constants/isoFloorPlan";
import { clockAngles, dayPart, workedTonight } from "@/systems/officeHours";
import { box, cylinder, material } from "./isoFurniture";
import { ISO_COLORS as C } from "./isoPalette";

/** The dev desks' top. */
const DESK_TOP = 0.75;
/**
 * From a chair to its desk lamp: at the back of the desk, past the iMac's
 * right edge. The one sitting there hides anything nearer.
 */
const LAMP_FROM_SEAT = { x: 0.95, z: -1.8 };
/**
 * The reception desk's top, and where on it the pizza goes (along its length,
 * across): left of my monitor, leaving the desk's end to the pot (isoPlant.ts).
 */
const RECEPTION_TOP = 1.01;
const PIZZA_ON_DESK = { along: -1.55, across: 0.05 };
/** Lamps enough for a full row of typists. */
const LAMPS = 8;

/** A desk lamp, its base on the desk: an arm leaning in and a lit shade. */
function deskLamp(): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(0.11, 0.12, 0.04, C.lampMetal, 0, 0, 0, 14));
  const arm = box(0.04, 0.62, 0.04, C.lampMetal, 0, 0.04, 0);
  arm.rotation.x = 0.35;
  g.add(arm);
  const shade = cylinder(0.07, 0.18, 0.14, C.lampShade, 0, 0.52, 0.22, 16);
  shade.material = material(C.lampShade, {
    emissive: C.lampGlow,
  });
  g.add(shade);
  // A soft glow round the shade, so the lamp shows over the iMac in front.
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 12),
    new THREE.MeshBasicMaterial({
      color: C.lampGlow,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  halo.position.set(0, 0.58, 0.22);
  g.add(halo);
  // A warm pool of light on the desk under the shade.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 28),
    new THREE.MeshBasicMaterial({
      color: C.lampGlow,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.005, 0.3);
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
    // On the reception desk by my chair, past the monitor: the dev desks'
    // ends are hidden behind whoever sits there.
    const desk = FURNITURE.find(
      (piece): piece is Furniture => piece.kind === "receptionDesk",
    );
    const turn = ((desk?.rot ?? 0) * Math.PI) / 2;
    const { along, across } = PIZZA_ON_DESK;
    this.pizza.position.set(
      (desk?.x ?? 0) + along * Math.cos(turn) + across * Math.sin(turn),
      RECEPTION_TOP,
      (desk?.z ?? 0) - along * Math.sin(turn) + across * Math.cos(turn),
    );
    this.pizza.rotation.y = turn + 0.2;
    this.pizza.scale.setScalar(1.3);
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
