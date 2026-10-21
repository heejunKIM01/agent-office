/**
 * Two-head-tall people of the isometric office (docs/plan/spec.md 「캐릭터」):
 * a big round head with hair and rosy cheeks on a small body, with arms and
 * legs that swing while walking. Built from simple solids like the furniture;
 * a person faces +z at rotation 0.
 */

import * as THREE from "three";
import type { ErrandRoomId } from "@/constants/isoFloorPlan";
import type { IsoPose } from "@/systems/isoErrands";
import type { PersonKind } from "@/systems/officePeople";
import { ISO_COLORS as C } from "./isoPalette";
import { box, cylinder, material } from "./isoFurniture";

interface Look {
  shirt: string;
  hair: string;
  pants: string;
}

/** Claude in coral, me in navy, subagents in blue, as in the video. */
const LOOKS: Record<PersonKind, Look> = {
  claude: { shirt: C.claudeShirt, hair: C.claudeHair, pants: C.pants },
  me: { shirt: C.myShirt, hair: C.darkHair, pants: C.myPants },
  subagent: { shirt: C.subagentShirt, hair: C.darkHair, pants: C.pants },
};

/** Whole figure scale; about 3.1m tall standing, a little under the walls. */
const SCALE = 1.1;
const HIP_HEIGHT = 0.75;
const SEATED_HIP_HEIGHT = 0.52;
const STRIDE_RATE = 9;

export interface CharacterRig {
  root: THREE.Group;
  /** Hips and everything above them; lowered to sit. */
  hips: THREE.Group;
  legs: [THREE.Group, THREE.Group];
  arms: [THREE.Group, THREE.Group];
  book: THREE.Object3D;
  /** Where the name chip hangs, just above the hair. */
  chipAnchor: THREE.Object3D;
}

function sphere(
  radius: number,
  color: string,
  x: number,
  y: number,
  z: number,
  segments: [number, number] = [20, 14],
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, segments[0], segments[1]),
    material(color),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
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

function leg(look: Look, side: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0.17 * side, 0, 0);
  g.add(cylinder(0.12, 0.11, 0.62, look.pants, 0, -0.62, 0, 12));
  g.add(box(0.22, 0.13, 0.32, C.shoes, 0, -0.75, 0.05));
  return g;
}

function arm(look: Look, side: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0.49 * side, 0.72, 0);
  g.add(cylinder(0.1, 0.09, 0.55, look.shirt, 0, -0.55, 0, 10));
  g.add(sphere(0.1, C.skin, 0, -0.62, 0, [12, 8]));
  return g;
}

function head(look: Look): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0, 1.42, 0);
  g.add(sphere(0.62, C.skin, 0, 0, 0, [28, 20]));
  // Hair: a cap over the top, and a longer piece down the back and sides.
  g.add(shell(0.66, look.hair, [0, Math.PI * 2], [0, Math.PI * 0.42]));
  g.add(
    shell(0.65, look.hair, [Math.PI * 0.95, Math.PI * 1.1], [0, Math.PI * 0.8]),
  );
  const eye = (x: number) => sphere(0.075, C.eyes, x, -0.08, 0.565, [10, 8]);
  g.add(eye(-0.22), eye(0.22));
  const cheek = (x: number) => {
    const c = sphere(0.075, C.cheeks, x, -0.22, 0.47, [10, 8]);
    c.scale.set(1, 0.6, 0.4);
    return c;
  };
  g.add(cheek(-0.36), cheek(0.36));
  return g;
}

/** Build one person standing at the origin. */
export function buildCharacter(kind: PersonKind): CharacterRig {
  const look = LOOKS[kind];
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  const hips = new THREE.Group();
  hips.position.y = HIP_HEIGHT;
  root.add(hips);

  const legs: [THREE.Group, THREE.Group] = [leg(look, -1), leg(look, 1)];
  const arms: [THREE.Group, THREE.Group] = [arm(look, -1), arm(look, 1)];
  hips.add(...legs, ...arms);
  hips.add(box(0.8, 0.82, 0.52, look.shirt, 0, 0, 0));
  hips.add(box(0.36, 0.06, 0.06, C.collar, 0, 0.78, 0.25));
  hips.add(head(look));

  const book = new THREE.Group();
  book.add(box(0.5, 0.36, 0.08, C.bookCover, 0, 0, 0));
  book.add(box(0.46, 0.32, 0.02, C.bookPages, 0, 0.02, 0.05));
  book.position.set(0, 0.42, 0.5);
  book.rotation.x = -0.5;
  book.visible = false;
  hips.add(book);

  const chipAnchor = new THREE.Object3D();
  chipAnchor.position.set(0, 2.2, 0);
  hips.add(chipAnchor);

  return { root, hips, legs, arms, book, chipAnchor };
}

/**
 * Pose a person for this frame: swinging limbs while walking, legs forward
 * on a chair, a book in hand in the library, hands at the rack in the
 * server room. ``seconds`` drives the stride.
 */
export function poseCharacter(
  rig: CharacterRig,
  pose: IsoPose,
  room: ErrandRoomId | null,
  seconds: number,
): void {
  const [legL, legR] = rig.legs;
  const [armL, armR] = rig.arms;
  rig.book.visible = pose === "work" && room === "library";
  if (pose === "walk") {
    const swing = Math.sin(seconds * STRIDE_RATE);
    legL.rotation.x = 0.55 * swing;
    legR.rotation.x = -0.55 * swing;
    armL.rotation.x = -0.45 * swing;
    armR.rotation.x = 0.45 * swing;
    rig.hips.position.y =
      HIP_HEIGHT + 0.05 * Math.abs(Math.cos(seconds * STRIDE_RATE));
    return;
  }
  if (pose === "sit") {
    legL.rotation.x = -Math.PI / 2;
    legR.rotation.x = -Math.PI / 2;
    armL.rotation.x = -0.35;
    armR.rotation.x = -0.35;
    rig.hips.position.y = SEATED_HIP_HEIGHT;
    return;
  }
  // Working on the spot: holding a book, or reaching for the rack.
  const reach = room === "library" ? -1.0 : -0.6;
  const breath = 0.03 * Math.sin(seconds * 2);
  legL.rotation.x = 0;
  legR.rotation.x = 0;
  armL.rotation.x = reach + breath;
  armR.rotation.x = reach - breath;
  rig.hips.position.y = HIP_HEIGHT;
}
