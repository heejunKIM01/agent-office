/**
 * The office cat on screen (systems/officeCat.ts decides where it goes): an
 * orange tabby with white socks that ambles or dashes on four legs, tail
 * up, hops onto its perches and, once there, curls up asleep, loafs, washes
 * a paw, dozes, eats, sniffs, scratches the post, sits looking about or
 * rubs against Claude's legs with a heart. It swats at the dog when the dog
 * comes sniffing. When work ships it leaps at the falling confetti, and
 * when I say thanks a heart rises over it too.
 */

import * as THREE from "three";
import { findFloorPath, isFloorWalkable } from "@/systems/isoNavGrid";
import { catAt, stepOfficeCat, type OfficeCat } from "@/systems/officeCat";
import {
  distance,
  petActOf,
  sightingOf,
  towards,
  type PetSighting,
} from "@/systems/officePets";
import { HEARTS_MS, PARTY_MS } from "@/systems/roomGimmicks";
import { petSnore } from "./isoBubbles";
import { heartGeometry } from "./isoCharacters";
import { box, material } from "./isoFurniture";
import { ISO_COLORS } from "./isoPalette";
import type { RoomsInUse } from "./isoPeople";

const CAT_SIZE = 1.5;
/** From the shoulder or hip to the paw. */
const LEG = 0.16;
const COLORS = {
  fur: "#f2994a",
  stripe: "#c96f24",
  ear: "#e07f2e",
  eye: "#1f2937",
  nose: "#f472b6",
  sock: "#fff7ed",
};
/** The camera looks from 45°: turned this way the heart faces it. */
const FACE_CAMERA = Math.PI / 4;
/** Rubbing, a heart rises over it this often (s). */
const RUB_HEART_SECONDS = 2;
/** Its 💤 shows this high over its feet, in its own space. */
const SNORE_HEIGHT = 0.5;
/** A dog sniffing this close gets a swat, unless the cat sleeps (m). */
const SWAT_REACH = 1.8;

interface CatRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  eyes: THREE.Mesh[];
  tail: THREE.Group;
  /** Front left, front right, back left, back right. */
  legs: THREE.Group[];
  heart: THREE.Mesh;
}

function buildCat(): CatRig {
  const root = new THREE.Group();
  root.scale.setScalar(CAT_SIZE);
  const body = new THREE.Group();
  body.add(box(0.34, 0.2, 0.5, COLORS.fur));
  body.add(box(0.35, 0.03, 0.08, COLORS.stripe, 0, 0.18, -0.1));
  body.add(box(0.35, 0.03, 0.08, COLORS.stripe, 0, 0.18, 0.08));
  root.add(body);

  const head = new THREE.Group();
  head.add(box(0.28, 0.22, 0.22, COLORS.fur));
  head.add(box(0.07, 0.09, 0.05, COLORS.ear, -0.085, 0.22, -0.02));
  head.add(box(0.07, 0.09, 0.05, COLORS.ear, 0.085, 0.22, -0.02));
  const eyes = [-0.065, 0.065].map((x) => {
    const eye = box(0.04, 0.05, 0.01, COLORS.eye, x, 0.11, 0.115);
    head.add(eye);
    return eye;
  });
  head.add(box(0.04, 0.03, 0.01, COLORS.nose, 0, 0.07, 0.12));
  body.add(head);

  const tail = new THREE.Group();
  tail.position.set(0, 0.14, -0.24);
  tail.add(box(0.06, 0.06, 0.34, COLORS.stripe, 0, -0.03, -0.17));
  body.add(tail);

  const legs = [
    [-0.1, 0.17],
    [0.1, 0.17],
    [-0.1, -0.17],
    [0.1, -0.17],
  ].map(([x, z]) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.02, z);
    leg.add(box(0.08, LEG, 0.08, COLORS.fur, 0, -LEG, 0));
    leg.add(box(0.085, 0.04, 0.085, COLORS.sock, 0, -LEG - 0.005, 0));
    body.add(leg);
    return leg;
  });

  const heart = new THREE.Mesh(heartGeometry(), material(ISO_COLORS.heart));
  heart.scale.setScalar(0.6);
  heart.visible = false;
  root.add(heart);
  return { root, body, head, eyes, tail, legs, heart };
}

type CatPose = ReturnType<typeof petActOf<OfficeCat["plan"]["act"]>>;

/** Pose the cat for ``act``; ``seconds`` drives the motion. */
function poseCat(rig: CatRig, act: CatPose, seconds: number): void {
  const { body, head, tail, legs, eyes } = rig;
  const [frontL, frontR, backL, backR] = legs;
  body.position.set(0, LEG, 0);
  body.rotation.set(0, 0, 0);
  body.scale.set(1, 1, 1);
  head.position.set(0, 0.1, 0.3);
  head.rotation.set(0, 0, 0);
  tail.rotation.set(0.35, 0.25 * Math.sin(seconds * 1.6), 0);
  for (const leg of legs) {
    leg.visible = true;
    leg.rotation.set(0, 0, 0);
  }
  const curled = act === "sleep" || act === "snuggle";
  const lying =
    curled ||
    act === "loaf" ||
    act === "keyboard" ||
    act === "doze" ||
    act === "box";
  const shut = act === "doze" || curled;
  for (const eye of eyes) eye.scale.y = shut ? 0.2 : 1;
  if (lying) {
    // Paws tucked under, breathing slowly, the tail swaying along the floor.
    body.position.y = 0;
    for (const leg of legs) leg.visible = false;
    body.scale.y = 1 + 0.04 * Math.sin(seconds * (shut ? 1.6 : 2.4));
    tail.rotation.set(0, 0.5 * Math.sin(seconds * 1.8), 0);
    if (act === "doze") head.position.y = 0.06;
    if (curled) {
      // Curled up: the head down on its side, the tail wrapped round.
      body.scale.z = 0.85;
      head.position.set(0.08, 0.02, 0.22);
      head.rotation.set(0.25, -0.7, 0.35);
      tail.rotation.set(0, 2.3 + 0.1 * Math.sin(seconds), 0);
    }
    return;
  }
  switch (act) {
    case "walk":
    case "run": {
      const running = act === "run";
      const pace = running ? 18 : 10;
      const swing = (running ? 0.95 : 0.55) * Math.sin(seconds * pace);
      frontL.rotation.x = swing;
      backR.rotation.x = swing;
      frontR.rotation.x = -swing;
      backL.rotation.x = -swing;
      body.position.y =
        LEG + (running ? 0.05 : 0.015) * Math.abs(Math.cos(seconds * pace));
      tail.rotation.x = running ? 0.5 : 1.1 + 0.12 * Math.sin(seconds * 3);
      return;
    }
    case "scratch":
      // Up on its hind legs against the post, front paws clawing it.
      body.position.y = LEG * 0.7;
      body.rotation.x = -1.05;
      backL.rotation.x = backR.rotation.x = 1.05;
      frontL.rotation.x = -0.5 + 0.45 * Math.sin(seconds * 12);
      frontR.rotation.x = -0.5 - 0.45 * Math.sin(seconds * 12);
      head.rotation.x = 0.9;
      tail.rotation.x = 0.3;
      return;
    case "look":
      // Sitting up, turning its head to watch the room.
      body.position.y = 0.05;
      body.rotation.x = -0.6;
      backL.visible = backR.visible = false;
      frontL.rotation.x = frontR.rotation.x = 0.6;
      head.rotation.set(0.6, 0.7 * Math.sin(seconds * 0.8), 0);
      tail.rotation.set(0, 1.2 + 0.2 * Math.sin(seconds * 2), 0);
      return;
    case "hop":
      frontL.rotation.x = frontR.rotation.x = -0.7;
      backL.rotation.x = backR.rotation.x = 0.7;
      tail.rotation.x = 0.6;
      return;
    case "stretch": {
      // Front paws reaching out, rump up, a long yawn.
      const reach = Math.min(1, seconds % 1.4) * 0.15;
      body.rotation.x = 0.3 + reach;
      frontL.rotation.x = frontR.rotation.x = -1.2;
      backL.rotation.x = backR.rotation.x = -0.3 - reach;
      head.rotation.x = -0.45;
      for (const eye of eyes) eye.scale.y = 0.3;
      tail.rotation.x = 1.3;
      return;
    }
    case "groom":
      // Sitting up, licking a raised front paw.
      body.position.y = 0.05;
      body.rotation.x = -0.6;
      backL.visible = backR.visible = false;
      frontL.rotation.x = 0.6;
      frontR.rotation.x = -1.5 + 0.2 * Math.sin(seconds * 8);
      head.rotation.set(0.55 + 0.15 * Math.sin(seconds * 8), 0, 0.2);
      tail.rotation.set(0, 1.2, 0);
      return;
    case "eat":
      head.position.set(0, 0, 0.32);
      head.rotation.x = 0.75 + 0.12 * Math.sin(seconds * 9);
      body.rotation.x = 0.1;
      return;
    case "sniff":
      head.position.set(0, 0.05, 0.31);
      head.rotation.x = 0.45 + 0.06 * Math.sin(seconds * 16);
      tail.rotation.x = 0.8;
      return;
    case "rub":
      // Leaning into the legs it rubs, side to side, tail straight up.
      body.rotation.z = 0.14 * Math.sin(seconds * 4);
      body.position.x = 0.04 * Math.sin(seconds * 4);
      head.rotation.z = -0.2 * Math.sin(seconds * 4);
      tail.rotation.set(1.45, 0, 0.15 * Math.sin(seconds * 6));
      return;
  }
}

export class IsoCat {
  private readonly rig = buildCat();
  private readonly snore = petSnore(this.rig.root, SNORE_HEIGHT);
  private cat: OfficeCat | null = null;
  /** When it last leapt at confetti and when I last said thanks (ms). */
  private pouncePending = false;
  private pounceFrom: number | null = null;
  private heartsPending = false;
  private heartsFrom: number | null = null;

  constructor(office: THREE.Object3D) {
    office.add(this.rig.root);
  }

  /** Work just shipped: it leaps at the confetti for a while. */
  pounce(): void {
    this.pouncePending = true;
  }

  /** I said thanks: a heart rises over it too. */
  hearts(): void {
    this.heartsPending = true;
  }

  /** Where it is and what it is up to, for the dog. */
  sighting(): PetSighting | null {
    return this.cat && sightingOf(this.cat);
  }

  /**
   * Move and pose it for this frame; ``now`` in ms, ``dt`` in seconds,
   * ``dog`` as the dog was last frame.
   */
  update(
    now: number,
    dt: number,
    inUse: RoomsInUse,
    dog: PetSighting | null,
  ): void {
    if (this.pouncePending) {
      this.pouncePending = false;
      this.pounceFrom = now;
    }
    if (this.heartsPending) {
      this.heartsPending = false;
      this.heartsFrom = now;
    }
    const pounce =
      this.pounceFrom !== null && now - this.pounceFrom < PARTY_MS
        ? (now - this.pounceFrom) / 1000
        : null;
    this.cat ??= catAt("tower", now, Math.random);
    // Leaping at confetti it forgets where it was going a moment.
    if (pounce === null) {
      this.cat = stepOfficeCat(this.cat, {
        now,
        dt,
        napping: inUse.catNap,
        claude: inUse.claude,
        dog,
        random: Math.random,
        findPath: findFloorPath,
        walkable: isFloorWalkable,
      });
    }
    const { root, body, legs, heart } = this.rig;
    const seconds = now / 1000;
    const act = petActOf(this.cat);
    root.position.set(this.cat.x, this.cat.y, this.cat.z);
    root.rotation.y = this.cat.facing;
    poseCat(this.rig, pounce === null ? act : "walk", seconds);
    const awake = act !== "sleep" && act !== "doze" && act !== "snuggle";
    this.snore(pounce === null && !awake);
    const pestered =
      dog !== null &&
      this.cat.y === 0 &&
      this.cat.phase === "stay" &&
      awake &&
      distance(this.cat, dog) < SWAT_REACH;
    if (pounce === null && pestered) {
      // Turned on the dog, one front paw batting at its nose.
      root.rotation.y = towards(this.cat, dog);
      legs[1].visible = true;
      legs[1].rotation.x = -1.4 + 0.5 * Math.sin(seconds * 16);
    }
    if (pounce !== null) {
      // Up on its hind legs, front paws batting at the pieces.
      for (const leg of legs) leg.visible = true;
      root.position.y += 0.35 * Math.abs(Math.sin(pounce * Math.PI * 2));
      body.position.y = LEG;
      body.rotation.x = -0.55;
      legs[0].rotation.x = -1.3 + 0.4 * Math.sin(pounce * 14);
      legs[1].rotation.x = -1.3 - 0.4 * Math.sin(pounce * 14);
      legs[2].rotation.x = legs[3].rotation.x = 0.55;
    }
    const thanks =
      this.heartsFrom !== null && now - this.heartsFrom < HEARTS_MS
        ? (now - this.heartsFrom) / 1000
        : null;
    const rise =
      thanks !== null
        ? (thanks * 0.8) % 1
        : act === "rub"
          ? (seconds % RUB_HEART_SECONDS) / RUB_HEART_SECONDS
          : null;
    heart.visible = rise !== null;
    if (rise !== null) {
      heart.position.set(0, 0.55 + 0.4 * rise, 0.1);
      heart.rotation.y = FACE_CAMERA - root.rotation.y;
      heart.scale.setScalar(0.6 * Math.min(1, rise * 4));
    }
  }
}
