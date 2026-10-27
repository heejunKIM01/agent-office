/**
 * The office cat on screen (systems/officeCat.ts decides where it goes): an
 * orange tabby with white socks that ambles on four legs, tail up, hops onto
 * its perches and, once there, curls up asleep, loafs, washes a paw, dozes,
 * eats, sniffs or rubs against Claude's legs with a heart. When work ships
 * it leaps at the falling confetti, and when I say thanks a heart rises over
 * it too.
 */

import * as THREE from "three";
import { findFloorPath } from "@/systems/isoNavGrid";
import {
  catActOf,
  catAt,
  stepOfficeCat,
  type OfficeCat,
} from "@/systems/officeCat";
import { HEARTS_MS, PARTY_MS } from "@/systems/roomGimmicks";
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

type CatPose = ReturnType<typeof catActOf>;

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
  const lying =
    act === "loaf" || act === "keyboard" || act === "doze" || act === "sleep";
  const shut = act === "doze" || act === "sleep";
  for (const eye of eyes) eye.scale.y = shut ? 0.2 : 1;
  if (lying) {
    // Paws tucked under, breathing slowly, the tail swaying along the floor.
    body.position.y = 0;
    for (const leg of legs) leg.visible = false;
    body.scale.y = 1 + 0.04 * Math.sin(seconds * (shut ? 1.6 : 2.4));
    tail.rotation.set(0, 0.5 * Math.sin(seconds * 1.8), 0);
    if (act === "doze") head.position.y = 0.06;
    if (act === "sleep") {
      // Curled up: the head down on its side, the tail wrapped round.
      body.scale.z = 0.85;
      head.position.set(0.08, 0.02, 0.22);
      head.rotation.set(0.25, -0.7, 0.35);
      tail.rotation.set(0, 2.3 + 0.1 * Math.sin(seconds), 0);
    }
    return;
  }
  switch (act) {
    case "walk": {
      const swing = 0.55 * Math.sin(seconds * 10);
      frontL.rotation.x = swing;
      backR.rotation.x = swing;
      frontR.rotation.x = -swing;
      backL.rotation.x = -swing;
      body.position.y = LEG + 0.015 * Math.abs(Math.cos(seconds * 10));
      tail.rotation.x = 1.1 + 0.12 * Math.sin(seconds * 3);
      return;
    }
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

  /** Move and pose it for this frame; ``now`` in ms, ``dt`` in seconds. */
  update(now: number, dt: number, inUse: RoomsInUse): void {
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
        claudeSeated: inUse.claudeSeated,
        random: Math.random,
        findPath: findFloorPath,
      });
    }
    const { root, body, legs, heart } = this.rig;
    const seconds = now / 1000;
    const act = catActOf(this.cat);
    root.position.set(this.cat.x, this.cat.y, this.cat.z);
    root.rotation.y = this.cat.facing;
    poseCat(this.rig, pounce === null ? act : "walk", seconds);
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
