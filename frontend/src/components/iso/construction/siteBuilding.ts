/**
 * The building going up on the construction site: a foundation, then a
 * floor for each commit (systems/siteWalk.ts' ``floorsFor``). Each floor is
 * a concrete frame with its slab on top; floors two below the roof and
 * lower get their walls and windows, so the finished part rises behind
 * the raw frame. Rebar sticks up from the roof, and a scaffold with a
 * green safety net climbs the front with it.
 */

import * as THREE from "three";
import {
  BUILDING,
  FLOOR_HEIGHT,
  FOUNDATION_HEIGHT,
  MAX_FLOORS,
} from "@/constants/sitePlan";
import { SITE } from "./sitePalette";
import { box, cylinder } from "./siteSolids";

/** Floors this far below the roof and lower are finished with walls and windows. */
const RAW_FLOORS = 2;
const COLUMNS: [number, number][] = [
  [0.4, 0.4],
  [BUILDING.w / 2, 0.4],
  [BUILDING.w - 0.4, 0.4],
  [0.4, BUILDING.d - 0.4],
  [BUILDING.w / 2, BUILDING.d - 0.4],
  [BUILDING.w - 0.4, BUILDING.d - 0.4],
];

interface Floor {
  group: THREE.Group;
  /** Walls and windows, shown once the floor is finished. */
  finish: THREE.Group;
}

function buildFloor(level: number): Floor {
  const { w, d } = BUILDING;
  const group = new THREE.Group();
  group.position.y = FOUNDATION_HEIGHT + level * FLOOR_HEIGHT;
  const height = FLOOR_HEIGHT - 0.3;
  for (const [x, z] of COLUMNS) {
    group.add(box(0.5, height, 0.5, SITE.concrete, x, 0, z));
  }
  group.add(box(w, 0.3, d, SITE.slab, w / 2, height, d / 2));
  const finish = new THREE.Group();
  // Concrete at the back and left, glass with mullions at the front and right.
  finish.add(
    box(w, height, 0.2, SITE.concreteDark, w / 2, 0, 0.1, {
      emissive: SITE.concreteGlow,
    }),
  );
  finish.add(
    box(0.2, height, d, SITE.concreteDark, 0.1, 0, d / 2, {
      emissive: SITE.concreteGlow,
    }),
  );
  finish.add(
    box(w - 0.6, height - 0.2, 0.08, SITE.window, w / 2, 0.1, d - 0.15, {
      opacity: 0.8,
    }),
  );
  finish.add(
    box(0.08, height - 0.2, d - 0.6, SITE.window, w - 0.15, 0.1, d / 2, {
      opacity: 0.8,
    }),
  );
  for (let x = 2; x < w; x += 2) {
    finish.add(
      box(0.1, height, 0.12, SITE.concrete, x, 0, d - 0.12, { shadow: false }),
    );
  }
  for (let z = 2; z < d; z += 2) {
    finish.add(
      box(0.12, height, 0.1, SITE.concrete, w - 0.12, 0, z, { shadow: false }),
    );
  }
  finish.visible = false;
  group.add(finish);
  return { group, finish };
}

export class SiteBuilding {
  readonly root = new THREE.Group();
  private readonly floors: Floor[] = [];
  private readonly rebar = new THREE.Group();
  private readonly scaffold = new THREE.Group();
  private readonly poles: THREE.Mesh[] = [];
  private readonly planks: THREE.Mesh[] = [];
  private readonly net: THREE.Mesh;
  private count = 0;

  constructor() {
    const { x, z, w, d } = BUILDING;
    this.root.position.set(x, 0, z);
    this.root.add(
      box(w + 1, FOUNDATION_HEIGHT, d + 1, SITE.concreteDark, w / 2, 0, d / 2),
    );
    for (let level = 0; level < MAX_FLOORS; level++) {
      const floor = buildFloor(level);
      floor.group.visible = false;
      this.floors.push(floor);
      this.root.add(floor.group);
    }
    for (const [cx, cz] of COLUMNS) {
      for (const dx of [-0.12, 0.12]) {
        this.rebar.add(
          cylinder(0.035, 0.035, 0.9, SITE.rebar, cx + dx, 0, cz, 6),
        );
      }
    }
    this.root.add(this.rebar);
    // The scaffold along the front, standing off the building a little.
    const front = d + 0.7;
    for (let px = 0; px <= w; px += 2) {
      const pole = box(0.08, 1, 0.08, SITE.scaffold, px, 0, front);
      this.poles.push(pole);
      this.scaffold.add(pole);
      const back = box(0.08, 1, 0.08, SITE.scaffold, px, 0, front - 0.5);
      this.poles.push(back);
      this.scaffold.add(back);
    }
    for (let level = 0; level <= MAX_FLOORS; level++) {
      const plank = box(
        w,
        0.06,
        0.6,
        SITE.plank,
        w / 2,
        FOUNDATION_HEIGHT + level * FLOOR_HEIGHT,
        front - 0.25,
      );
      plank.visible = false;
      this.planks.push(plank);
      this.scaffold.add(plank);
    }
    this.net = box(w + 0.2, 1, 0.04, SITE.net, w / 2, 0, front + 0.06, {
      opacity: 0.45,
    });
    this.scaffold.add(this.net);
    this.root.add(this.scaffold);
    this.setFloors(1);
  }

  /** How many floors stand. */
  get floorCount(): number {
    return this.count;
  }

  /** The roof's height, where the next slab goes. */
  get roofY(): number {
    return FOUNDATION_HEIGHT + this.count * FLOOR_HEIGHT;
  }

  /** Stand ``count`` floors, finishing all but the top ones. */
  setFloors(count: number): void {
    this.count = Math.max(1, Math.min(MAX_FLOORS, count));
    this.floors.forEach((floor, level) => {
      floor.group.visible = level < this.count;
      floor.finish.visible = level < this.count - RAW_FLOORS;
    });
    const roof = this.roofY;
    this.rebar.position.y = roof;
    this.rebar.visible = this.count < MAX_FLOORS;
    const top = roof + 1;
    for (const pole of this.poles) {
      pole.scale.y = top;
      pole.position.y = top / 2;
    }
    this.planks.forEach((plank, level) => {
      plank.visible = level <= this.count;
    });
    // The net covers the raw floors at the top.
    const netBottom = Math.max(
      FOUNDATION_HEIGHT,
      roof - RAW_FLOORS * FLOOR_HEIGHT,
    );
    this.net.scale.y = top - netBottom;
    this.net.position.y = netBottom + (top - netBottom) / 2;
  }
}
