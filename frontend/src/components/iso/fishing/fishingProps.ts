/**
 * Things standing about the reservoir fishing spot, built from the spot's
 * own solids: the fish of the catch; a fishing seat with its chair,
 * umbrella, rod rest, three rods and their floats; the floating huts, the
 * pontoon and its rails; the management office with its counter and bait
 * fridge; boards on legs, the rest platform, a tent and a rowing boat; the
 * shrimp net; cars, banners and the entrance sign; reeds, lily pads, trees,
 * hills and the dam's sluice house; ducks and a heron; a campfire. Each
 * faces +z with its origin on the ground at its centre. What lights up at
 * night (the floats' chemical lights, lamps, windows, the tent, the fire)
 * carries its own night lamp and glows, switched by lightForNight.
 */

import * as THREE from "three";
import { WATER_Y } from "@/constants/fishingPlan";
import type { Species } from "@/systems/fishingCatch";
import { textTexture } from "../isoTextures";
import { FISH } from "./fishingPalette";
import {
  box,
  cylinder,
  glowPool,
  glowSprite,
  material,
  nightLamp,
  nightOnly,
  sphere,
  strand,
} from "./fishingSolids";

const SPECIES_LOOK: Record<Species, { color: string; length: number }> = {
  crucian: { color: FISH.crucian, length: 0.8 },
  carp: { color: FISH.carp, length: 1.05 },
  mirror: { color: FISH.mirror, length: 1.2 },
  trophy: { color: FISH.trophy, length: 1.45 },
};

/** A fish of ``species``, nose to +x, its middle at the origin. */
export function fishModel(species: Species): THREE.Group {
  const { color, length } = SPECIES_LOOK[species];
  const g = new THREE.Group();
  const body = sphere(0.5, color, 0, 0, 0, [16, 12]);
  body.scale.set(1, 0.6, 0.32);
  g.add(body);
  const belly = sphere(0.42, FISH.belly, 0.04, -0.12, 0, [12, 8]);
  belly.scale.set(0.9, 0.35, 0.28);
  g.add(belly);
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.36, 4),
    material(color),
  );
  tail.rotation.z = -Math.PI / 2;
  tail.scale.z = 0.25;
  tail.position.x = -0.55;
  g.add(tail);
  const fin = box(0.34, 0.16, 0.03, color, -0.02, 0.24, 0);
  fin.rotation.z = -0.2;
  g.add(fin);
  for (const z of [-0.14, 0.14]) {
    g.add(sphere(0.045, FISH.eyes, 0.36, 0.06, z, [8, 6]));
  }
  g.scale.setScalar(length);
  return g;
}

/** A rounded tree, varied a little by ``seed``. */
export function tree(seed: number): THREE.Group {
  const g = new THREE.Group();
  const height = 1.6 + (seed % 3) * 0.3;
  g.add(cylinder(0.12, 0.16, height, FISH.trunk, 0, 0, 0, 8));
  const crown = seed % 2 === 0 ? FISH.leafA : FISH.leafB;
  g.add(sphere(0.9, crown, 0, height + 0.4, 0, [12, 10]));
  g.add(sphere(0.65, crown, 0.45, height + 0.1, 0.2, [10, 8]));
  return g;
}

/** A pine on the hills, ``height`` tall. */
export function pine(height: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(0.12, 0.16, height * 0.35, FISH.trunk, 0, 0, 0, 8));
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.95 - i * 0.22, height * 0.38, 10),
      material(FISH.pine),
    );
    cone.position.y = height * (0.42 + i * 0.2);
    cone.castShadow = true;
    g.add(cone);
  }
  return g;
}

/** A wooded hill: a low mound ``w`` wide, ``h`` high, ``d`` deep. */
export function hill(
  w: number,
  h: number,
  d: number,
  dark: boolean,
): THREE.Mesh {
  const mound = sphere(1, dark ? FISH.hillDark : FISH.hill, 0, 0, 0, [20, 12]);
  mound.scale.set(w / 2, h, d / 2);
  mound.receiveShadow = true;
  return mound;
}

/** A clump of reeds standing in the shallows, varied by ``seed``. */
export function reeds(seed: number): THREE.Group {
  const g = new THREE.Group();
  const stems = 6 + (seed % 3);
  for (let i = 0; i < stems; i++) {
    const angle = i * 2.4 + seed;
    const r = 0.15 + ((i * 37 + seed * 11) % 10) * 0.035;
    const h = 1.3 + ((i * 53 + seed * 7) % 10) * 0.07;
    const stem = cylinder(
      0.025,
      0.04,
      h,
      i % 3 === 0 ? FISH.reedGreen : FISH.reed,
      Math.cos(angle) * r,
      WATER_Y,
      Math.sin(angle) * r,
      5,
    );
    stem.rotation.set(Math.sin(angle) * 0.12, 0, Math.cos(angle) * 0.12);
    g.add(stem);
    if (i % 3 === 1) {
      const head = cylinder(
        0.06,
        0.06,
        0.26,
        FISH.reedHead,
        Math.cos(angle) * r,
        WATER_Y + h - 0.1,
        Math.sin(angle) * r,
        6,
      );
      g.add(head);
    }
  }
  return g;
}

/** A lily pad on the water, ``r`` across, with a flower now and then. */
export function lilyPad(r: number, flower: boolean): THREE.Group {
  const g = new THREE.Group();
  const pad = cylinder(
    r,
    r,
    0.03,
    flower ? FISH.lilyDark : FISH.lily,
    0,
    WATER_Y + 0.01,
    0,
    14,
  );
  pad.castShadow = false;
  g.add(pad);
  if (flower) {
    for (let i = 0; i < 5; i++) {
      const petal = sphere(0.12, FISH.lotus, 0, WATER_Y + 0.14, 0, [8, 6]);
      petal.scale.set(0.6, 1.2, 0.6);
      const a = (i / 5) * Math.PI * 2;
      petal.position.x = Math.cos(a) * 0.1;
      petal.position.z = Math.sin(a) * 0.1;
      petal.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      g.add(petal);
    }
  }
  return g;
}

/**
 * A float (찌) standing in the water: a white stem with an orange tip that
 * becomes a green chemical light at night, its glow and its reflection on
 * the water. The glow is kept in ``userData.glow`` to pulse.
 */
function float(): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(0.035, 0.035, 0.42, FISH.floatBody, 0, -0.18, 0, 6));
  g.add(
    cylinder(
      0.03,
      0.03,
      0.2,
      nightLamp(FISH.floatTip, FISH.chem),
      0,
      0.24,
      0,
      6,
    ),
  );
  const glow = glowSprite(FISH.chem, 0.9);
  glow.position.y = 0.36;
  g.add(glow);
  g.userData.glow = glow;
  const streak = glowPool(FISH.chem, 0.5, 0.45);
  streak.scale.set(0.35, 1.6, 1);
  streak.rotation.z = Math.PI / 4;
  streak.position.set(0.25, 0.01, 0.25);
  g.add(streak);
  return g;
}

/**
 * A fishing seat facing +z, rigged whether anyone sits in it or not: the
 * chair, a small umbrella on the side away from the camera, the rod rest
 * in front with three rods fanned out, each line down to a float on the
 * water, a keep net and a bait bowl. ``facing`` is the turn the seat will
 * get, to keep the umbrella behind the angler on screen. Returns the floats
 * so they can bob.
 */
export function fishingSeat(facing: number): {
  group: THREE.Group;
  floats: THREE.Object3D[];
} {
  const g = new THREE.Group();
  // The chair.
  g.add(box(0.7, 0.06, 0.6, FISH.chairFabric, 0, 0.42, 0));
  const back = box(0.7, 0.62, 0.05, FISH.chairFabric, 0, 0.46, -0.32);
  back.rotation.x = -0.15;
  g.add(back);
  for (const x of [-0.33, 0.33]) {
    for (const z of [-0.26, 0.26]) {
      g.add(box(0.04, 0.44, 0.04, FISH.chairFrame, x, 0, z));
    }
  }
  // The umbrella, on whichever side of the seat is further from the camera.
  const side = Math.cos(facing) - Math.sin(facing) >= 0 ? -1 : 1;
  const umbrella = new THREE.Group();
  umbrella.add(cylinder(0.03, 0.03, 2.1, FISH.steel, 0, 0, 0, 6));
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(1.05, 0.38, 10),
    material(FISH.umbrella),
  );
  canopy.position.y = 2.15;
  canopy.castShadow = true;
  umbrella.add(canopy);
  umbrella.add(cylinder(1.06, 1.06, 0.05, FISH.umbrellaTrim, 0, 1.94, 0, 10));
  umbrella.position.set(side * 0.95, 0, -0.15);
  umbrella.rotation.z = -side * 0.12;
  g.add(umbrella);
  // The rod rest in front.
  g.add(box(1.5, 0.05, 0.06, FISH.holder, 0, 0.36, 0.85));
  for (const x of [-0.65, 0.65]) {
    g.add(box(0.04, 0.38, 0.04, FISH.holder, x, 0, 0.85));
  }
  // Three rods fanned out over the water, each line down to its float.
  const floats: THREE.Object3D[] = [];
  const pitch = 0.2;
  const length = 3.4;
  for (const yaw of [-0.38, 0, 0.38]) {
    const butt = new THREE.Vector3(Math.sin(yaw) * 0.2, 0.3, 0.55);
    const reach = Math.cos(pitch) * length;
    const tip = new THREE.Vector3(
      butt.x + Math.sin(yaw) * reach,
      butt.y + Math.sin(pitch) * length,
      butt.z + Math.cos(yaw) * reach,
    );
    g.add(strand(butt, tip, 0.028, FISH.rod));
    const out = reach + 1.1;
    const at = new THREE.Vector3(
      butt.x + Math.sin(yaw) * out,
      WATER_Y,
      butt.z + Math.cos(yaw) * out,
    );
    g.add(strand(tip, at.clone().setY(WATER_Y + 0.3), 0.012, FISH.line));
    const bob = float();
    bob.position.copy(at);
    g.add(bob);
    floats.push(bob);
  }
  // The keep net in the water, and the bait bowl beside the chair.
  const net = cylinder(
    0.26,
    0.26,
    0.7,
    FISH.keepNet,
    0.85,
    WATER_Y - 0.45,
    1.05,
    10,
  );
  net.material = material(FISH.keepNet, { opacity: 0.6 });
  g.add(net);
  g.add(
    cylinder(0.3, 0.3, 0.04, FISH.netFrame, 0.85, WATER_Y + 0.22, 1.05, 12),
  );
  g.add(cylinder(0.2, 0.16, 0.16, FISH.bucket, -side * 0.55, 0, 0.35, 10));
  g.add(cylinder(0.17, 0.17, 0.02, FISH.bait, -side * 0.55, 0.15, 0.35, 10));
  return { group: g, floats };
}

/** A gable roof ``w`` along x over ``d`` along z, its eaves at the origin. */
function gableRoof(
  w: number,
  d: number,
  rise: number,
  color: string | THREE.Material,
): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0);
  shape.lineTo(d / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: w,
    bevelEnabled: false,
  });
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-w / 2, 0, 0);
  const mesh = new THREE.Mesh(
    geometry,
    typeof color === "string" ? material(color) : color,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Blue drums under a floating deck ``w`` by ``d``, along x. */
function drums(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  for (let z = -d / 2 + 0.6; z < d / 2; z += 1.4) {
    const drum = cylinder(0.32, 0.32, w - 0.4, FISH.drum, 0, -0.32, z, 12);
    drum.rotation.z = Math.PI / 2;
    drum.position.y = WATER_Y + 0.05;
    g.add(drum);
  }
  return g;
}

/** A wooden deck ``w`` by ``d`` with its top at y = 0. */
export function deck(
  w: number,
  d: number,
  planks: THREE.Material,
  floating: boolean,
): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), [
    material(FISH.post),
    material(FISH.post),
    planks,
    material(FISH.post),
    material(FISH.post),
    material(FISH.post),
  ]);
  top.position.y = -0.11;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);
  if (floating) g.add(drums(w, d));
  else {
    for (let x = -w / 2 + 0.6; x < w / 2; x += 2.5) {
      g.add(cylinder(0.1, 0.1, 1.4, FISH.post, x, -1.5, -d / 2 + 0.2, 8));
    }
  }
  return g;
}

/**
 * A floating hut (좌대) ``w`` by ``d``: its deck on drums, the cabin on the
 * back half with a door, a window and a gable roof, and its number. At
 * night the window glows and a lantern by the door lights the deck.
 */
export function floatingHut(
  w: number,
  d: number,
  cabinW: number,
  cabinD: number,
  cabinX: number,
  roof: string,
  number: string,
  planks: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  g.add(deck(w, d, planks, true));
  const cabin = new THREE.Group();
  cabin.position.set(cabinX, 0, -d / 2 + cabinD / 2);
  cabin.add(box(cabinW, 1.9, cabinD, FISH.cabinWall, 0, 0, 0));
  cabin.add(
    box(0.8, 1.5, 0.05, FISH.door, -cabinW / 2 + 0.8, 0, cabinD / 2 + 0.02, {
      shadow: false,
    }),
  );
  cabin.add(
    box(
      1.1,
      0.7,
      0.05,
      nightLamp(FISH.glass, FISH.warm, 0.85),
      cabinW / 2 - 1,
      0.9,
      cabinD / 2 + 0.02,
      { shadow: false },
    ),
  );
  // The lantern by the door, and the pool of light it throws on the deck.
  const lanternAt = new THREE.Vector3(
    -cabinW / 2 + 0.15,
    1.55,
    cabinD / 2 + 0.2,
  );
  cabin.add(
    box(
      0.16,
      0.22,
      0.16,
      nightLamp(FISH.lampOff, FISH.lampWarm),
      lanternAt.x,
      lanternAt.y,
      lanternAt.z,
      { shadow: false },
    ),
  );
  const lantern = glowSprite(FISH.lampWarm, 1.8, 0.85);
  lantern.position.set(lanternAt.x, lanternAt.y + 0.1, lanternAt.z);
  cabin.add(lantern);
  const porch = glowPool(FISH.lampWarm, 2.6, 0.2);
  porch.position.set(0, 0.03, cabinD / 2 + 1.2);
  cabin.add(porch);
  const top = gableRoof(cabinW + 0.5, cabinD + 0.6, 0.9, roof);
  top.position.y = 1.9;
  cabin.add(top);
  const plate = signPlate(number, 0.34, "#ffffff", roof);
  plate.position.set(0.3, 1.65, cabinD / 2 + 0.03);
  cabin.add(plate);
  g.add(cabin);
  return g;
}

/** A rail ``length`` long along x: posts and a top bar. */
export function rail(length: number): THREE.Group {
  const g = new THREE.Group();
  const posts = Math.max(2, Math.round(length / 2) + 1);
  for (let i = 0; i < posts; i++) {
    const x = -length / 2 + (i * length) / (posts - 1);
    g.add(box(0.07, 0.85, 0.07, FISH.rail, x, 0, 0));
  }
  g.add(box(length, 0.07, 0.09, FISH.rail, 0, 0.82, 0));
  return g;
}

/** A board on two legs, its face ``width`` wide, drawn from a canvas. */
export function standingBoard(
  width: number,
  height: number,
  rim: string,
): {
  group: THREE.Group;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
} {
  const g = new THREE.Group();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = Math.round((512 * height) / width);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const bottom = 0.8;
  for (const x of [-width / 2 + 0.25, width / 2 - 0.25]) {
    g.add(box(0.12, bottom + height, 0.12, FISH.steel, x, 0, -0.05));
  }
  g.add(box(width + 0.2, height + 0.2, 0.08, rim, 0, bottom - 0.1, 0));
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  face.position.set(0, bottom + height / 2, 0.05);
  g.add(face);
  return { group: g, canvas, texture };
}

/** A sign's text on a coloured plate, ``height`` tall, facing +z. */
export function signPlate(
  text: string,
  height: number,
  color: string,
  background: string,
): THREE.Mesh {
  const label = textTexture(text, { color, weight: 800, background });
  return new THREE.Mesh(
    new THREE.PlaneGeometry(height * label.aspect, height),
    new THREE.MeshBasicMaterial({ map: label.texture, transparent: true }),
  );
}

/**
 * The management office, ``w`` wide and ``d`` deep: white walls and a
 * blue gable roof, the door, the shop counter with its awning and the
 * catch board's place on the front, its name over all, and the bait
 * fridge against its east wall. Returns the board drawn into.
 */
export function office(
  w: number,
  d: number,
): {
  group: THREE.Group;
  catchBoard: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture };
} {
  const g = new THREE.Group();
  const h = 2.9;
  g.add(box(w, h, d, FISH.officeWall, 0, 0, 0));
  const roof = gableRoof(w + 0.8, d + 0.8, 1.3, FISH.officeRoof);
  roof.position.y = h;
  g.add(roof);
  const front = d / 2 + 0.02;
  g.add(box(1.1, 2.1, 0.06, FISH.door, 0, 0.02, front, { shadow: false }));
  // The shop counter: a window, a ledge and a striped awning.
  g.add(
    box(
      3.4,
      1.1,
      0.06,
      nightLamp(FISH.glass, FISH.warm, 0.9),
      3.5,
      0.95,
      front,
      {
        shadow: false,
      },
    ),
  );
  const counterGlow = glowSprite(FISH.warm, 3.2, 0.55);
  counterGlow.position.set(3.5, 1.5, front + 0.3);
  g.add(counterGlow);
  const counterPool = glowPool(FISH.warm, 3.6, 0.22);
  counterPool.position.set(2.5, 0.03, front + 1.8);
  g.add(counterPool);
  g.add(box(3.6, 0.1, 0.45, FISH.table, 3.5, 0.9, front + 0.2));
  for (let i = 0; i < 8; i++) {
    const stripe = box(
      0.47,
      0.06,
      0.9,
      i % 2 === 0 ? FISH.signRed : FISH.paint,
      3.5 - 1.75 + (i + 0.5) * 0.4375,
      2.2,
      front + 0.42,
    );
    stripe.rotation.x = 0.32;
    g.add(stripe);
  }
  const shop = signPlate("매점 · 미끼 · 라면", 0.36, "#ffffff", FISH.signRed);
  shop.position.set(3.5, 2.62, front + 0.01);
  g.add(shop);
  const name = signPlate(
    "저수지 낚시터 관리소",
    0.56,
    "#ffffff",
    FISH.signBlue,
  );
  name.position.set(-1.2, h + 0.62, d / 2 + 0.45);
  g.add(name);
  // The catch board on the wall left of the door.
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 288;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  g.add(box(4.1, 2.35, 0.08, FISH.signBlue, -w / 2 + 2.5, 0.75, front));
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(3.9, 2.19),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  board.position.set(-w / 2 + 2.5, 0.75 + 1.175, front + 0.05);
  g.add(board);
  // The bait fridge against the east wall, its glass door facing +x.
  const fridge = new THREE.Group();
  fridge.add(box(0.6, 1.8, 1.2, FISH.fridge, 0, 0, 0));
  fridge.add(
    box(
      0.04,
      1.3,
      0.95,
      nightLamp(FISH.glass, FISH.fridgeLight, 0.8),
      0.31,
      0.3,
      0,
      {
        shadow: false,
      },
    ),
  );
  const fridgeGlow = glowSprite(FISH.fridgeLight, 1.6, 0.4);
  fridgeGlow.position.set(0.5, 1, 0);
  fridge.add(fridgeGlow);
  const label = signPlate("미끼", 0.28, "#ffffff", FISH.signBlue);
  label.rotation.y = Math.PI / 2;
  label.position.set(0.33, 1.6, 0);
  fridge.add(label);
  fridge.position.set(w / 2 + 0.32, 0, 0.6);
  g.add(fridge);
  return { group: g, catchBoard: { canvas, texture } };
}

/** The rest platform (평상): a low wooden deck on legs, a tray of noodles on it. */
export function restDeck(
  w: number,
  d: number,
  planks: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), [
    material(FISH.post),
    material(FISH.post),
    planks,
    material(FISH.post),
    material(FISH.post),
    material(FISH.post),
  ]);
  top.position.y = 0.39;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);
  for (const x of [-w / 2 + 0.2, 0, w / 2 - 0.2]) {
    for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) {
      g.add(box(0.12, 0.33, 0.12, FISH.post, x, 0, z));
    }
  }
  // A low table at the back with cup noodles and a kettle.
  g.add(box(1.8, 0.06, 0.8, FISH.table, 0, 0.72, -d / 2 + 0.7));
  for (const x of [-0.8, 0.8]) {
    g.add(box(0.06, 0.27, 0.6, FISH.post, x, 0.45, -d / 2 + 0.7));
  }
  for (const x of [-0.5, -0.1, 0.3]) {
    g.add(
      cylinder(0.12, 0.1, 0.22, FISH.noodleCup, x, 0.78, -d / 2 + 0.75, 10),
    );
    g.add(
      cylinder(0.125, 0.12, 0.06, FISH.noodleBand, x, 0.92, -d / 2 + 0.75, 10),
    );
  }
  g.add(cylinder(0.18, 0.22, 0.3, FISH.steel, 0.7, 0.78, -d / 2 + 0.7, 12));
  return g;
}

/** A ridge tent, its door facing +z, lit from inside at night. */
export function tent(): THREE.Group {
  const g = new THREE.Group();
  const body = gableRoof(2.4, 3, 1.7, nightLamp(FISH.tentA, "#ffbf5a", 0.5));
  body.rotation.y = Math.PI / 2;
  g.add(body);
  const fly = gableRoof(2.5, 3.2, 1.75, nightLamp(FISH.tentB, "#ff8a4a", 0.45));
  fly.rotation.y = Math.PI / 2;
  fly.scale.set(0.35, 1, 1);
  g.add(fly);
  const door = gableRoof(0.06, 1.3, 1.1, FISH.darkHair);
  door.rotation.y = Math.PI / 2;
  door.position.z = 1.22;
  g.add(door);
  return g;
}

/** The office's rowing boat, ``length`` along x, with its oars. */
export function rowBoat(length: number, beam: number): THREE.Group {
  const g = new THREE.Group();
  const hull = box(length, 0.5, beam, FISH.boatHull, 0, 0, 0);
  g.add(hull);
  const bow = new THREE.Mesh(
    new THREE.ConeGeometry(beam / 2, 0.9, 4),
    material(FISH.boatHull),
  );
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.x = Math.PI / 4;
  bow.scale.set(1, 1, 0.5);
  bow.position.set(length / 2 + 0.4, 0.25, 0);
  g.add(bow);
  g.add(box(length - 0.3, 0.06, beam - 0.3, FISH.boatInside, 0, 0.4, 0));
  g.add(box(0.3, 0.06, beam - 0.2, FISH.plankA, -0.4, 0.45, 0));
  for (const z of [-1, 1]) {
    const oar = box(2.2, 0.05, 0.1, FISH.plankA, -0.2, 0.55, z * 0.55);
    oar.rotation.y = z * 0.25;
    g.add(oar);
  }
  return g;
}

/** The shrimp net off the pontoon's end: a mesh drum half in the water and its buoy. */
export function shrimpNet(): THREE.Group {
  const g = new THREE.Group();
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 1.1, 12),
    material(FISH.netFrame, { opacity: 0.55 }),
  );
  drum.rotation.z = Math.PI / 2;
  drum.position.y = WATER_Y - 0.1;
  g.add(drum);
  for (const x of [-0.55, 0.55]) {
    const ring = cylinder(
      0.52,
      0.52,
      0.05,
      FISH.netFrame,
      x,
      WATER_Y - 0.1,
      0,
      12,
    );
    ring.rotation.z = Math.PI / 2;
    ring.position.set(x, WATER_Y - 0.1, 0);
    g.add(ring);
  }
  g.add(sphere(0.22, FISH.buoy, 0.9, WATER_Y + 0.12, 0.5, [10, 8]));
  return g;
}

/** A parked car, nose to +x. */
export function car(color: string): THREE.Group {
  const g = new THREE.Group();
  g.add(box(3.6, 0.8, 1.7, color, 0, 0.3, 0));
  g.add(box(2, 0.7, 1.55, color, -0.2, 1.1, 0));
  g.add(box(2.02, 0.45, 1.57, FISH.carGlass, -0.2, 1.2, 0, { shadow: false }));
  for (const x of [-1.15, 1.15]) {
    for (const z of [-0.8, 0.8]) {
      const wheel = cylinder(0.32, 0.32, 0.22, FISH.shoes, x, 0, z, 12);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.32, z);
      g.add(wheel);
    }
  }
  return g;
}

/** A tall banner (깃발) on its pole, ``text`` written down it. */
export function banner(text: string, color: string): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(0.05, 0.05, 4, FISH.steel, 0, 0, 0, 6));
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font =
      '900 64px "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    [...text].forEach((ch, i, all) => {
      ctx.fillText(
        ch,
        canvas.width / 2,
        ((i + 0.5) * canvas.height) / all.length,
      );
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 2),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
  cloth.position.set(0.33, 2.85, 0);
  g.add(cloth);
  return g;
}

/** The entrance: two posts and the spot's name board between them. */
export function entranceSign(width: number): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-width / 2, width / 2]) {
    g.add(box(0.25, 2.9, 0.25, FISH.post, x, 0, 0));
  }
  g.add(box(width + 0.4, 0.75, 0.15, FISH.plankB, 0, 2.3, 0));
  const name = signPlate(
    "저수지 낚시터 · RESERVOIR",
    0.5,
    "#ffffff",
    FISH.signBlue,
  );
  name.position.set(0, 2.68, 0.09);
  g.add(name);
  return g;
}

/** The sluice house on the dam: a small concrete hut, its lamp lit at night. */
export function sluiceHouse(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.6, 1.8, 2.2, FISH.concrete, 0, 0, 0));
  const roof = gableRoof(3, 2.6, 0.6, FISH.roofBlue);
  roof.position.y = 1.8;
  g.add(roof);
  g.add(box(0.9, 1.3, 0.05, FISH.steel, -1.31, 0, 0, { shadow: false }));
  g.add(
    box(
      0.14,
      0.18,
      0.14,
      nightLamp(FISH.lampOff, FISH.lampWarm),
      -1.38,
      1.45,
      0.7,
      { shadow: false },
    ),
  );
  const glow = glowSprite(FISH.lampWarm, 1.6, 0.8);
  glow.position.set(-1.45, 1.55, 0.7);
  g.add(glow);
  const pool = glowPool(FISH.lampWarm, 2.4, 0.2);
  pool.position.set(-2.2, 0.03, 0.7);
  g.add(pool);
  return g;
}

/** A duck afloat, beak to +x, its origin at the waterline. */
export function duck(): THREE.Group {
  const g = new THREE.Group();
  const body = sphere(0.32, FISH.duck, 0, 0.12, 0, [12, 8]);
  body.scale.set(1.3, 0.75, 0.9);
  g.add(body);
  g.add(sphere(0.17, FISH.duckHead, 0.32, 0.42, 0, [10, 8]));
  const beak = box(0.16, 0.05, 0.1, FISH.beak, 0.5, 0.4, 0);
  g.add(beak);
  return g;
}

/** A grey heron standing in the shallows, beak to +x; ``head`` nods. */
export function heron(): { group: THREE.Group; head: THREE.Group } {
  const g = new THREE.Group();
  for (const z of [-0.08, 0.08]) {
    g.add(cylinder(0.025, 0.025, 1.1, FISH.heronDark, 0, WATER_Y - 0.2, z, 5));
  }
  const body = sphere(0.3, FISH.heron, 0, 1.05, 0, [12, 8]);
  body.scale.set(1.35, 0.75, 0.8);
  g.add(body);
  g.add(box(0.4, 0.06, 0.3, FISH.heronDark, -0.35, 1.1, 0));
  const neck = cylinder(0.06, 0.07, 0.6, FISH.heron, 0.32, 1.1, 0, 6);
  neck.rotation.z = -0.35;
  g.add(neck);
  const head = new THREE.Group();
  head.position.set(0.5, 1.68, 0);
  head.add(sphere(0.1, FISH.heron, 0, 0, 0, [8, 6]));
  head.add(box(0.3, 0.04, 0.04, FISH.beak, 0.2, -0.02, 0));
  head.add(box(0.18, 0.03, 0.02, FISH.heronDark, -0.1, 0.05, 0));
  g.add(head);
  return { group: g, head };
}

/** A lamp post by the deck: dark by day, a warm light and its pool at night. */
export function lampPost(): THREE.Group {
  const g = new THREE.Group();
  g.add(cylinder(0.05, 0.07, 2.6, FISH.chairFrame, 0, 0, 0, 6));
  g.add(
    sphere(0.16, nightLamp(FISH.lampOff, FISH.lampWarm), 0, 2.7, 0, [10, 8]),
  );
  const glow = glowSprite(FISH.lampWarm, 2.6, 0.9);
  glow.position.y = 2.7;
  g.add(glow);
  const pool = glowPool(FISH.lampWarm, 3.4, 0.24);
  pool.position.y = 0.04;
  g.add(pool);
  return g;
}

/**
 * A campfire ringed with stones: logs by day, flames, a glow and a warm
 * pool on the ground at night. Returns the flames to flicker.
 */
export function campfire(): {
  group: THREE.Group;
  flames: THREE.Mesh[];
  glow: THREE.Sprite;
  pool: THREE.Mesh;
} {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = sphere(
      0.16,
      FISH.stone,
      Math.cos(a) * 0.55,
      0.06,
      Math.sin(a) * 0.55,
      [8, 6],
    );
    stone.scale.y = 0.6;
    g.add(stone);
  }
  for (const turn of [0.5, -0.5]) {
    const log = cylinder(0.07, 0.07, 0.9, FISH.log, 0, 0.1, 0, 6);
    log.rotation.set(Math.PI / 2, turn, 0);
    log.position.y = 0.12;
    g.add(log);
  }
  const flames: THREE.Mesh[] = [];
  for (const [x, z, h, core] of [
    [0, 0, 0.75, false],
    [0.14, 0.08, 0.5, true],
    [-0.12, -0.06, 0.55, false],
  ] as const) {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, h, 8),
      nightLamp(FISH.log, core ? FISH.fireCore : FISH.fire),
    );
    flame.position.set(x, 0.15 + h / 2, z);
    flames.push(nightOnly(flame));
    g.add(flame);
  }
  const glow = glowSprite(FISH.fire, 3.2, 0.8);
  glow.position.y = 0.6;
  g.add(glow);
  const pool = glowPool(FISH.fire, 4.2, 0.3);
  pool.position.y = 0.04;
  g.add(pool);
  return { group: g, flames, glow, pool };
}
