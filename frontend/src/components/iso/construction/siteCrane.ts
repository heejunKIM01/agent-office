/**
 * The tower crane of the construction site. A yellow mast with a jib that
 * slews round on top, a trolley running along the jib and a hook hanging
 * from it. For each commit it swings to the slab stack in the yard, lowers
 * the hook, picks up a slab, lifts it, swings over the building and sets
 * it on the roof, where it becomes the next floor (``lift``). In between it
 * rests over the building, swaying a little while the site is at work.
 */

import * as THREE from "three";
import { BUILDING, CRANE, SLAB_STACK } from "@/constants/sitePlan";
import { SITE } from "./sitePalette";
import { box } from "./siteSolids";

/** The slab stack's top, where the hook picks a slab up. */
const STACK_TOP = 1.2;
/** How far under the trolley the hook hangs at its highest. */
const HOOK_TOP_GAP = 1.2;
/** How far over the roof the hook carries a slab between stops. */
const CLEAR = 3.5;

interface Pose {
  angle: number;
  reach: number;
  hookY: number;
}

interface Step {
  to: (roofY: number) => Pose;
  seconds: number;
  /** What happens when the step is done. */
  then?: "hitch" | "place";
}

const aim = (x: number, z: number): { angle: number; reach: number } => ({
  angle: Math.atan2(x - CRANE.x, z - CRANE.z),
  reach: Math.hypot(x - CRANE.x, z - CRANE.z),
});

const YARD = aim(SLAB_STACK.x, SLAB_STACK.z);
const ROOF = aim(BUILDING.x + BUILDING.w / 2, BUILDING.z + BUILDING.d / 2);
/** Resting over the building, a little short of its middle. */
const REST = { angle: ROOF.angle, reach: ROOF.reach * 0.8 };

/** A lift, step by step: to the yard, down, hitch, up, over, down, set, up. */
const LIFT: Step[] = [
  { to: (roof) => ({ ...YARD, hookY: roof + CLEAR }), seconds: 2.6 },
  {
    to: () => ({ ...YARD, hookY: STACK_TOP + 0.2 }),
    seconds: 1.8,
    then: "hitch",
  },
  { to: (roof) => ({ ...YARD, hookY: roof + CLEAR }), seconds: 1.8 },
  { to: (roof) => ({ ...ROOF, hookY: roof + CLEAR }), seconds: 2.6 },
  {
    to: (roof) => ({ ...ROOF, hookY: roof + 0.45 }),
    seconds: 1.8,
    then: "place",
  },
  { to: (roof) => ({ ...REST, hookY: roof + CLEAR }), seconds: 1.4 },
];

const smooth = (t: number): number => t * t * (3 - 2 * t);
const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export class TowerCrane {
  readonly root = new THREE.Group();
  private readonly slewing = new THREE.Group();
  private readonly trolley = new THREE.Group();
  private readonly cable: THREE.Mesh;
  private readonly hook = new THREE.Group();
  private readonly load: THREE.Mesh;
  private pose: Pose = { ...REST, hookY: 10 };
  private from: Pose = { ...REST, hookY: 10 };
  /** Lifts still to make, each with what to do once its slab is set. */
  private readonly queue: (() => void)[] = [];
  private step = -1;
  private stepStart = 0;

  constructor() {
    const { x, z, mast, jib } = CRANE;
    this.root.position.set(x, 0, z);
    this.root.add(box(3, 1, 3, SITE.concrete, 0, 0, 0));
    // The mast: four chords with rungs every two metres.
    for (const [cx, cz] of [
      [-0.6, -0.6],
      [0.6, -0.6],
      [-0.6, 0.6],
      [0.6, 0.6],
    ]) {
      this.root.add(box(0.16, mast - 1, 0.16, SITE.yellow, cx, 1, cz));
    }
    for (let y = 2; y < mast; y += 2) {
      this.root.add(box(1.36, 0.1, 0.1, SITE.yellowDark, 0, y, -0.6));
      this.root.add(box(1.36, 0.1, 0.1, SITE.yellowDark, 0, y, 0.6));
      this.root.add(box(0.1, 0.1, 1.36, SITE.yellowDark, -0.6, y, 0));
      this.root.add(box(0.1, 0.1, 1.36, SITE.yellowDark, 0.6, y, 0));
    }
    // On top, turning together: the cab, the jib (towards +z), the
    // counter-jib with its weights, and the apex with its ties.
    this.slewing.position.y = mast;
    this.slewing.add(box(1.6, 0.6, 1.6, SITE.yellowDark, 0, 0, 0));
    this.slewing.add(box(1.2, 1.2, 1.4, SITE.container, 1.1, -0.6, 0.6));
    this.slewing.add(
      box(1.22, 0.6, 0.05, SITE.glass, 1.1, -0.2, 1.31, { shadow: false }),
    );
    this.slewing.add(box(0.8, 0.7, jib, SITE.yellow, 0, 0.6, jib / 2));
    this.slewing.add(box(0.8, 0.5, 7, SITE.yellow, 0, 0.6, -3.5));
    this.slewing.add(box(1.6, 1.4, 1.6, SITE.counterweight, 0, 0, -6.2));
    this.slewing.add(box(0.5, 3.2, 0.5, SITE.yellow, 0, 0.6, 0));
    for (const [length, toward] of [
      [jib * 0.75, 1],
      [6.5, -1],
    ]) {
      const tie = box(0.06, 0.06, length, SITE.cable, 0, 0, 0, {
        shadow: false,
      });
      const mount = new THREE.Group();
      mount.add(tie);
      tie.position.z = (toward * length) / 2;
      mount.position.y = 3.8;
      mount.rotation.x = toward * Math.atan2(2.8, length);
      this.slewing.add(mount);
    }
    this.trolley.add(box(0.9, 0.3, 0.9, SITE.dark, 0, 0.2, 0));
    this.slewing.add(this.trolley);
    this.cable = box(0.05, 1, 0.05, SITE.cable, 0, -0.5, 0, { shadow: false });
    this.trolley.add(this.cable);
    this.hook.add(box(0.5, 0.5, 0.4, SITE.yellow, 0, 0, 0));
    this.hook.add(box(0.12, 0.3, 0.12, SITE.dark, 0, -0.3, 0));
    this.load = box(3.2, 0.28, 2.8, SITE.slab, 0, -0.6, 0);
    this.load.visible = false;
    this.hook.add(this.load);
    this.trolley.add(this.hook);
    this.root.add(this.slewing);
  }

  /** Lift a slab onto the roof; ``placed`` hears when it is set down. */
  lift(placed: () => void): void {
    this.queue.push(placed);
  }

  /** Move the crane for this frame; ``now`` in ms, ``roofY`` the roof's height. */
  update(now: number, busy: boolean, roofY: number): void {
    if (this.step < 0 && this.queue.length > 0) this.begin(0, now);
    if (this.step >= 0) {
      const step = LIFT[this.step];
      const t = Math.min(1, (now - this.stepStart) / (step.seconds * 1000));
      const to = step.to(roofY);
      const k = smooth(t);
      this.pose = {
        angle: this.from.angle + wrapAngle(to.angle - this.from.angle) * k,
        reach: this.from.reach + (to.reach - this.from.reach) * k,
        hookY: this.from.hookY + (to.hookY - this.from.hookY) * k,
      };
      if (t >= 1) {
        if (step.then === "hitch") this.load.visible = true;
        if (step.then === "place") {
          this.load.visible = false;
          this.queue.shift()?.();
        }
        if (this.step + 1 < LIFT.length) this.begin(this.step + 1, now);
        else this.step = -1;
      }
    } else {
      // At rest over the building, swaying while the site works.
      const sway = busy ? 0.25 * Math.sin(now / 3000) : 0;
      this.pose = {
        angle: this.pose.angle + (REST.angle + sway - this.pose.angle) * 0.02,
        reach: this.pose.reach + (REST.reach - this.pose.reach) * 0.02,
        hookY: this.pose.hookY + (roofY + CLEAR - this.pose.hookY) * 0.02,
      };
    }
    this.slewing.rotation.y = this.pose.angle;
    this.trolley.position.set(0, 0.2, this.pose.reach);
    // The hook hangs under the trolley, its cable down to it.
    const drop = Math.max(HOOK_TOP_GAP, CRANE.mast + 0.2 - this.pose.hookY);
    this.hook.position.y = -drop;
    this.cable.scale.y = drop - 0.25;
    this.cable.position.y = -(drop - 0.25) / 2;
  }

  /** Whether a lift is under way or waiting. */
  get lifting(): boolean {
    return this.step >= 0 || this.queue.length > 0;
  }

  private begin(index: number, now: number): void {
    this.step = index;
    this.stepStart = now;
    this.from = { ...this.pose };
  }
}
