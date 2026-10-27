/**
 * The people of the construction site, two heads tall like the office's
 * but dressed for the site: the site manager (Claude) and me, the owner,
 * in white hard hats, and the workers in hi-vis vests with hard hats in
 * their crew's colour. A figure faces +z at rotation 0; ``poseSiteFigure``
 * moves it each frame for walking and for each kind of work.
 */

import * as THREE from "three";
import { SITE } from "./sitePalette";
import { box, cylinder, material, sphere } from "./siteSolids";

export type SiteRole = "manager" | "owner" | "worker";

/**
 * What a figure is doing: ``walk``; at work ``plans`` (bent over the plan
 * table), ``build`` (hammering at the scaffold), ``operate`` (at the
 * machine's levers), ``check`` (ticking a clipboard), ``point`` (directing,
 * at the schedule board or the building); ``talk`` and ``phone`` with me;
 * ``stand``; resting ``sit``, ``coffee`` and ``doze`` on the bench;
 * ``wave`` on the way out, ``cheer``, ``dismay`` (hands on the head when
 * tests fail) and ``hatWave`` (the hard hat off and waved when I say thanks).
 */
export type SitePose =
  | "walk"
  | "stand"
  | "plans"
  | "build"
  | "operate"
  | "check"
  | "point"
  | "talk"
  | "phone"
  | "sit"
  | "coffee"
  | "doze"
  | "wave"
  | "cheer"
  | "dismay"
  | "hatWave";

const SEATED: ReadonlySet<SitePose> = new Set(["sit", "coffee", "doze"]);

export interface SiteFigure {
  root: THREE.Group;
  hips: THREE.Group;
  head: THREE.Group;
  /** The hard hat, which comes off to be waved. */
  hat: THREE.Group;
  legs: [THREE.Group, THREE.Group];
  arms: [THREE.Group, THREE.Group];
  clipboard: THREE.Object3D;
  hammer: THREE.Object3D;
  cup: THREE.Object3D;
  phone: THREE.Object3D;
  /** Where the tag hangs, above the hard hat. */
  tagAnchor: THREE.Object3D;
}

const SCALE = 1.05;
const HIP_HEIGHT = 0.75;
const SEATED_HIP_HEIGHT = 0.52;
const TAG_OVER_HIPS = 2.45;
const STRIDE_RATE = 9;

interface Dress {
  top: string;
  hair: string;
  hat: string;
}

function leg(side: 1 | -1, pants: string): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0.17 * side, 0, 0);
  g.add(cylinder(0.12, 0.11, 0.62, pants, 0, -0.62, 0, 12));
  g.add(box(0.22, 0.13, 0.32, SITE.shoes, 0, -0.75, 0.05));
  return g;
}

function arm(color: string, side: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0.49 * side, 0.72, 0);
  g.add(cylinder(0.1, 0.09, 0.55, color, 0, -0.55, 0, 10));
  g.add(sphere(0.1, SITE.skin, 0, -0.62, 0, [12, 8]));
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

function head(dress: Dress): { group: THREE.Group; hat: THREE.Group } {
  const g = new THREE.Group();
  g.position.set(0, 1.42, 0);
  g.add(sphere(0.62, SITE.skin, 0, 0, 0, [28, 20]));
  g.add(shell(0.65, dress.hair, Math.PI * 0.42));
  const eye = (x: number): THREE.Mesh =>
    sphere(0.075, SITE.eyes, x, -0.08, 0.565, [10, 8]);
  g.add(eye(-0.22), eye(0.22));
  for (const x of [-0.36, 0.36]) {
    const cheek = sphere(0.075, SITE.cheeks, x, -0.22, 0.47, [10, 8]);
    cheek.scale.set(1, 0.6, 0.4);
    g.add(cheek);
  }
  // The hard hat: a dome with a ridge and a brim all round, peaked in front.
  const hat = new THREE.Group();
  const dome = shell(0.72, dress.hat, Math.PI * 0.45);
  dome.position.y = 0.08;
  hat.add(dome);
  hat.add(box(0.12, 0.08, 1.1, dress.hat, 0, 0.74, 0));
  const brim = cylinder(0.86, 0.86, 0.05, dress.hat, 0, 0.12, 0.08, 24);
  brim.scale.z = 1.08;
  hat.add(brim);
  g.add(hat);
  return { group: g, hat };
}

function dressFor(role: SiteRole, hat: string): Dress {
  switch (role) {
    case "manager":
      return {
        top: SITE.claudeShirt,
        hair: SITE.claudeHair,
        hat: SITE.hatWhite,
      };
    case "owner":
      return { top: SITE.suit, hair: SITE.darkHair, hat: SITE.hatWhite };
    case "worker":
      return { top: SITE.hiVis, hair: SITE.darkHair, hat };
  }
}

/** Build one figure standing at the origin; a worker's hat in ``hat``. */
export function buildSiteFigure(
  role: SiteRole,
  hat: string = SITE.hatGeneral,
): SiteFigure {
  const dress = dressFor(role, hat);
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  const hips = new THREE.Group();
  hips.position.y = HIP_HEIGHT;
  root.add(hips);
  const pants = role === "owner" ? SITE.suit : SITE.pants;
  const legs: [THREE.Group, THREE.Group] = [leg(-1, pants), leg(1, pants)];
  const arms: [THREE.Group, THREE.Group] = [
    arm(dress.top, -1),
    arm(dress.top, 1),
  ];
  hips.add(...legs, ...arms);
  hips.add(box(0.8, 0.82, 0.52, dress.top, 0, 0, 0));
  if (role === "owner") {
    // A white shirt and a tie under the jacket.
    hips.add(
      box(0.26, 0.5, 0.04, SITE.reflective, 0, 0.3, 0.26, { shadow: false }),
    );
    hips.add(
      box(0.08, 0.42, 0.05, SITE.manager, 0, 0.32, 0.28, { shadow: false }),
    );
  } else {
    // A vest's reflective bands (the manager wears one over its shirt).
    for (const y of [0.22, 0.5]) {
      hips.add(
        box(
          0.82,
          0.08,
          0.54,
          role === "worker" ? SITE.reflective : SITE.hiVis,
          0,
          y,
          0,
          {
            shadow: false,
          },
        ),
      );
    }
  }
  const { group: face, hat: hardHat } = head(dress);
  hips.add(face);

  // The clipboard in the left hand, the hammer, cup and phone in the right.
  const clipboard = new THREE.Group();
  clipboard.add(box(0.36, 0.04, 0.48, SITE.clipboard, 0, 0, 0));
  clipboard.add(box(0.3, 0.02, 0.4, SITE.paper, 0, 0.04, 0, { shadow: false }));
  clipboard.position.set(0, -0.7, 0.18);
  clipboard.rotation.x = 1.2;
  clipboard.visible = false;
  arms[0].add(clipboard);
  const hammer = new THREE.Group();
  hammer.add(box(0.06, 0.5, 0.06, SITE.hammer, 0, -0.25, 0));
  hammer.add(box(0.26, 0.1, 0.1, SITE.steel, 0, -0.55, 0));
  hammer.position.set(0, -0.62, 0.08);
  hammer.rotation.x = 1.4;
  hammer.visible = false;
  arms[1].add(hammer);
  const cup = cylinder(0.1, 0.08, 0.22, SITE.cup, 0, -0.11, 0, 12);
  cup.position.set(0, -0.72, 0.14);
  cup.rotation.x = 0.9;
  cup.visible = false;
  arms[1].add(cup);
  const phone = box(0.2, 0.46, 0.14, SITE.phone, -0.84, 1, 0.25);
  phone.rotation.z = -0.45;
  phone.visible = false;
  hips.add(phone);

  const tagAnchor = new THREE.Object3D();
  tagAnchor.position.y = HIP_HEIGHT + TAG_OVER_HIPS;
  root.add(tagAnchor);
  return {
    root,
    hips,
    head: face,
    hat: hardHat,
    legs,
    arms,
    clipboard,
    hammer,
    cup,
    phone,
    tagAnchor,
  };
}

/** Pose a figure for this moment; ``seconds`` drives the motion. */
export function poseSiteFigure(
  fig: SiteFigure,
  pose: SitePose,
  seconds: number,
): void {
  const [legL, legR] = fig.legs;
  const [armL, armR] = fig.arms;
  const seated = SEATED.has(pose);
  fig.hips.position.y = seated ? SEATED_HIP_HEIGHT : HIP_HEIGHT;
  fig.tagAnchor.position.y =
    (seated ? SEATED_HIP_HEIGHT : HIP_HEIGHT) + TAG_OVER_HIPS;
  fig.hips.rotation.set(0, 0, 0);
  fig.head.rotation.set(0, 0, 0);
  fig.hat.position.set(0, 0, 0);
  fig.hat.rotation.set(0, 0, 0);
  legL.rotation.set(seated ? -Math.PI / 2 : 0, 0, 0);
  legR.rotation.set(seated ? -Math.PI / 2 : 0, 0, 0);
  armL.rotation.set(0, 0, 0);
  armR.rotation.set(0, 0, 0);
  fig.clipboard.visible = pose === "check" || pose === "point";
  fig.hammer.visible = pose === "build";
  fig.cup.visible = pose === "coffee";
  fig.phone.visible = pose === "phone";
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
    case "plans":
      // Bent over the drawings, a hand on each side of the sheet.
      fig.hips.rotation.x = 0.28;
      fig.head.rotation.x = 0.2;
      armL.rotation.set(-0.95, 0, 0.15);
      armR.rotation.set(-0.95 + 0.06 * Math.sin(seconds * 3), 0, -0.15);
      return;
    case "build": {
      // Hammering at the scaffold: the right arm up and down.
      const blow = Math.max(0, Math.sin(seconds * 7));
      armR.rotation.x = -1.2 - 1.2 * blow;
      armL.rotation.x = -1.0;
      return;
    }
    case "operate": {
      const jiggle = 0.12 * Math.sin(seconds * 6);
      armL.rotation.x = -1.15 + jiggle;
      armR.rotation.x = -1.15 - jiggle;
      return;
    }
    case "check":
      armL.rotation.x = -1.05;
      armR.rotation.set(-0.95 + 0.08 * Math.sin(seconds * 9), 0, 0.2);
      fig.head.rotation.x = 0.18;
      return;
    case "point":
      armL.rotation.x = -1.0;
      armR.rotation.set(-1.75 + 0.1 * Math.sin(seconds * 2.5), 0, -0.15);
      return;
    case "talk":
      armL.rotation.set(-0.7 + 0.2 * Math.sin(seconds * 4), 0, -0.2);
      armR.rotation.set(-0.7 - 0.2 * Math.sin(seconds * 4), 0, 0.2);
      fig.head.rotation.y = 0.15 * Math.sin(seconds * 2);
      return;
    case "phone":
      armL.rotation.set(-2.5, 0, -0.6);
      armR.rotation.x = -0.4;
      return;
    case "sit":
      armL.rotation.x = -0.4 + breath;
      armR.rotation.x = -0.4 - breath;
      return;
    case "coffee":
      armL.rotation.x = -0.4;
      armR.rotation.x = -1.2 - 0.5 * Math.max(0, Math.sin(seconds * 0.8));
      return;
    case "doze":
      fig.hips.rotation.x = -0.12;
      fig.head.rotation.x = 0.35 + 0.04 * Math.sin(seconds * 1.5);
      armL.rotation.x = -0.4;
      armR.rotation.x = -0.4;
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
      // Hands on the hard hat, the head shaking a little.
      armL.rotation.set(-0.4, 0, -2.35);
      armR.rotation.set(-0.4, 0, 2.35);
      fig.head.rotation.set(0.12, 0.18 * Math.sin(seconds * 7), 0);
      return;
    case "hatWave": {
      // The hard hat off and waved overhead in the right hand.
      const swing = 0.3 * Math.sin(seconds * 9);
      armR.rotation.set(0, 0, 2.6 + swing);
      armL.rotation.x = breath;
      // The hand, relative to the head: the arm raised about its shoulder.
      const angle = 2.6 + swing;
      fig.hat.position.set(
        0.49 + 0.62 * Math.sin(angle),
        0.72 - 0.62 * Math.cos(angle) - 1.42 + 0.35,
        0,
      );
      fig.hat.rotation.z = swing * 1.5 - 0.3;
      return;
    }
    case "stand":
      armL.rotation.x = breath;
      armR.rotation.x = -breath;
      return;
  }
}
