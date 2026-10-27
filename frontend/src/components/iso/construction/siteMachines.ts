/**
 * The construction site's moving machines, drawn from systems/siteMachines.ts:
 * the excavator that digs while someone runs commands and heaps the earth
 * (or loads it into a waiting dump truck), the construction hoist whose
 * cage carries workers up to the roof, and the trucks that come in through
 * the gate — a concrete mixer to pour when a commit raises a floor, a dump
 * truck to carry the dug earth away.
 */

import * as THREE from "three";
import {
  DIG_PIT,
  DIRT_HEAP,
  DUMP_STOP,
  EXCAVATOR,
  HOIST,
  TRUCK_ROUTES,
  TRUCK_START,
} from "@/constants/sitePlan";
import {
  carrying,
  DIG_REST,
  digPose,
  dumpsBetween,
  stepVehicle,
  type DigPose,
  type Vehicle,
} from "@/systems/siteMachines";
import { SITE } from "./sitePalette";
import { box, cylinder, sphere } from "./siteSolids";

const angleTo = (x: number, z: number): number =>
  Math.atan2(x - EXCAVATOR.x, z - EXCAVATOR.z);

/** Swing angles: into the pit, over the heap, over a dump truck's bed. */
const DIG_ANGLE = angleTo(DIG_PIT.x, DIG_PIT.z);
const HEAP_ANGLE = angleTo(DIRT_HEAP.x, DIRT_HEAP.z);
const TRUCK_ANGLE = angleTo(DUMP_STOP.x - 1.6, DUMP_STOP.z);
/** How fast the excavator settles into, or out of, digging (per s). */
const BLEND_RATE = 1.2;
/** The heap grows this much a bucket, up to its largest. */
const HEAP_GROWTH = 0.04;
const HEAP_MAX = 1.6;

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export class Excavator {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly boom = new THREE.Group();
  private readonly stick = new THREE.Group();
  private readonly bucket = new THREE.Group();
  private readonly load: THREE.Mesh;
  private readonly heap = new THREE.Group();
  private heapSize = 1;
  private t = 0;
  private weight = 0;
  private pose: DigPose = { swing: DIG_ANGLE, ...DIG_REST };

  constructor() {
    const g = this.root;
    g.position.set(EXCAVATOR.x, 0, EXCAVATOR.z);
    for (const side of [-1, 1]) {
      g.add(box(0.7, 0.7, 3.4, SITE.dark, side * 1.05, 0, 0));
    }
    g.add(box(1.6, 0.35, 2.2, SITE.dark, 0, 0.35, 0));
    const { body } = this;
    body.position.y = 0.7;
    body.add(box(2.2, 1, 2.4, SITE.yellow, 0, 0.05, -0.2));
    body.add(box(1, 1.3, 1.1, SITE.yellowDark, -0.55, 1.05, 0.4));
    body.add(
      box(0.9, 0.7, 0.05, SITE.glass, -0.55, 1.45, 0.96, { shadow: false }),
    );
    body.add(box(2, 0.7, 0.6, SITE.counterweight, 0, 0.2, -1.4));
    // The arm: boom from the deck, stick from the boom, bucket at the end.
    this.boom.position.set(0.45, 1.15, 0.7);
    this.boom.add(box(0.4, 0.4, 3, SITE.yellow, 0, -0.2, 1.5));
    this.stick.position.z = 3;
    this.stick.add(box(0.32, 0.32, 2.3, SITE.yellowDark, 0, -0.16, 1.15));
    this.bucket.position.z = 2.3;
    this.bucket.add(box(0.9, 0.5, 0.7, SITE.dark, 0, -0.25, 0.3));
    this.load = box(0.78, 0.26, 0.55, SITE.dirt, 0, 0, 0.3, { shadow: false });
    this.load.visible = false;
    this.bucket.add(this.load);
    this.stick.add(this.bucket);
    this.boom.add(this.stick);
    body.add(this.boom);
    g.add(body);
    // The pit it digs and the heap it piles, in the scene's own frame.
    const pit = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 28),
      new THREE.MeshLambertMaterial({ color: SITE.dirtDark }),
    );
    pit.rotation.x = -Math.PI / 2;
    pit.scale.set(1, 0.75, 1);
    pit.position.set(DIG_PIT.x - EXCAVATOR.x, 0.02, DIG_PIT.z - EXCAVATOR.z);
    pit.receiveShadow = true;
    g.add(pit);
    this.heap.position.set(
      DIRT_HEAP.x - EXCAVATOR.x,
      0,
      DIRT_HEAP.z - EXCAVATOR.z,
    );
    this.heap.add(sphere(1.4, SITE.dirt, 0, -0.5, 0, [14, 10]));
    this.heap.add(sphere(1, SITE.dirt, 1.1, -0.4, 0.5, [12, 8]));
    g.add(this.heap);
    this.apply();
  }

  /**
   * Dig for this frame while ``digging``, dumping into the truck when one is
   * ``loading`` and onto the heap otherwise. Returns the dumps made.
   */
  update(dt: number, digging: boolean, loading: boolean): number {
    const dump = loading ? TRUCK_ANGLE : HEAP_ANGLE;
    this.weight = Math.max(
      0,
      Math.min(1, this.weight + (digging ? 1 : -1) * BLEND_RATE * dt),
    );
    let dumps = 0;
    if (this.weight > 0) {
      const from = this.t;
      this.t += dt;
      if (this.weight >= 1) dumps = dumpsBetween(from, this.t);
    } else {
      this.t = 0;
    }
    const dig = digPose(this.t, DIG_ANGLE, dump);
    const k = this.weight;
    this.pose = {
      // Settled into the dig, the swing follows it; easing in or out it turns there.
      swing:
        this.pose.swing +
        wrap(dig.swing - this.pose.swing) * (k >= 1 ? 1 : Math.min(1, 4 * dt)),
      boom: DIG_REST.boom + (dig.boom - DIG_REST.boom) * k,
      stick: DIG_REST.stick + (dig.stick - DIG_REST.stick) * k,
      bucket: DIG_REST.bucket + (dig.bucket - DIG_REST.bucket) * k,
    };
    this.load.visible = k >= 1 && carrying(this.t);
    if (dumps > 0 && !loading) {
      this.heapSize = Math.min(HEAP_MAX, this.heapSize + HEAP_GROWTH * dumps);
    }
    this.apply();
    return dumps;
  }

  private apply(): void {
    this.body.rotation.y = this.pose.swing;
    this.boom.rotation.x = this.pose.boom;
    this.stick.rotation.x = this.pose.stick;
    this.bucket.rotation.x = this.pose.bucket;
    this.heap.scale.setScalar(this.heapSize);
  }
}

/** The construction hoist: a mast up the scaffold and a cage that rides it. */
export class Hoist {
  readonly root = new THREE.Group();
  private readonly mast: THREE.Mesh[] = [];
  private readonly cage = new THREE.Group();

  constructor() {
    this.root.position.set(HOIST.x, 0, HOIST.z);
    this.root.add(box(2, 0.25, 2, SITE.concrete, 0, 0, 0));
    for (const dx of [-0.25, 0.25]) {
      const rail = box(0.12, 1, 0.12, SITE.yellow, dx, 0, -0.95);
      this.mast.push(rail);
      this.root.add(rail);
    }
    const c = this.cage;
    c.add(box(1.5, 0.1, 1.5, SITE.steel, 0, 0, 0));
    c.add(box(1.5, 0.08, 1.5, SITE.steel, 0, 2.1, 0));
    for (const [x, z] of [
      [-0.72, -0.72],
      [0.72, -0.72],
      [-0.72, 0.72],
      [0.72, 0.72],
    ]) {
      c.add(box(0.07, 2.1, 0.07, SITE.yellowDark, x, 0, z));
    }
    // Mesh on three sides; the door side, facing out, stays open.
    c.add(
      box(1.5, 1.9, 0.03, SITE.fenceMesh, 0, 0.15, -0.74, { opacity: 0.4 }),
    );
    c.add(
      box(0.03, 1.9, 1.5, SITE.fenceMesh, -0.74, 0.15, 0, { opacity: 0.4 }),
    );
    c.add(box(0.03, 1.9, 1.5, SITE.fenceMesh, 0.74, 0.15, 0, { opacity: 0.4 }));
    this.root.add(c);
  }

  /** Stand the mast past the roof and put the cage at ``cageY``. */
  update(roofY: number, cageY: number): void {
    const top = roofY + 2.6;
    for (const rail of this.mast) {
      rail.scale.y = top;
      rail.position.y = top / 2;
    }
    this.cage.position.y = Math.max(0.25, cageY);
  }
}

type TruckKind = "mixer" | "dump";

/** A truck, nose towards +z: a mixer with its drum, or a dump truck with its bed. */
class Truck {
  readonly root = new THREE.Group();
  private readonly drum = new THREE.Group();
  private readonly bed = new THREE.Group();
  private readonly earth: THREE.Mesh;

  constructor(readonly kind: TruckKind) {
    const g = this.root;
    g.add(box(2, 0.45, 5.2, SITE.dark, 0, 0.5, 0));
    for (const z of [1.7, -0.9, -1.9]) {
      for (const side of [-1, 1]) {
        const wheel = cylinder(0.48, 0.48, 0.36, SITE.dark, 0, 0, 0, 14);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 1.02, 0.48, z);
        g.add(wheel);
      }
    }
    const cabColor = kind === "mixer" ? SITE.container : SITE.yellow;
    g.add(box(2.1, 1.6, 1.4, cabColor, 0, 0.95, 1.85));
    g.add(box(1.9, 0.7, 0.05, SITE.glass, 0, 1.65, 2.56, { shadow: false }));
    if (kind === "mixer") {
      this.drum.position.set(0, 2.05, -0.7);
      this.drum.rotation.x = -0.18;
      const shell = cylinder(0.75, 1.05, 3.2, SITE.mixerDrum, 0, -1.6, 0, 18);
      const turning = new THREE.Group();
      turning.rotation.x = Math.PI / 2;
      turning.add(shell);
      for (const y of [-0.7, 0.4]) {
        turning.add(cylinder(1.0, 1.0, 0.16, SITE.mixerStripe, 0, y, 0, 18));
      }
      this.drum.add(turning);
      g.add(this.drum);
      g.add(box(0.35, 0.1, 1.2, SITE.steel, 0, 1.2, -2.9));
    } else {
      this.bed.position.set(0, 1.0, -0.75);
      this.bed.add(box(2.1, 0.15, 3.4, SITE.yellowDark, 0, 0, 0));
      for (const side of [-1, 1]) {
        this.bed.add(box(0.1, 0.85, 3.4, SITE.yellowDark, side * 1.0, 0.15, 0));
      }
      this.bed.add(box(2.1, 1.05, 0.12, SITE.yellowDark, 0, 0.15, 1.65));
      g.add(this.bed);
    }
    this.earth = box(1.85, 0.7, 3.1, SITE.dirt, 0, 0.15, 0, { shadow: false });
    this.earth.visible = false;
    this.bed.add(this.earth);
  }

  place(vehicle: Vehicle): void {
    this.root.position.set(vehicle.x, 0, vehicle.z);
    this.root.rotation.y = vehicle.heading;
  }

  /** Turn the mixer's drum by ``turns`` of a full turn. */
  spin(turns: number): void {
    const turning = this.drum.children[0];
    if (turning) turning.rotation.y += turns * Math.PI * 2;
  }

  /** Fill the dump truck's bed to ``share`` (0..1). */
  fill(share: number): void {
    this.earth.visible = share > 0;
    this.earth.scale.y = Math.max(0.05, Math.min(1, share));
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
  }
}

interface Run {
  truck: Truck;
  vehicle: Vehicle;
  state: "in" | "stop" | "out";
  /** When the truck at its stop may go (ms). */
  until: number;
  loads: number;
}

/** A mixer pours this long at the building (ms). */
const POUR_MS = 9000;
/** Each later commit while it pours keeps it this much longer (ms). */
const POUR_MORE_MS = 4000;
/** Buckets that fill a dump truck. */
export const TRUCK_LOADS = 3;
/** Digging this long calls a dump truck (s). */
const DIG_BEFORE_TRUCK_S = 8;
/** A dump truck left waiting with no digging goes after this (ms). */
const IDLE_TRUCK_MS = 15_000;
/** A dump truck comes at most this often (ms). */
const DUMP_GAP_MS = 15_000;

/** The trucks coming and going through the gate. */
export class SiteTraffic {
  readonly root = new THREE.Group();
  private mixer: Run | null = null;
  private dump: Run | null = null;
  private pours = 0;
  private digSeconds = 0;
  private dumpReadyAt = 0;
  private lastDigAt = 0;

  /** A floor went up: send a mixer to pour. */
  pour(): void {
    this.pours += 1;
  }

  /** Whether a dump truck waits by the excavator to be loaded. */
  get loading(): boolean {
    return this.dump?.state === "stop";
  }

  /** The excavator dumped ``count`` buckets into the waiting truck. */
  loaded(count: number): void {
    if (!this.dump || this.dump.state !== "stop") return;
    this.dump.loads += count;
    this.dump.truck.fill(this.dump.loads / TRUCK_LOADS);
  }

  update(now: number, dt: number, digging: boolean): void {
    if (digging) {
      this.digSeconds += dt;
      this.lastDigAt = now;
    }
    if (!this.mixer && this.pours > 0) {
      this.pours = 0;
      this.mixer = this.start("mixer");
    }
    if (
      !this.dump &&
      this.digSeconds >= DIG_BEFORE_TRUCK_S &&
      now >= this.dumpReadyAt
    ) {
      this.dump = this.start("dump");
    }
    this.mixer = this.drive(this.mixer, now, dt);
    this.dump = this.drive(this.dump, now, dt);
  }

  private start(kind: TruckKind): Run {
    const truck = new Truck(kind);
    this.root.add(truck.root);
    const vehicle: Vehicle = { ...TRUCK_START, legs: TRUCK_ROUTES[kind].in };
    truck.place(vehicle);
    return { truck, vehicle, state: "in", until: 0, loads: 0 };
  }

  /** Move a truck on; null once it has driven out of the gate. */
  private drive(run: Run | null, now: number, dt: number): Run | null {
    if (!run) return null;
    const { truck } = run;
    if (truck.kind === "mixer")
      truck.spin(dt * (run.state === "stop" ? 0.9 : 0.25));
    if (run.state === "stop") {
      if (truck.kind === "mixer" && this.pours > 0) {
        this.pours = 0;
        run.until = Math.max(run.until, now + POUR_MORE_MS);
      }
      const done =
        truck.kind === "mixer"
          ? now >= run.until
          : run.loads >= TRUCK_LOADS || now - this.lastDigAt > IDLE_TRUCK_MS;
      if (done) {
        run.state = "out";
        run.vehicle = { ...run.vehicle, legs: TRUCK_ROUTES[truck.kind].out };
      }
      return run;
    }
    run.vehicle = stepVehicle(run.vehicle, dt);
    truck.place(run.vehicle);
    if (run.vehicle.legs.length > 0) return run;
    if (run.state === "in") {
      run.state = "stop";
      run.until = now + POUR_MS;
      this.lastDigAt = Math.max(this.lastDigAt, now);
      return run;
    }
    truck.dispose();
    if (truck.kind === "dump") {
      this.digSeconds = 0;
      this.dumpReadyAt = now + DUMP_GAP_MS;
    }
    return null;
  }

  dispose(): void {
    this.mixer?.truck.dispose();
    this.dump?.truck.dispose();
    this.mixer = null;
    this.dump = null;
  }
}
