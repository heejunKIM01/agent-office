/**
 * The people of the fishing spot, two heads tall like the office's but
 * dressed for the reservoir: the boss who runs it (Claude) in a navy cap,
 * a navy vest and boots, me, the guest, in a straw hat, and the anglers in
 * olive fishing vests with bucket hats in their crew's colour. A figure faces +z at
 * rotation 0; ``poseFishingFigure`` moves it each frame for walking and for
 * each kind of work.
 */

import * as THREE from "three";
import { WATER_Y } from "@/constants/fishingPlan";
import type { Species } from "@/systems/fishingCatch";
import { FISH } from "./fishingPalette";
import { fishModel } from "./fishingProps";
import { box, cylinder, material, sphere, strand } from "./fishingSolids";

export type FishingRole = "boss" | "guest" | "angler";

/**
 * What a figure is doing: ``walk``; at work ``peer`` (on the pontoon,
 * looking into the water), ``fish`` (in a seat behind its rods, watching
 * the floats), ``rope`` (holding the shrimp net's line), ``bait`` (leaning
 * in at the shop counter), ``point`` (at the chalkboard); ``talk`` and ``radio``
 * with me; ``stand``; resting ``sit``, ``noodles`` (cup noodles), ``log``
 * (writing the fishing log) and ``doze`` (the hat over the face);
 * ``wave`` on the way out, ``cheer``, ``dismay`` (hands on the head when
 * tests fail) and ``catch`` (a fish held out in front for all to see).
 */
export type FishingPose =
  | "walk"
  | "stand"
  | "peer"
  | "fish"
  | "rope"
  | "bait"
  | "point"
  | "talk"
  | "radio"
  | "sit"
  | "noodles"
  | "log"
  | "doze"
  | "wave"
  | "cheer"
  | "dismay"
  | "catch";

const SEATED: ReadonlySet<FishingPose> = new Set([
  "fish",
  "sit",
  "noodles",
  "log",
  "doze",
]);

export interface FishingFigure {
  root: THREE.Group;
  hips: THREE.Group;
  head: THREE.Group;
  /** The hat, which goes over the face for a doze. */
  hat: THREE.Group;
  legs: [THREE.Group, THREE.Group];
  arms: [THREE.Group, THREE.Group];
  /** A trap's line from the hands down into the water. */
  rope: THREE.Object3D;
  radio: THREE.Object3D;
  noodles: THREE.Object3D;
  notebook: THREE.Object3D;
  /** The fish held up for a catch, when there is one. */
  held: { species: Species; model: THREE.Group } | null;
  /** Where the tag hangs, above the hat. */
  tagAnchor: THREE.Object3D;
}

const SCALE = 1.05;
const HIP_HEIGHT = 0.75;
const SEATED_HIP_HEIGHT = 0.5;
const TAG_OVER_HIPS = 2.45;
const STRIDE_RATE = 9;
/** The water's surface in a figure's own units, standing on the quay. */
const WATER_LOCAL = WATER_Y / SCALE;

interface Dress {
  top: string;
  sleeves: string;
  hair: string;
  pants: string;
}

function leg(side: 1 | -1, pants: string): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0.17 * side, 0, 0);
  g.add(cylinder(0.12, 0.11, 0.62, pants, 0, -0.62, 0, 12));
  g.add(box(0.22, 0.13, 0.32, FISH.shoes, 0, -0.75, 0.05));
  return g;
}

function arm(color: string, side: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0.49 * side, 0.72, 0);
  g.add(cylinder(0.1, 0.09, 0.55, color, 0, -0.55, 0, 10));
  g.add(sphere(0.1, FISH.skin, 0, -0.62, 0, [12, 8]));
  return g;
}

/** A partial sphere: three.js measures phi around y from -x towards +z. */
function shell(radius: number, color: string, theta: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 16, 0, Math.PI * 2, 0, theta),
    material(color),
  );
  mesh.castShadow = true;
  return mesh;
}

/** The boss's navy ball cap: a round crown, a long visor and a white front. */
function ballCap(): THREE.Group {
  const g = new THREE.Group();
  const crown = shell(0.68, FISH.bossCap, Math.PI * 0.5);
  crown.position.y = 0.2;
  g.add(crown);
  const visor = cylinder(0.46, 0.46, 0.05, FISH.bossCap, 0, 0.18, 0.58, 16);
  visor.scale.set(1, 1, 0.75);
  g.add(visor);
  const front = shell(0.69, FISH.capFront, Math.PI * 0.28);
  front.position.y = 0.2;
  front.rotation.x = 0.55;
  g.add(front);
  return g;
}

/** My straw hat: a wide brim, a round crown and a red band. */
function strawHat(): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(1.05, 1.05, 0.05, FISH.strawHat, 0, 0.32, 0, 28));
  g.add(cylinder(0.5, 0.62, 0.42, FISH.strawHat, 0, 0.36, 0, 24));
  g.add(cylinder(0.6, 0.62, 0.1, FISH.strawBand, 0, 0.38, 0, 24));
  return g;
}

/** An angler's bucket hat in its crew's colour, the brim sloping down. */
function bucketHat(color: string): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(0.55, 0.66, 0.36, color, 0, 0.34, 0, 24));
  g.add(cylinder(0.66, 0.9, 0.14, color, 0, 0.24, 0, 24));
  return g;
}

function head(
  role: FishingRole,
  dress: Dress,
  hatColor: string,
): { group: THREE.Group; hat: THREE.Group } {
  const g = new THREE.Group();
  g.position.set(0, 1.42, 0);
  g.add(sphere(0.62, FISH.skin, 0, 0, 0, [28, 20]));
  g.add(shell(0.65, dress.hair, Math.PI * 0.42));
  const eye = (x: number): THREE.Mesh =>
    sphere(0.075, FISH.eyes, x, -0.08, 0.565, [10, 8]);
  g.add(eye(-0.22), eye(0.22));
  for (const x of [-0.36, 0.36]) {
    const cheek = sphere(0.075, FISH.cheeks, x, -0.22, 0.47, [10, 8]);
    cheek.scale.set(1, 0.6, 0.4);
    g.add(cheek);
  }
  const hat =
    role === "boss"
      ? ballCap()
      : role === "guest"
        ? strawHat()
        : bucketHat(hatColor);
  g.add(hat);
  return { group: g, hat };
}

function dressFor(role: FishingRole): Dress {
  switch (role) {
    case "boss":
      return {
        top: FISH.bossVest,
        sleeves: FISH.claudeShirt,
        hair: FISH.claudeHair,
        pants: FISH.pants,
      };
    case "guest":
      return {
        top: FISH.guestShirt,
        sleeves: FISH.guestShirt,
        hair: FISH.darkHair,
        pants: FISH.shorts,
      };
    case "angler":
      return {
        top: FISH.anglerVest,
        sleeves: FISH.anglerShirt,
        hair: FISH.darkHair,
        pants: FISH.pants,
      };
  }
}

/** Build one figure standing at the origin; an angler's hat in ``hat``. */
export function buildFishingFigure(
  role: FishingRole,
  hat: string = FISH.hatGeneral,
): FishingFigure {
  const dress = dressFor(role);
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  const hips = new THREE.Group();
  hips.position.y = HIP_HEIGHT;
  root.add(hips);
  const legs: [THREE.Group, THREE.Group] = [
    leg(-1, dress.pants),
    leg(1, dress.pants),
  ];
  const arms: [THREE.Group, THREE.Group] = [
    arm(dress.sleeves, -1),
    arm(dress.sleeves, 1),
  ];
  hips.add(...legs, ...arms);
  hips.add(box(0.8, 0.82, 0.52, dress.top, 0, 0, 0));
  if (role === "boss") {
    // The shirt between the vest's two halves, and boots to the knee.
    hips.add(
      box(0.24, 0.8, 0.04, FISH.claudeShirt, 0, 0.01, 0.26, { shadow: false }),
    );
    for (const legGroup of legs) {
      legGroup.add(cylinder(0.14, 0.14, 0.42, FISH.boots, 0, -0.68, 0, 12));
    }
  } else if (role === "angler") {
    // The vest's pockets.
    for (const x of [-0.22, 0.22]) {
      hips.add(
        box(0.24, 0.2, 0.04, FISH.anglerShirt, x, 0.18, 0.27, {
          shadow: false,
        }),
      );
    }
  }
  const { group: face, hat: worn } = head(role, dress, hat);
  hips.add(face);

  const rope = strand(
    new THREE.Vector3(0, 0.95, 0.5),
    new THREE.Vector3(0, WATER_LOCAL, 1.8),
    0.03,
    FISH.rope,
  );
  rope.visible = false;
  root.add(rope);
  const radio = box(0.16, 0.36, 0.1, FISH.radio, -0.84, 1, 0.25);
  radio.rotation.z = -0.45;
  radio.add(box(0.03, 0.2, 0.03, FISH.radio, 0.04, 0.26, 0));
  radio.visible = false;
  hips.add(radio);
  const noodles = new THREE.Group();
  noodles.add(cylinder(0.13, 0.1, 0.24, FISH.noodleCup, 0, -0.12, 0, 12));
  noodles.add(cylinder(0.135, 0.13, 0.06, FISH.noodleBand, 0, -0.04, 0, 12));
  noodles.position.set(0, -0.72, 0.14);
  noodles.rotation.x = 0.9;
  noodles.visible = false;
  arms[0].add(noodles);
  const notebook = box(0.32, 0.04, 0.42, FISH.notebook, 0, 0, 0);
  notebook.position.set(0, -0.7, 0.18);
  notebook.rotation.x = 1.2;
  notebook.visible = false;
  arms[0].add(notebook);

  const tagAnchor = new THREE.Object3D();
  tagAnchor.position.y = HIP_HEIGHT + TAG_OVER_HIPS;
  root.add(tagAnchor);
  return {
    root,
    hips,
    head: face,
    hat: worn,
    legs,
    arms,
    rope,
    radio,
    noodles,
    notebook,
    held: null,
    tagAnchor,
  };
}

/** Hold ``species`` out in front, below the tag, or put the fish down (null). */
export function holdFish(fig: FishingFigure, species: Species | null): void {
  if (fig.held?.species === species) return;
  if (fig.held) {
    fig.held.model.removeFromParent();
    fig.held.model.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    fig.held = null;
  }
  if (species === null) return;
  const model = fishModel(species);
  model.position.set(0, 1.7, 0.85);
  fig.root.add(model);
  fig.held = { species, model };
}

/**
 * Pose a figure for this moment; ``seconds`` drives the motion. ``seated``
 * keeps it in its chair whatever it does (me, under my parasol).
 */
export function poseFishingFigure(
  fig: FishingFigure,
  pose: FishingPose,
  seconds: number,
  seated = SEATED.has(pose),
): void {
  const [legL, legR] = fig.legs;
  const [armL, armR] = fig.arms;
  const hipY = seated ? SEATED_HIP_HEIGHT : HIP_HEIGHT;
  fig.hips.position.y = hipY;
  fig.tagAnchor.position.y = hipY + TAG_OVER_HIPS;
  fig.hips.rotation.set(0, 0, 0);
  fig.head.rotation.set(0, 0, 0);
  fig.hat.position.set(0, 0, 0);
  fig.hat.rotation.set(0, 0, 0);
  legL.rotation.set(seated ? -Math.PI / 2 : 0, 0, 0);
  legR.rotation.set(seated ? -Math.PI / 2 : 0, 0, 0);
  armL.rotation.set(0, 0, 0);
  armR.rotation.set(0, 0, 0);
  fig.rope.visible = pose === "rope";
  fig.radio.visible = pose === "radio";
  fig.noodles.visible = pose === "noodles";
  fig.notebook.visible = pose === "log";
  if (fig.held) {
    fig.held.model.visible = pose === "catch";
    fig.held.model.rotation.set(0, 0, 0.25 * Math.sin(seconds * 14));
  }
  const breath = 0.03 * Math.sin(seconds * 2);
  switch (pose) {
    case "walk": {
      const swing = Math.sin(seconds * STRIDE_RATE);
      legL.rotation.x = 0.55 * swing;
      legR.rotation.x = -0.55 * swing;
      armL.rotation.x = -0.45 * swing;
      armR.rotation.x = 0.45 * swing;
      fig.hips.position.y =
        HIP_HEIGHT + 0.05 * Math.abs(Math.cos(seconds * STRIDE_RATE));
      return;
    }
    case "peer":
      // Leaning on the rail, looking down into the water.
      fig.hips.rotation.x = 0.25;
      fig.head.rotation.x = 0.35 + 0.05 * Math.sin(seconds * 1.3);
      fig.head.rotation.y = 0.25 * Math.sin(seconds * 0.6);
      armL.rotation.set(-1.25, 0, 0.2);
      armR.rotation.set(-1.25, 0, -0.2);
      return;
    case "fish": {
      // Leaning on the knees behind the rods, eyes on the floats; now and
      // then a hand goes out to the nearest rod.
      const reach = Math.max(0, Math.sin(seconds * 0.7)) ** 6;
      fig.hips.rotation.x = 0.12;
      fig.head.rotation.x = 0.12;
      fig.head.rotation.y = 0.18 * Math.sin(seconds * 0.4);
      armL.rotation.set(-0.75, 0, 0.15);
      armR.rotation.set(-0.75 - 0.5 * reach, 0, -0.15);
      return;
    }
    case "rope": {
      // Holding the trap's line, giving it a tug now and then.
      const tug = 0.15 * Math.max(0, Math.sin(seconds * 2.2));
      armL.rotation.set(-0.9 + tug, 0, 0.15);
      armR.rotation.set(-0.9 + tug, 0, -0.15);
      fig.hips.rotation.x = 0.1;
      return;
    }
    case "bait":
      // Bent into the freezer, rummaging.
      fig.hips.rotation.x = 0.4;
      fig.head.rotation.x = 0.25;
      armL.rotation.x = -1.3 + 0.12 * Math.sin(seconds * 5);
      armR.rotation.x = -1.3 - 0.12 * Math.sin(seconds * 5);
      return;
    case "point":
      armL.rotation.x = -0.3;
      armR.rotation.set(-1.75 + 0.1 * Math.sin(seconds * 2.5), 0, -0.15);
      return;
    case "talk":
      armL.rotation.set(-0.7 + 0.2 * Math.sin(seconds * 4), 0, -0.2);
      armR.rotation.set(-0.7 - 0.2 * Math.sin(seconds * 4), 0, 0.2);
      fig.head.rotation.y = 0.15 * Math.sin(seconds * 2);
      return;
    case "radio":
      armL.rotation.set(-2.5, 0, -0.6);
      armR.rotation.x = -0.4;
      return;
    case "sit":
      armL.rotation.x = -0.4 + breath;
      armR.rotation.x = -0.4 - breath;
      return;
    case "noodles": {
      // The cup in the left hand, the right taking the noodles up.
      const slurp = Math.max(0, Math.sin(seconds * 1.6));
      armL.rotation.x = -1.1;
      armR.rotation.set(-1.1 - 0.6 * slurp, 0, -0.25);
      fig.head.rotation.x = 0.15 - 0.1 * slurp;
      return;
    }
    case "log":
      // The fishing log on the knee, writing.
      armL.rotation.x = -1.05;
      armR.rotation.set(-0.95 + 0.08 * Math.sin(seconds * 9), 0, 0.2);
      fig.head.rotation.x = 0.25;
      return;
    case "doze":
      // Leaning back, the hat tipped down over the eyes.
      fig.hips.rotation.x = -0.18;
      fig.head.rotation.x = -0.3 + 0.03 * Math.sin(seconds * 1.5);
      fig.hat.position.set(0, -0.14, 0.2);
      fig.hat.rotation.x = 0.65;
      armL.rotation.set(-0.3, 0, 0.35);
      armR.rotation.set(-0.3, 0, -0.35);
      return;
    case "wave":
      armR.rotation.set(0, 0, 2.5 + 0.3 * Math.sin(seconds * 10));
      armL.rotation.x = breath;
      return;
    case "cheer": {
      const swing = 0.25 * Math.sin(seconds * 9);
      armL.rotation.set(0, 0, -2.6 + swing);
      armR.rotation.set(0, 0, 2.6 - swing);
      if (!seated)
        fig.hips.position.y =
          HIP_HEIGHT + 0.08 * Math.abs(Math.sin(seconds * 9));
      return;
    }
    case "dismay":
      armL.rotation.set(-0.4, 0, -2.35);
      armR.rotation.set(-0.4, 0, 2.35);
      fig.head.rotation.set(0.12, 0.18 * Math.sin(seconds * 7), 0);
      return;
    case "catch":
      // Both hands out in front holding the fish up, the fish wriggling.
      armL.rotation.set(-1.75, 0, -0.35);
      armR.rotation.set(-1.75, 0, 0.35);
      if (!seated)
        fig.hips.position.y =
          HIP_HEIGHT + 0.06 * Math.abs(Math.sin(seconds * 7));
      return;
    case "stand":
      armL.rotation.x = breath;
      armR.rotation.x = -breath;
      return;
  }
}
