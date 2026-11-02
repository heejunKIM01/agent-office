/**
 * Parcels on screen (systems/officeParcels.ts decides the courier's way): a
 * stack of cardboard boxes on the floor at the end of Claude's desk, a box
 * per install in the session, and the courier in brown who brings a new one
 * up in the elevator, its label over his head, sets it on the stack, waves
 * and rides back down. The label shows over the stack a while after.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  CLAUDE_SEAT,
  ELEVATOR_CAB,
  ELEVATOR_DOOR,
} from "@/constants/isoFloorPlan";
import { findFloorPath } from "@/systems/isoNavGrid";
import {
  DROP_MS,
  MAX_PARCELS,
  carrying,
  courierAtDoor,
  isFreshParcel,
  startCourier,
  stepCourier,
  type Courier,
  type CourierWay,
  type Parcel,
} from "@/systems/officeParcels";
import {
  buildCourier,
  poseCharacter,
  type CharacterRig,
} from "./isoCharacters";
import { box } from "./isoFurniture";

/** The stack's middle on the floor: past the end of Claude's desk, by the wall. */
const STACK = { x: CLAUDE_SEAT.x - 1.95, z: CLAUDE_SEAT.z - 1.55 };
const BOX = { w: 0.6, h: 0.42, d: 0.52 };
const COLORS = { card: "#c99a5b", tape: "#e8d3a6", label: "#f8fafc" };
/** The label shows over the stack this long after a box lands (s). */
const NOTE_SECONDS = 4;
/** Couriers stand in line for the elevator no deeper than this. */
const MAX_QUEUE = 3;

const WAY: CourierWay = {
  cab: ELEVATOR_CAB,
  door: ELEVATOR_DOOR,
  // In front of the stack, facing it (towards the windows).
  drop: { x: STACK.x, z: STACK.z + 1.3 },
  dropFacing: Math.PI,
  findPath: findFloorPath,
};

/** One cardboard box, its bottom at the origin: taped across the top, a label in front. */
function parcelBox(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(BOX.w, BOX.h, BOX.d, COLORS.card));
  g.add(box(0.12, 0.01, BOX.d + 0.01, COLORS.tape, 0, BOX.h, 0));
  g.add(box(0.26, 0.16, 0.01, COLORS.label, 0.08, 0.14, BOX.d / 2 + 0.005));
  return g;
}

/** Where box ``i`` sits on the stack: two piles side by side along z, bottom up. */
function stackSpot(i: number): THREE.Vector3 {
  const pile = i % 2;
  const level = Math.floor(i / 2);
  return new THREE.Vector3(
    STACK.x + (pile === 0 ? 0.02 : -0.03),
    level * BOX.h,
    STACK.z + (pile === 0 ? -0.3 : 0.3),
  );
}

function note(className: string): {
  object: CSS2DObject;
  text: HTMLDivElement;
} {
  const text = document.createElement("div");
  text.className = className;
  const object = new CSS2DObject(text);
  object.center.set(0.5, 1);
  object.visible = false;
  return { object, text };
}

const NOTE_CLASS =
  "line-clamp-2 max-w-[220px] rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium leading-snug text-slate-800 shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export class IsoParcels {
  private readonly stack: THREE.Group[] = [];
  private readonly stackNote = note(NOTE_CLASS);
  private noteUntil: number | null = null;
  private readonly rig: CharacterRig = buildCourier();
  /** The box in the courier's hands, in its own space. */
  private readonly held = parcelBox();
  private readonly courierNote = note(NOTE_CLASS);
  private courier: Courier | null = null;
  private readonly queue: Parcel[] = [];
  private count = 0;
  private seen: string | null = null;

  constructor(office: THREE.Object3D) {
    for (let i = 0; i < MAX_PARCELS; i++) {
      const parcel = parcelBox();
      parcel.position.copy(stackSpot(i));
      parcel.rotation.y = ((i * 37) % 7) * 0.04 - 0.12;
      parcel.visible = false;
      this.stack.push(parcel);
      office.add(parcel);
    }
    this.stackNote.object.position.set(STACK.x, 2 * BOX.h + 0.9, STACK.z);
    office.add(this.stackNote.object);

    // Held out in front at the chest; the rig is scaled, so a little smaller.
    this.held.scale.setScalar(0.85);
    this.held.position.set(0, 0.95, 0.62);
    this.rig.root.add(this.held);
    this.courierNote.object.position.y = 0.4;
    this.rig.chipAnchor.add(this.courierNote.object);
    this.rig.root.visible = false;
    office.add(this.rig.root);
  }

  /**
   * The session's installs: a box each on the stack. A new one installed
   * just now is brought up by the courier, and lands on the stack when he
   * sets it down.
   */
  setParcels(parcels: { count: number; last: Parcel | null }): void {
    const { count, last } = parcels;
    if (count < this.count) {
      // Another session: its own stack, nobody on the way.
      this.queue.length = 0;
      this.courier = null;
      this.noteUntil = null;
    }
    this.count = count;
    if (isFreshParcel(last, this.seen, Date.now())) {
      if (this.queue.length < MAX_QUEUE) this.queue.push(last);
    }
    this.seen = last?.id ?? null;
  }

  /**
   * Move the courier for this frame (``now`` in ms, ``dt`` in s) and say
   * whether the elevator should stand open for him and he steps out now.
   */
  update(
    now: number,
    dt: number,
  ): { elevatorOpen: boolean; arriving: boolean } {
    if (!this.courier && this.queue.length > 0) {
      this.courier = startCourier(this.queue.shift() as Parcel, WAY);
      this.courierNote.text.textContent = `📦 ${this.courier.parcel.label}`;
    }
    const seconds = now / 1000;
    if (this.courier) {
      const step = stepCourier(this.courier, WAY, now, dt);
      if (step.dropped) {
        this.stackNote.text.textContent = `📦 ${this.courier.parcel.label}`;
        this.noteUntil = seconds + NOTE_SECONDS;
      }
      this.courier = step.courier;
    }
    this.drawStack();
    this.drawCourier(now, seconds);
    this.stackNote.object.visible =
      this.noteUntil !== null && seconds < this.noteUntil;
    return {
      elevatorOpen: courierAtDoor(this.courier, ELEVATOR_DOOR),
      arriving: this.courier?.leg === "out",
    };
  }

  /** A box per install, less the ones still on their way up. */
  private drawStack(): void {
    const coming =
      this.queue.length + (this.courier && carrying(this.courier) ? 1 : 0);
    const shown = Math.min(MAX_PARCELS, Math.max(0, this.count - coming));
    this.stack.forEach((parcel, i) => {
      parcel.visible = i < shown;
    });
  }

  private drawCourier(now: number, seconds: number): void {
    const courier = this.courier;
    this.rig.root.visible = courier !== null;
    this.courierNote.object.visible = courier !== null && carrying(courier);
    if (!courier) return;
    const { walker, leg } = courier;
    this.rig.root.position.set(walker.x, 0, walker.z);
    this.rig.root.rotation.y = walker.facing;
    const walking =
      leg === "out" || leg === "deliver" || leg === "back" || leg === "in";
    poseCharacter(
      this.rig,
      walking ? "walk" : leg === "wave" ? "wave" : "stand",
      null,
      seconds,
    );
    this.held.visible = carrying(courier);
    if (!this.held.visible) return;
    // Both arms out in front under the box; setting it down, they lower it.
    const lowering =
      leg === "drop"
        ? 1 - Math.max(0, (courier.until ?? now) - now) / DROP_MS
        : 0;
    const [armL, armR] = this.rig.arms;
    armL.rotation.set(-1.25 + 0.7 * lowering, 0, 0.12);
    armR.rotation.set(-1.25 + 0.7 * lowering, 0, -0.12);
    this.held.position.y = 0.95 - 0.55 * lowering;
  }

  dispose(): void {
    this.stackNote.object.removeFromParent();
    this.courierNote.object.removeFromParent();
  }
}
