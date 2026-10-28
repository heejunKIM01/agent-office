/**
 * Assemble the isometric reservoir fishing spot from its plan
 * (constants/fishingPlan.ts) in the office's style: grassy banks round the
 * green water, wooded hills along the back and the dam down the right;
 * the fishing deck with its numbered seats along the front bank, every
 * seat rigged with an umbrella, three rods and their floats; the pontoon
 * out to the two floating huts, the shrimp net off its end and the
 * office's rowing boat; the management office with its shop counter,
 * catch board and fish tank; the chalkboard, the rest platform and a tent;
 * reeds and lily pads, ducks and a heron; banners, the entrance and the
 * car park. For the night: bulbs along the pontoon, the campfire, the moon
 * and its glade on the water, fireflies over the shallows and mist on the
 * water, all shown only at night. Only the spot's own parts: nothing of the
 * other places'. Returns the pieces the scene moves or draws into.
 */

import * as THREE from "three";
import {
  BANK_FRONT,
  BANK_WEST,
  BOAT,
  CAMPFIRE,
  CABIN_A,
  CABIN_B,
  CHALKBOARD,
  DECK,
  EMBANKMENT,
  ENTRANCE,
  FISHING_DEPTH,
  FISHING_WIDTH,
  GUEST_SPOT,
  HILLS,
  HUT_A,
  HUT_B,
  NET,
  OFFICE,
  PARKING,
  PONTOON,
  PONTOON_END,
  REST_DECK,
  TENT,
  WATER,
  WATER_Y,
  WORK_SPOTS,
  type FishingRect,
} from "@/constants/fishingPlan";
import {
  plankTexture,
  softShadowTexture,
  textTexture,
  tileTexture,
} from "../isoTextures";
import { FISH } from "./fishingPalette";
import {
  banner,
  campfire,
  car,
  deck,
  duck,
  entranceSign,
  fishingSeat,
  floatingHut,
  heron,
  hill,
  lampPost,
  lilyPad,
  office,
  pine,
  rail,
  reeds,
  restDeck,
  rowBoat,
  shrimpNet,
  signPlate,
  sluiceHouse,
  standingBoard,
  tent,
  tree,
} from "./fishingProps";
import {
  box,
  glowPool,
  glowSprite,
  glowTexture,
  material,
  nightLamp,
  nightOnly,
  sphere,
} from "./fishingSolids";
import { FishTank } from "./fishingTank";

/** How deep the plate goes under the banks. */
export const PLATE_THICKNESS = 1.6;
const SIGN_Y = 0.03;

/** A duck paddling round its loop on the water. */
export interface Duck {
  model: THREE.Group;
  x: number;
  z: number;
  rx: number;
  rz: number;
  speed: number;
  phase: number;
}

/** A firefly drifting about its home, blinking. */
export interface Firefly {
  light: THREE.Group;
  glow: THREE.Sprite;
  x: number;
  y: number;
  z: number;
  phase: number;
}

/** What moves at night: the fire, the moon's glade, the fireflies, the mist. */
export interface NightScene {
  flames: THREE.Mesh[];
  fireGlow: THREE.Sprite;
  firePool: THREE.Mesh;
  glade: THREE.Mesh[];
  stars: THREE.Sprite[];
  fireflies: Firefly[];
  mist: THREE.Mesh[];
}

export interface FishingScene {
  root: THREE.Group;
  tank: FishTank;
  /** The chalkboard of to-dos and the catch board, drawn into. */
  chalkboard: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture };
  catchBoard: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture };
  /** Every float on the water, to bob. */
  floats: THREE.Object3D[];
  ducks: Duck[];
  heronHead: THREE.Group;
  night: NightScene;
}

function place(
  piece: THREE.Object3D,
  x: number,
  z: number,
  rot = 0,
  y = 0,
): THREE.Object3D {
  piece.position.set(x, y, z);
  piece.rotation.y = rot;
  return piece;
}

const centre = (r: FishingRect): [number, number] => [
  r.x + r.w / 2,
  r.z + r.d / 2,
];

/** A sign painted on the ground, reading along x, ``height`` tall. */
function floorSign(
  text: string,
  height: number,
  x: number,
  z: number,
): THREE.Mesh {
  const label = textTexture(text, { color: FISH.labelText, weight: 700 });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(height * label.aspect, height),
    new THREE.MeshBasicMaterial({
      map: label.texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, SIGN_Y, z);
  return mesh;
}

/** A slab of the plate over ``rect``, from the bottom up to ``top``. */
function slab(
  rect: FishingRect,
  top: number,
  topMaterial: THREE.Material,
  side: THREE.Material,
): THREE.Mesh {
  const h = top + PLATE_THICKNESS;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(rect.w, h, rect.d), [
    side,
    side,
    topMaterial,
    side,
    side,
    side,
  ]);
  const [cx, cz] = centre(rect);
  mesh.position.set(cx, top - h / 2, cz);
  mesh.receiveShadow = true;
  return mesh;
}

function tiled(
  a: string,
  b: string,
  line: string,
  rect: FishingRect,
  size: number,
  tiles = 2,
): THREE.MeshLambertMaterial {
  const texture = tileTexture(a, b, line, tiles);
  texture.repeat.set(rect.w / size, rect.d / size);
  return new THREE.MeshLambertMaterial({ map: texture });
}

/** The banks, the water, the hills along the back and the dam down the right. */
function ground(): THREE.Group {
  const g = new THREE.Group();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(FISHING_WIDTH + 10, FISHING_DEPTH + 10),
    new THREE.MeshBasicMaterial({
      map: softShadowTexture(),
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(
    FISHING_WIDTH / 2 + 0.6,
    -PLATE_THICKNESS - 1.7,
    FISHING_DEPTH / 2 + 0.6,
  );
  g.add(shadow);
  const bankSide = material(FISH.bankSide, { emissive: FISH.bankGlow });
  for (const rect of [BANK_WEST, BANK_FRONT, HILLS]) {
    g.add(
      slab(
        rect,
        0,
        tiled(FISH.grassA, FISH.grassB, FISH.grassLine, rect, 6),
        bankSide,
      ),
    );
  }
  g.add(
    slab(
      EMBANKMENT,
      0.6,
      tiled(FISH.concrete, FISH.concrete, FISH.concreteDark, EMBANKMENT, 3),
      material(FISH.concreteDark),
    ),
  );
  g.add(
    slab(
      WATER,
      WATER_Y,
      tiled(FISH.waterA, FISH.waterB, FISH.waterLine, WATER, 8, 4),
      material(FISH.waterSide, { emissive: FISH.waterGlow }),
    ),
  );
  // An earth edge where the left bank and the hills meet the water.
  const edge = material(FISH.earth);
  g.add(
    box(0.5, 0.06, WATER.d, edge, WATER.x + 0.25, 0, WATER.z + WATER.d / 2, {
      shadow: false,
    }),
  );
  g.add(
    box(WATER.w, 0.06, 0.5, edge, WATER.x + WATER.w / 2, 0, WATER.z + 0.25, {
      shadow: false,
    }),
  );
  // Gravel paths: up from the entrance, along the bank, past the office.
  const gravel = (rect: FishingRect): THREE.Mesh => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(rect.w, rect.d),
      tiled(FISH.gravelA, FISH.gravelB, FISH.gravelLine, rect, 4, 4),
    );
    mesh.rotation.x = -Math.PI / 2;
    const [cx, cz] = centre(rect);
    mesh.position.set(cx, 0.012, cz);
    mesh.receiveShadow = true;
    return mesh;
  };
  g.add(
    gravel({ x: ENTRANCE.x - 1.6, z: 35.6, w: 3.2, d: FISHING_DEPTH - 35.6 }),
  );
  g.add(gravel({ x: 12, z: 33.2, w: 34, d: 2.6 }));
  g.add(gravel({ x: 2, z: 42.4, w: 22, d: 2.6 }));
  g.add(gravel(PARKING));
  // The dam: a sloped concrete face down to the water, its rail and the
  // sluice house.
  const slope = box(2.4, 0.12, EMBANKMENT.d, FISH.concrete, 0, 0, 0);
  slope.rotation.z = -0.5;
  slope.position.set(
    EMBANKMENT.x + 0.5,
    -0.05,
    EMBANKMENT.z + EMBANKMENT.d / 2,
  );
  g.add(slope);
  const damRail = rail(EMBANKMENT.d);
  damRail.rotation.y = Math.PI / 2;
  damRail.position.set(
    EMBANKMENT.x + 1.6,
    0.6,
    EMBANKMENT.z + EMBANKMENT.d / 2,
  );
  g.add(damRail);
  g.add(place(sluiceHouse(), EMBANKMENT.x + 3.6, 17, 0, 0.6));
  // The hills along the back, wooded with pines.
  let seed = 0;
  for (const [hx, w, h] of [
    [4, 12, 3.2],
    [14, 10, 2.4],
    [24, 14, 3.6],
    [36, 11, 2.8],
    [47, 13, 3.4],
    [58, 12, 2.6],
  ]) {
    g.add(place(hill(w, h, 6, seed % 2 === 0), hx, 1.6));
    for (let i = 0; i < 3; i++) {
      const px = hx - w / 3 + (i * w) / 3 + ((seed * 7) % 3) * 0.4;
      const tall = 2.2 + ((seed + i) % 3) * 0.5;
      g.add(place(pine(tall), px, 1.2 + (i % 2) * 1.4, 0, h * 0.55));
    }
    seed++;
  }
  return g;
}

/** Reeds along the shores and lily pads in the left shallows. */
function shoreLife(): THREE.Group {
  const g = new THREE.Group();
  let seed = 0;
  const clump = (x: number, z: number): void => {
    g.add(place(reeds(seed++), x, z));
  };
  for (let z = 5.5; z < 31; z += 2.3) clump(12.7 + (seed % 2) * 0.5, z);
  for (let x = 14; x < 57; x += 2.8) {
    if (x > 39 && x < 45) continue;
    clump(x, 4.8 + (seed % 2) * 0.5);
  }
  for (let z = 6; z < 31; z += 2.6) clump(57.2 - (seed % 2) * 0.5, z);
  for (let x = 49; x < 57; x += 2.2) clump(x, 32.4);
  for (const [x, z, r, flower] of [
    [15, 8, 0.6, false],
    [16.6, 9.5, 0.5, true],
    [14.4, 11.2, 0.7, false],
    [17.8, 7, 0.45, false],
    [19, 10.4, 0.55, true],
    [15.8, 13.4, 0.6, false],
    [18.2, 12.6, 0.5, false],
    [20.6, 8.6, 0.5, false],
    [14.6, 16, 0.55, true],
    [17, 15.4, 0.45, false],
    [21.4, 12.2, 0.6, false],
    [19.6, 15.8, 0.5, false],
  ] as const) {
    g.add(place(lilyPad(r, flower), x, z));
  }
  return g;
}

/** The deck along the front bank and its rigged, numbered seats. */
function fishingDeck(
  planks: THREE.Material,
  floats: THREE.Object3D[],
): THREE.Group {
  const g = new THREE.Group();
  const [dx, dz] = centre(DECK);
  g.add(place(deck(DECK.w, DECK.d, planks, false), dx, dz));
  WORK_SPOTS.seats.forEach((spot, i) => {
    const seat = fishingSeat(spot.facing);
    g.add(place(seat.group, spot.x, spot.z, spot.facing));
    floats.push(...seat.floats);
    if (spot.z > DECK.z) {
      // The seat's number on a post behind it.
      const number = signPlate(String(i + 1), 0.3, "#ffffff", FISH.signBlue);
      number.position.set(spot.x + 1.3, 0.55, spot.z + 0.85);
      g.add(number);
      g.add(box(0.06, 0.4, 0.06, FISH.post, spot.x + 1.3, 0, spot.z + 0.8));
    }
  });
  for (const x of [18, 26, 34]) g.add(place(lampPost(), x, 33.9));
  return g;
}

/** The pontoon, its rails, the two huts and my seat, the shrimp net and the boat. */
function pontoonAndHuts(
  planks: THREE.Material,
  floats: THREE.Object3D[],
): THREE.Group {
  const g = new THREE.Group();
  for (const rect of [PONTOON, PONTOON_END]) {
    const [cx, cz] = centre(rect);
    g.add(place(deck(rect.w, rect.d, planks, true), cx, cz));
  }
  // Rails down both sides, open where the huts join.
  const sideRail = (x: number, from: number, to: number): void => {
    const piece = rail(to - from);
    piece.rotation.y = Math.PI / 2;
    piece.position.set(x, 0, (from + to) / 2);
    g.add(piece);
  };
  sideRail(PONTOON.x + 0.05, 20.4, 33);
  sideRail(PONTOON.x + 0.05, 13.2, 14.8);
  sideRail(PONTOON.x + PONTOON.w - 0.05, 27.4, 33);
  sideRail(PONTOON.x + PONTOON.w - 0.05, 13.2, 21.6);
  for (const [hut, cabin, roof, name] of [
    [HUT_A, CABIN_A, FISH.roofOrange, "좌대 1"],
    [HUT_B, CABIN_B, FISH.roofBlue, "좌대 2"],
  ] as const) {
    const [cx, cz] = centre(hut);
    const cabinX = cabin.x + cabin.w / 2 - cx;
    g.add(
      place(
        floatingHut(hut.w, hut.d, cabin.w, cabin.d, cabinX, roof, name, planks),
        cx,
        cz,
      ),
    );
  }
  const mine = fishingSeat(GUEST_SPOT.facing);
  g.add(place(mine.group, GUEST_SPOT.x, GUEST_SPOT.z, GUEST_SPOT.facing));
  floats.push(...mine.floats);
  // Bulbs on the rails, lit at night.
  const bulb = (x: number, z: number): void => {
    g.add(
      sphere(0.07, nightLamp(FISH.lampOff, FISH.lampWarm), x, 0.98, z, [8, 6]),
    );
    const glow = glowSprite(FISH.lampWarm, 0.8, 0.85);
    glow.position.set(x, 0.98, z);
    g.add(glow);
  };
  for (const z of [14, 16.4, 18.8, 21.2, 29, 31.6]) {
    bulb(PONTOON.x + PONTOON.w - 0.05, z);
  }
  for (const z of [22, 24.4, 26.8, 29.2, 31.6]) bulb(PONTOON.x + 0.05, z);
  g.add(place(shrimpNet(), NET.x, NET.z));
  g.add(
    place(rowBoat(BOAT.length, BOAT.beam), BOAT.x, BOAT.z, 0, WATER_Y - 0.15),
  );
  return g;
}

/** The office, its tank, the chalkboard, the rest platform and the tent. */
function bankside(): {
  group: THREE.Group;
  tank: FishTank;
  chalkboard: FishingScene["chalkboard"];
  catchBoard: FishingScene["catchBoard"];
  planks: THREE.Material;
} {
  const g = new THREE.Group();
  const planks = new THREE.MeshLambertMaterial({
    map: plankTexture(FISH.plankA, FISH.plankB),
  });
  const [ox, oz] = centre(OFFICE);
  const building = office(OFFICE.w, OFFICE.d);
  g.add(place(building.group, ox, oz));
  const tank = new FishTank();
  g.add(tank.root);
  const board = standingBoard(CHALKBOARD.width, 2.4, FISH.boardRim);
  g.add(place(board.group, CHALKBOARD.x, CHALKBOARD.z));
  const [rx, rz] = centre(REST_DECK);
  g.add(place(restDeck(REST_DECK.w, REST_DECK.d, planks), rx, rz));
  g.add(place(tent(), TENT.x, TENT.z));
  g.add(floorSign("휴게 · REST", 0.55, rx, REST_DECK.z + REST_DECK.d + 1.4));
  return {
    group: g,
    tank,
    chalkboard: { canvas: board.canvas, texture: board.texture },
    catchBoard: building.catchBoard,
    planks,
  };
}

/** The entrance, banners, the car park and its cars, and trees. */
function frontArea(): THREE.Group {
  const g = new THREE.Group();
  g.add(place(entranceSign(ENTRANCE.width), ENTRANCE.x, FISHING_DEPTH - 0.4));
  for (const [text, color, x, z] of [
    ["낚시터", FISH.bannerRed, ENTRANCE.x - 4.2, FISHING_DEPTH - 1],
    ["월척", FISH.bannerBlue, ENTRANCE.x + 4.2, FISHING_DEPTH - 1],
    ["붕어", FISH.bannerRed, 38.5, 35.4],
    ["좌대", FISH.bannerBlue, 45.5, 35.4],
  ] as const) {
    g.add(place(banner(text, color), x, z));
  }
  const { x, z, w, d } = PARKING;
  for (let lx = x; lx <= x + w + 0.01; lx += w / 4) {
    g.add(
      box(0.12, 0.01, d, FISH.paint, lx, 0.014, z + d / 2, { shadow: false }),
    );
  }
  g.add(place(car(FISH.carA), x + 1.5, z + 3.8, Math.PI / 2));
  g.add(place(car(FISH.carB), x + 7.5, z + 4.2, Math.PI / 2));
  g.add(floorSign("주차장 · PARKING", 0.6, x + w / 2, z + d + 0.9));
  let seed = 0;
  for (const [tx, tz] of [
    [2, 8],
    [5.5, 6],
    [9.5, 8.5],
    [1.6, 14],
    [9.8, 13.5],
    [1.0, 35.5],
    [10.5, 30.5],
    [24, 47.8],
    [40, 47],
    [60.5, 44.5],
    [62, 37],
    [17, 47.6],
    [2, 48],
  ]) {
    g.add(place(tree(seed++), tx, tz));
  }
  return g;
}

/** Two ducks paddling round, and the heron in the shallows. */
function birds(): {
  group: THREE.Group;
  ducks: Duck[];
  heronHead: THREE.Group;
} {
  const g = new THREE.Group();
  const ducks: Duck[] = [
    { x: 26, z: 16, rx: 5, rz: 3, speed: 0.12, phase: 0 },
    { x: 51, z: 13, rx: 3.5, rz: 3, speed: -0.1, phase: 2 },
  ].map((loop) => {
    const model = duck();
    g.add(model);
    return { model, ...loop };
  });
  const bird = heron();
  g.add(place(bird.group, 13.6, 20.5, -0.4));
  return { group: g, ducks, heronHead: bird.head };
}

/** Where the moon hangs, over the hills at the back. */
const MOON = new THREE.Vector3(10, 9, -4);

/**
 * The night: the campfire, the moon with its halo and its glade on the
 * water, stars over the hills, fireflies over the shallows and by the tent,
 * and mist on the water.
 */
function nightSky(): { group: THREE.Group; night: NightScene } {
  const g = new THREE.Group();
  const fire = campfire();
  g.add(place(fire.group, CAMPFIRE.x, CAMPFIRE.z));
  const moonLight = new THREE.MeshBasicMaterial({ color: FISH.moon });
  moonLight.userData.glow = true;
  const moon = nightOnly(
    new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 16), moonLight),
  );
  moon.position.copy(MOON);
  g.add(moon);
  const halo = glowSprite(FISH.moon, 9, 0.35);
  halo.position.copy(MOON);
  g.add(halo);
  // The glade: streaks of moonlight on the water, from under the moon
  // towards the viewer, wider as they come.
  const glade: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const streak = glowPool(FISH.glade, 0.5, 0.45);
    streak.scale.set(2.6 + i * 0.45, 0.7, 1);
    // Lying across the line to the viewer: wide on screen, thin in depth.
    streak.rotation.z = Math.PI / 4;
    streak.position.set(18 + i * 1.05, WATER_Y + 0.02, 4.4 + i * 1.05);
    g.add(streak);
    glade.push(streak);
  }
  // Stars in the sky over the back edges.
  const stars: THREE.Sprite[] = [];
  for (let i = 0; i < 30; i++) {
    const along = (i * 37) % 30;
    const back = i % 2 === 0;
    const star = glowSprite("#ffffff", 0.35 + (i % 3) * 0.12, 0.7);
    star.position.set(
      back ? -6 + along * 2.6 : -5 - (i % 4),
      7 + ((i * 13) % 8),
      back ? -5 - (i % 4) : along * 1.9,
    );
    g.add(star);
    stars.push(star);
  }
  // Fireflies over the lily pads and the reeds, and by the tent.
  const fireflies: Firefly[] = [];
  for (let i = 0; i < 18; i++) {
    const nearTent = i % 3 === 2;
    const x = nearTent ? 2 + ((i * 37) % 9) : 13 + ((i * 53) % 9);
    const z = nearTent ? 17 + ((i * 29) % 12) : 5 + ((i * 31) % 15);
    const y = (nearTent ? 0.6 : WATER_Y + 0.5) + ((i * 7) % 5) * 0.2;
    const light = new THREE.Group();
    const spark = new THREE.MeshBasicMaterial({ color: FISH.firefly });
    spark.userData.glow = true;
    light.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), spark));
    const glow = glowSprite(FISH.firefly, 0.6, 0.8);
    glow.visible = true;
    light.add(glow);
    nightOnly(light);
    light.position.set(x, y, z);
    g.add(light);
    fireflies.push({ light, glow, x, y, z, phase: i * 1.37 });
  }
  // Mist lying low on the water.
  const mist: THREE.Mesh[] = [];
  for (const [x, z, w, d] of [
    [20, 10, 12, 6],
    [34, 8, 14, 5],
    [48, 16, 12, 7],
    [28, 24, 16, 5],
    [50, 28, 10, 4],
  ]) {
    const haze = new THREE.MeshBasicMaterial({
      map: glowTexture(),
      color: FISH.mist,
      opacity: 0.12,
      transparent: true,
      depthWrite: false,
    });
    haze.userData.glow = true;
    const sheet = nightOnly(
      new THREE.Mesh(new THREE.PlaneGeometry(w, d), haze),
    );
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(x, WATER_Y + 0.3, z);
    g.add(sheet);
    mist.push(sheet);
  }
  return {
    group: g,
    night: {
      flames: fire.flames,
      fireGlow: fire.glow,
      firePool: fire.pool,
      glade,
      stars,
      fireflies,
      mist,
    },
  };
}

/** Build the whole static spot, with its tank, boards, floats and birds. */
export function buildFishing(): FishingScene {
  const root = new THREE.Group();
  root.add(ground(), shoreLife(), frontArea());
  const bank = bankside();
  const floats: THREE.Object3D[] = [];
  root.add(
    bank.group,
    fishingDeck(bank.planks, floats),
    pontoonAndHuts(bank.planks, floats),
  );
  const life = birds();
  const sky = nightSky();
  root.add(life.group, sky.group);
  return {
    root,
    tank: bank.tank,
    chalkboard: bank.chalkboard,
    catchBoard: bank.catchBoard,
    floats,
    ducks: life.ducks,
    heronHead: life.heronHead,
    night: sky.night,
  };
}
