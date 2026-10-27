/**
 * The office dog on screen (systems/officeDog.ts decides where it goes): a
 * golden retriever with floppy ears, a cream chest, a red collar and a
 * feathered tail that hardly ever stops wagging. It walks, trots and runs
 * with its tongue out, sleeps stretched out on its side, lies down like a
 * sphinx, sits, drinks, bows to play with its tennis ball (and carries the
 * ball in its mouth), sniffs the floor and the cat, bounces when it greets
 * someone and tilts its head when it sits by someone whose tests failed.
 * When I say thanks a heart rises over it and its tail goes faster still.
 */

import * as THREE from "three";
import { findFloorPath, isFloorWalkable } from "@/systems/isoNavGrid";
import {
  dogAt,
  stepOfficeDog,
  type DogAct,
  type OfficeDog,
} from "@/systems/officeDog";
import { petActOf, sightingOf, type PetSighting } from "@/systems/officePets";
import { HEARTS_MS, PARTY_MS } from "@/systems/roomGimmicks";
import { heartGeometry } from "./isoCharacters";
import { box, material } from "./isoFurniture";
import { ISO_COLORS } from "./isoPalette";
import type { RoomsInUse } from "./isoPeople";

const DOG_SIZE = 1.6;
/** From the shoulder or hip to the paw. */
const LEG = 0.32;
const COLORS = {
  coat: "#d9a441",
  dark: "#b9822e",
  cream: "#f1d7a0",
  nose: "#1f2937",
  tongue: "#f472b6",
  collar: "#ef4444",
  tag: "#facc15",
  ball: "#bef264",
};
/** The camera looks from 45°: turned this way the heart faces it. */
const FACE_CAMERA = Math.PI / 4;
const BALL_RADIUS = 0.15;
/** Where its ball sits in its mouth, in its head's own space. */
const IN_MOUTH = new THREE.Vector3(0, 0.03, 0.34);

interface DogRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  eyes: THREE.Mesh[];
  ears: THREE.Group[];
  tongue: THREE.Mesh;
  tail: THREE.Group;
  /** Front left, front right, back left, back right. */
  legs: THREE.Group[];
  heart: THREE.Mesh;
}

function buildDog(): DogRig {
  const root = new THREE.Group();
  root.scale.setScalar(DOG_SIZE);
  const body = new THREE.Group();
  body.add(box(0.36, 0.3, 0.78, COLORS.coat));
  body.add(box(0.3, 0.22, 0.1, COLORS.cream, 0, 0.02, 0.36));
  body.add(box(0.38, 0.06, 0.12, COLORS.collar, 0, 0.24, 0.33));
  body.add(box(0.05, 0.06, 0.02, COLORS.tag, 0, 0.18, 0.4));
  root.add(body);

  const head = new THREE.Group();
  head.position.set(0, 0.26, 0.42);
  head.add(box(0.3, 0.28, 0.3, COLORS.coat));
  head.add(box(0.17, 0.13, 0.2, COLORS.cream, 0, 0.02, 0.2));
  head.add(box(0.08, 0.06, 0.04, COLORS.nose, 0, 0.1, 0.3));
  const eyes = [-0.075, 0.075].map((x) => {
    const eye = box(0.045, 0.05, 0.01, COLORS.nose, x, 0.17, 0.152);
    head.add(eye);
    return eye;
  });
  const ears = [-0.16, 0.16].map((x) => {
    const ear = new THREE.Group();
    ear.position.set(x, 0.26, -0.02);
    ear.add(box(0.06, 0.22, 0.16, COLORS.dark, 0, -0.22, 0));
    head.add(ear);
    return ear;
  });
  const tongue = box(0.07, 0.02, 0.1, COLORS.tongue, 0, -0.01, 0.28);
  tongue.visible = false;
  head.add(tongue);
  body.add(head);

  const tail = new THREE.Group();
  tail.position.set(0, 0.24, -0.38);
  tail.add(box(0.08, 0.08, 0.38, COLORS.coat, 0, -0.04, -0.19));
  tail.add(box(0.05, 0.06, 0.3, COLORS.cream, 0, -0.09, -0.22));
  body.add(tail);

  const legs = [
    [-0.12, 0.28],
    [0.12, 0.28],
    [-0.12, -0.28],
    [0.12, -0.28],
  ].map(([x, z]) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.04, z);
    leg.add(box(0.1, LEG, 0.1, COLORS.coat, 0, -LEG, 0));
    leg.add(box(0.105, 0.05, 0.11, COLORS.cream, 0, -LEG - 0.005, 0.005));
    body.add(leg);
    return leg;
  });

  const heart = new THREE.Mesh(heartGeometry(), material(ISO_COLORS.heart));
  heart.scale.setScalar(0.6);
  heart.visible = false;
  root.add(heart);
  return { root, body, head, eyes, ears, tongue, tail, legs, heart };
}

type DogPose = DogAct | "walk" | "run" | "hop" | "stretch";

/** Pose the dog for ``act``; ``seconds`` drives the motion, ``wag`` how fast its tail goes. */
function poseDog(
  rig: DogRig,
  act: DogPose,
  seconds: number,
  wag: number,
): void {
  const { body, head, tail, legs, eyes, ears, tongue } = rig;
  const [frontL, frontR, backL, backR] = legs;
  body.position.set(0, LEG, 0);
  body.rotation.set(0, 0, 0);
  body.scale.set(1, 1, 1);
  head.position.set(0, 0.26, 0.42);
  head.rotation.set(0, 0, 0);
  tail.rotation.set(0.5, 0.55 * Math.sin(seconds * wag), 0);
  for (const leg of legs) {
    leg.visible = true;
    leg.rotation.set(0, 0, 0);
  }
  for (const ear of ears) ear.rotation.set(0, 0, 0);
  for (const eye of eyes) eye.scale.y = 1;
  tongue.visible = false;
  tongue.scale.set(1, 1, 1);

  switch (act) {
    case "walk":
    case "run": {
      const running = act === "run";
      const pace = running ? 15 : 9;
      const swing = (running ? 0.85 : 0.45) * Math.sin(seconds * pace);
      // A gallop moves the front pair together; a walk crosses them.
      frontL.rotation.x = swing;
      frontR.rotation.x = running ? swing : -swing;
      backL.rotation.x = -swing;
      backR.rotation.x = running ? -swing : swing;
      body.position.y =
        LEG + (running ? 0.06 : 0.02) * Math.abs(Math.cos(seconds * pace));
      body.rotation.x = running ? 0.06 * Math.sin(seconds * pace) : 0;
      for (const ear of ears) {
        ear.rotation.x =
          (running ? -0.5 : -0.15) + 0.15 * Math.sin(seconds * pace);
      }
      tongue.visible = running;
      return;
    }
    case "hop":
      frontL.rotation.x = frontR.rotation.x = -0.6;
      backL.rotation.x = backR.rotation.x = 0.6;
      return;
    case "sleep":
      // Stretched out on its side, legs out, eyes shut, slow breaths.
      body.rotation.z = Math.PI / 2;
      body.position.set(0.15, 0.18, 0);
      body.scale.x = 1 + 0.04 * Math.sin(seconds * 1.5);
      frontL.rotation.x = frontR.rotation.x = -0.4;
      backL.rotation.x = backR.rotation.x = 0.3;
      for (const eye of eyes) eye.scale.y = 0.2;
      tail.rotation.set(0.1, 0.15 * Math.sin(seconds * 0.7), 0);
      // Now and then an ear twitches.
      ears[0].rotation.x = Math.sin(seconds * 0.9) > 0.95 ? 0.35 : 0;
      return;
    case "lie":
      // Lying down like a sphinx, front legs out ahead, head up.
      body.position.y = 0.02;
      frontL.rotation.x = frontR.rotation.x = -Math.PI / 2;
      backL.visible = backR.visible = false;
      tail.rotation.set(0, 0.6 * Math.sin(seconds * wag * 0.5), 0);
      return;
    case "sit":
    case "comfort":
      // Sitting up, its tail sweeping the floor; beside someone sad it
      // tilts its head and its ears droop.
      body.position.y = LEG * 0.8;
      body.rotation.x = -0.55;
      backL.visible = backR.visible = false;
      frontL.rotation.x = frontR.rotation.x = 0.55;
      head.rotation.x = 0.55;
      tail.rotation.set(-0.3, 0.6 * Math.sin(seconds * wag * 0.6), 0);
      if (act === "comfort") {
        head.rotation.z = 0.35;
        for (const ear of ears) ear.rotation.x = 0.3;
      }
      return;
    case "drink":
      head.position.set(0, 0.06, 0.46);
      head.rotation.x = 0.9;
      tongue.visible = true;
      tongue.scale.z = 1 + 0.4 * Math.sin(seconds * 14);
      return;
    case "play":
    case "stretch": {
      // The play bow: chest down, rump up; at play it bounces and wags hard.
      const playing = act === "play";
      body.rotation.x = 0.35;
      frontL.rotation.x = frontR.rotation.x = -1.1;
      backL.rotation.x = backR.rotation.x = -0.35;
      head.rotation.x = -0.4;
      if (playing) {
        body.position.y = LEG + 0.04 * Math.abs(Math.sin(seconds * 7));
        tongue.visible = true;
        tail.rotation.set(1.0, 0.7 * Math.sin(seconds * wag * 1.4), 0);
      } else {
        for (const eye of eyes) eye.scale.y = 0.3;
      }
      return;
    }
    case "sniff":
    case "visit":
      head.position.set(0, 0.12, 0.45);
      head.rotation.x =
        (act === "visit" ? 0.35 : 0.75) + 0.06 * Math.sin(seconds * 16);
      head.rotation.y = act === "sniff" ? 0.25 * Math.sin(seconds * 1.3) : 0;
      return;
    case "greet": {
      // Bouncing on its front paws, tongue out, tail a blur.
      const bounce = Math.abs(Math.sin(seconds * 9));
      body.position.y = LEG + 0.12 * bounce;
      body.rotation.x = -0.25 * bounce;
      frontL.rotation.x = frontR.rotation.x = -0.5 * bounce;
      tongue.visible = true;
      tail.rotation.set(0.9, 0.7 * Math.sin(seconds * wag * 1.6), 0);
      return;
    }
    case "pant":
      tongue.visible = true;
      body.scale.y = 1 + 0.03 * Math.sin(seconds * 14);
      return;
  }
}

export class IsoDog {
  private readonly rig = buildDog();
  private readonly ball: THREE.Mesh;
  private readonly office: THREE.Object3D;
  private dog: OfficeDog | null = null;
  private partyPending = false;
  private partyFrom: number | null = null;
  private heartsPending = false;
  private heartsFrom: number | null = null;

  constructor(office: THREE.Object3D) {
    this.office = office;
    office.add(this.rig.root);
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 16, 12),
      material(COLORS.ball),
    );
    this.ball.castShadow = true;
    office.add(this.ball);
  }

  /** Work just shipped: zoomies. */
  party(): void {
    this.partyPending = true;
  }

  /** I said thanks: a heart rises over it, its tail going faster. */
  hearts(): void {
    this.heartsPending = true;
  }

  /** Where it is and what it is up to, for the cat. */
  sighting(): PetSighting | null {
    return this.dog && sightingOf(this.dog);
  }

  /**
   * Move and pose it for this frame; ``now`` in ms, ``dt`` in seconds,
   * ``cat`` as the cat was last frame.
   */
  update(
    now: number,
    dt: number,
    inUse: RoomsInUse,
    cat: PetSighting | null,
  ): void {
    if (this.partyPending) {
      this.partyPending = false;
      this.partyFrom = now;
    }
    if (this.heartsPending) {
      this.heartsPending = false;
      this.heartsFrom = now;
    }
    this.dog ??= dogAt(now, Math.random);
    this.dog = stepOfficeDog(this.dog, {
      now,
      dt,
      napping: inUse.catNap,
      claude: inUse.claude,
      cat,
      arriving: inUse.arriving,
      upset: inUse.upset,
      party: this.partyFrom !== null && now - this.partyFrom < PARTY_MS,
      random: Math.random,
      findPath: findFloorPath,
      walkable: isFloorWalkable,
    });
    const { root, head, heart } = this.rig;
    const seconds = now / 1000;
    const thanks =
      this.heartsFrom !== null && now - this.heartsFrom < HEARTS_MS
        ? (now - this.heartsFrom) / 1000
        : null;
    root.position.set(this.dog.x, this.dog.y, this.dog.z);
    root.rotation.y = this.dog.facing;
    poseDog(this.rig, petActOf(this.dog), seconds, thanks === null ? 9 : 22);

    // Its ball: on the floor where it left it, or in its mouth.
    const { ball } = this.dog;
    if (ball) {
      if (this.ball.parent !== this.office) {
        this.office.add(this.ball);
        this.ball.scale.setScalar(1);
      }
      this.ball.position.set(ball.x, BALL_RADIUS, ball.z);
    } else if (this.ball.parent !== head) {
      head.add(this.ball);
      this.ball.scale.setScalar(1 / DOG_SIZE);
      this.ball.position.copy(IN_MOUTH);
    }

    heart.visible = thanks !== null;
    if (thanks !== null) {
      const rise = (thanks * 0.8) % 1;
      heart.position.set(0, 0.95 + 0.4 * rise, 0.2);
      heart.rotation.y = FACE_CAMERA - root.rotation.y;
      heart.scale.setScalar(0.5 * Math.min(1, rise * 4));
    }
  }
}
