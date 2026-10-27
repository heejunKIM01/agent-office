/**
 * The people of the airport, two heads tall like the office's but dressed
 * and moving for their jobs: the controller (Claude) in a headset at the
 * tower console, me as the gate agent at a podium with a hand microphone,
 * and the marshallers in hi-vis vests with glowing wands. A figure faces
 * +z at rotation 0; ``poseCrew`` moves it each frame.
 */

import * as THREE from "three";
import { AIR } from "./airportPalette";
import { box, cylinder, lamp, material, sphere } from "./airportSolids";

export type CrewRole = "controller" | "agent" | "marshal";

/**
 * What a figure is doing. Seated at the console: ``console`` (hands on the
 * desk), ``radio`` (a hand at the headset's microphone), ``binoculars``
 * (watching a plane on the runway), ``relax`` (leaning back, hands behind
 * the head), ``doze``. On its feet: ``stand``, ``podium`` (typing at the
 * gate desk), ``announce`` (the hand microphone at the mouth), ``phone``
 * (the desk handset at the ear), ``signal`` (wands up, waving a plane in)
 * and ``stop`` (wands crossed overhead). ``cheer`` throws both arms up.
 */
export type CrewPose =
  | "console"
  | "radio"
  | "binoculars"
  | "relax"
  | "doze"
  | "stand"
  | "podium"
  | "announce"
  | "phone"
  | "signal"
  | "stop"
  | "cheer";

const SEATED: ReadonlySet<CrewPose> = new Set([
  "console",
  "radio",
  "binoculars",
  "relax",
  "doze",
]);

export interface CrewRig {
  root: THREE.Group;
  hips: THREE.Group;
  head: THREE.Group;
  legs: [THREE.Group, THREE.Group];
  arms: [THREE.Group, THREE.Group];
  binoculars: THREE.Object3D;
  /** The gate agent's hand microphone. */
  mic: THREE.Object3D;
  /** A desk handset at the ear. */
  handset: THREE.Object3D;
  /** The marshaller's wands, one per hand. */
  wands: THREE.Object3D[];
  /** Where the data tag hangs, above the head. */
  tagAnchor: THREE.Object3D;
}

/** Whole figure scale: the office's for the tower and the gate, smaller on the apron beside the planes. */
const SCALES: Record<CrewRole, number> = {
  controller: 1.1,
  agent: 1.1,
  marshal: 0.75,
};
const HIP_HEIGHT = 0.75;
const SEATED_HIP_HEIGHT = 0.52;
const TAG_OVER_HIPS = 2.25;

interface Outfit {
  top: string;
  hair: string;
}

const OUTFITS: Record<CrewRole, Outfit> = {
  controller: { top: AIR.claudeShirt, hair: AIR.claudeHair },
  agent: { top: AIR.agentJacket, hair: AIR.darkHair },
  marshal: { top: AIR.hiVis, hair: AIR.darkHair },
};

function leg(side: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0.17 * side, 0, 0);
  g.add(cylinder(0.12, 0.11, 0.62, AIR.pants, 0, -0.62, 0, 12));
  g.add(box(0.22, 0.13, 0.32, AIR.shoes, 0, -0.75, 0.05));
  return g;
}

function arm(color: string, side: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0.49 * side, 0.72, 0);
  g.add(cylinder(0.1, 0.09, 0.55, color, 0, -0.55, 0, 10));
  g.add(sphere(0.1, AIR.skin, 0, -0.62, 0, [12, 8]));
  return g;
}

/** A partial sphere: three.js measures phi around y from -x towards +z. */
function shell(
  radius: number,
  color: string,
  phi: [number, number],
  theta: [number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(
      radius,
      24,
      16,
      phi[0],
      phi[1],
      theta[0],
      theta[1],
    ),
    material(color),
  );
  mesh.castShadow = true;
  return mesh;
}

function head(role: CrewRole): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0, 1.42, 0);
  g.add(sphere(0.62, AIR.skin, 0, 0, 0, [28, 20]));
  const { hair } = OUTFITS[role];
  g.add(shell(0.66, hair, [0, Math.PI * 2], [0, Math.PI * 0.42]));
  g.add(shell(0.65, hair, [Math.PI * 0.95, Math.PI * 1.1], [0, Math.PI * 0.8]));
  const eye = (x: number): THREE.Mesh =>
    sphere(0.075, AIR.eyes, x, -0.08, 0.565, [10, 8]);
  g.add(eye(-0.22), eye(0.22));
  for (const x of [-0.36, 0.36]) {
    const cheek = sphere(0.075, AIR.cheeks, x, -0.22, 0.47, [10, 8]);
    cheek.scale.set(1, 0.6, 0.4);
    g.add(cheek);
  }
  if (role === "controller" || role === "marshal") {
    // A band over the top and a cup over each ear: the controller's
    // headset, the marshaller's ear defenders.
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.05, 8, 24, Math.PI),
      material(role === "marshal" ? AIR.hiVis : AIR.headset),
    );
    band.position.y = 0.02;
    g.add(band);
    for (const side of [-1, 1]) {
      const cup = cylinder(
        0.2,
        0.2,
        0.16,
        role === "marshal" ? AIR.hiVis : AIR.headset,
        0,
        -0.08,
        0,
        14,
      );
      cup.rotation.z = Math.PI / 2;
      cup.position.set(side * 0.66, 0, 0);
      g.add(cup);
    }
    if (role === "controller") {
      // The boom microphone from the left cup round to the mouth.
      const boom = box(0.05, 0.05, 0.5, AIR.headset, -0.6, -0.28, 0.25);
      boom.rotation.y = 0.5;
      g.add(boom, sphere(0.07, AIR.headset, -0.42, -0.28, 0.47, [8, 6]));
    }
  }
  if (role === "agent") {
    // A small round cap.
    g.add(cylinder(0.42, 0.46, 0.2, AIR.agentJacket, 0, 0.5, -0.05, 20));
    g.add(cylinder(0.43, 0.43, 0.04, AIR.agentScarf, 0, 0.56, -0.05, 20));
  }
  return g;
}

/** Build one figure standing at the origin. */
export function buildCrew(role: CrewRole): CrewRig {
  const { top } = OUTFITS[role];
  const root = new THREE.Group();
  root.scale.setScalar(SCALES[role]);
  const hips = new THREE.Group();
  hips.position.y = HIP_HEIGHT;
  root.add(hips);

  const legs: [THREE.Group, THREE.Group] = [leg(-1), leg(1)];
  const arms: [THREE.Group, THREE.Group] = [arm(top, -1), arm(top, 1)];
  hips.add(...legs, ...arms);
  hips.add(box(0.8, 0.82, 0.52, top, 0, 0, 0));
  if (role === "marshal") {
    // Reflective bands round the vest.
    for (const y of [0.22, 0.52]) {
      hips.add(
        box(0.82, 0.08, 0.54, AIR.reflective, 0, y, 0, { shadow: false }),
      );
    }
  }
  if (role === "agent") {
    hips.add(box(0.3, 0.16, 0.06, AIR.agentScarf, 0, 0.66, 0.26));
  } else {
    hips.add(box(0.36, 0.06, 0.06, AIR.reflective, 0, 0.78, 0.25));
  }
  const face = head(role);
  hips.add(face);

  const binoculars = new THREE.Group();
  for (const side of [-1, 1]) {
    const tube = cylinder(0.09, 0.1, 0.32, AIR.binoculars, 0, -0.16, 0, 10);
    tube.rotation.x = Math.PI / 2;
    tube.position.x = side * 0.13;
    binoculars.add(tube);
  }
  binoculars.position.set(0, 1.36, 0.78);
  binoculars.visible = false;
  hips.add(binoculars);

  // Held in the right hand, its head up at the mouth when announcing.
  const mic = new THREE.Group();
  mic.add(cylinder(0.05, 0.04, 0.28, AIR.headset, 0, -0.14, 0, 8));
  mic.add(sphere(0.08, AIR.binoculars, 0, 0.16, 0, [10, 8]));
  mic.position.set(0, -0.72, 0.1);
  mic.rotation.x = 1.3;
  mic.visible = false;
  arms[1].add(mic);

  const handset = box(0.22, 0.5, 0.16, AIR.white, -0.84, 1, 0.25);
  handset.rotation.z = -0.45;
  handset.visible = false;
  hips.add(handset);

  // Glowing wands, pointing on from each hand.
  const wands = arms.map((a) => {
    const wand = cylinder(0.05, 0.05, 0.7, lamp(AIR.wand), 0, -1.32, 0, 8);
    wand.visible = role === "marshal";
    a.add(wand);
    return wand;
  });

  const tagAnchor = new THREE.Object3D();
  tagAnchor.position.y = HIP_HEIGHT + TAG_OVER_HIPS;
  root.add(tagAnchor);
  return {
    root,
    hips,
    head: face,
    legs,
    arms,
    binoculars,
    mic,
    handset,
    wands,
    tagAnchor,
  };
}

/** Pose a figure for this moment; ``seconds`` drives the motion. */
export function poseCrew(rig: CrewRig, pose: CrewPose, seconds: number): void {
  const [legL, legR] = rig.legs;
  const [armL, armR] = rig.arms;
  const seated = SEATED.has(pose);
  rig.hips.position.y = seated ? SEATED_HIP_HEIGHT : HIP_HEIGHT;
  rig.tagAnchor.position.y =
    (seated ? SEATED_HIP_HEIGHT : HIP_HEIGHT) + TAG_OVER_HIPS;
  legL.rotation.x = seated ? -Math.PI / 2 : 0;
  legR.rotation.x = seated ? -Math.PI / 2 : 0;
  rig.hips.rotation.x = 0;
  rig.head.rotation.set(0, 0, 0);
  armL.rotation.set(0, 0, 0);
  armR.rotation.set(0, 0, 0);
  rig.binoculars.visible = pose === "binoculars";
  rig.mic.visible = pose === "announce";
  rig.handset.visible = pose === "phone";
  const breath = 0.03 * Math.sin(seconds * 2);
  switch (pose) {
    case "console": {
      const tap = 0.12 * Math.sin(seconds * 14);
      armL.rotation.x = -1.1 + tap;
      armR.rotation.x = -1.1 - tap;
      rig.head.rotation.x = 0.12;
      return;
    }
    case "radio":
      // The left hand on the headset's microphone, the right on the desk;
      // the head nods as it talks.
      armL.rotation.set(-2.5, 0, -0.6);
      armR.rotation.x = -1.1;
      rig.head.rotation.x = 0.06 * Math.sin(seconds * 8);
      return;
    case "binoculars":
      armL.rotation.set(-2.25, 0, 0.42);
      armR.rotation.set(-2.25, 0, -0.42);
      // Following the plane along the runway.
      rig.head.rotation.y = 0.25 * Math.sin(seconds * 0.8);
      rig.binoculars.position.x = 0;
      return;
    case "relax":
      rig.hips.rotation.x = -0.18;
      armL.rotation.set(-2.6, 0, -0.9);
      armR.rotation.set(-2.6, 0, 0.9);
      return;
    case "doze":
      rig.hips.rotation.x = -0.12;
      rig.head.rotation.x = 0.35 + 0.04 * Math.sin(seconds * 1.5);
      armL.rotation.x = -0.4;
      armR.rotation.x = -0.4;
      return;
    case "cheer": {
      const swing = 0.25 * Math.sin(seconds * 9);
      armL.rotation.set(0, 0, -2.6 + swing);
      armR.rotation.set(0, 0, 2.6 - swing);
      if (!seated) {
        rig.hips.position.y =
          HIP_HEIGHT + 0.08 * Math.abs(Math.sin(seconds * 9));
      }
      return;
    }
    case "podium": {
      const tap = 0.1 * Math.sin(seconds * 12);
      armL.rotation.x = -0.9 + tap;
      armR.rotation.x = -0.9 - tap;
      rig.head.rotation.x = 0.15;
      return;
    }
    case "announce":
      // The microphone up at the mouth, the other hand gesturing.
      armR.rotation.set(-2.2, 0, -0.55);
      armL.rotation.set(-0.6 + 0.15 * Math.sin(seconds * 4), 0, -0.25);
      return;
    case "phone":
      armL.rotation.set(-2.5, 0, -0.6);
      armR.rotation.x = -0.5;
      return;
    case "signal": {
      // Both wands up and waving in towards the head: come ahead.
      const beckon = 0.45 * Math.sin(seconds * 5);
      armL.rotation.set(0, 0, -2.4 + beckon);
      armR.rotation.set(0, 0, 2.4 - beckon);
      return;
    }
    case "stop":
      armL.rotation.set(0, 0, -2.75);
      armR.rotation.set(0, 0, 2.75);
      return;
    case "stand":
      armL.rotation.x = breath;
      armR.rotation.x = -breath;
      return;
  }
}
