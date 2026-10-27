/**
 * Assemble the isometric airport from its plan (constants/isoAirportPlan.ts)
 * in the office's style: a grass plate, three runways with their markings,
 * hold signs and edge lights, taxiway A with a link to each runway and an
 * exit from it, the apron, the terminal with its seats, kiosks, gate
 * podium and departures board, the hangar, the control tower with the
 * controller's console, a radar, a windsock and the fire trucks. Only the
 * airport's own parts: nothing of the office's. Returns the pieces the
 * scene moves; the jet bridges and the ground crew are the gates' own
 * (airportGround.ts).
 */

import * as THREE from "three";
import {
  AIRPORT_DEPTH,
  AIRPORT_WIDTH,
  APRON,
  CONSOLE,
  CONTROLLER_SEAT,
  FIRE_TRUCKS,
  GATE_XS,
  GATE_Z,
  HANGAR,
  HANGAR_HEIGHT,
  PODIUM,
  RUNWAYS,
  RUNWAY_WIDTH,
  TAXIWAY,
  TAXIWAY_Z,
  TERMINAL,
  TERMINAL_HEIGHT,
  TOWER,
  type AirRect,
  type Runway,
} from "@/constants/isoAirportPlan";
import { softShadowTexture, textTexture, tileTexture } from "../isoTextures";
import { buildAirplane } from "./airplane";
import { AIR as A } from "./airportPalette";
import {
  bench,
  cafeSet,
  chair,
  fireTruck,
  fuelTruck,
  kiosk,
  podium,
  pottedPlant,
  shrub,
  tree,
} from "./airportProps";
import { box, cylinder, material } from "./airportSolids";

/** The grass plate's thickness under the field. */
export const PLATE_THICKNESS = 0.5;

/** Heights of the painted layers, so none flickers against another. */
const GRASS_Y = 0;
const APRON_Y = 0.01;
const TAXI_Y = 0.016;
const RUNWAY_Y = 0.022;
const PAINT_Y = 0.03;
const WALL_THICKNESS = 0.25;
const GLASS_HEIGHT = 2.3;

export interface AirportScene {
  root: THREE.Group;
  /** The dish on the radar mast, turned about y. */
  radar: THREE.Object3D;
  /** The sweep on the controller's radar scope, turned about its axis. */
  scope: THREE.Object3D;
  /** The red light on the tower's mast, blinked. */
  beacon: THREE.MeshLambertMaterial;
  /** The windsock, swayed about y. */
  windsock: THREE.Object3D;
  /** The departures board on the terminal's back wall, drawn into. */
  board: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture };
  /** Each runway's edge lights, brighter while a plane uses it. */
  runwayLights: THREE.MeshLambertMaterial[];
}

function groundPlane(
  w: number,
  d: number,
  mat: THREE.Material,
  x: number,
  z: number,
  y: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

const rectPlane = (rect: AirRect, mat: THREE.Material, y: number) =>
  groundPlane(rect.w, rect.d, mat, rect.x + rect.w / 2, rect.z + rect.d / 2, y);

function tiled(
  a: string,
  b: string,
  line: string,
  rect: AirRect,
  repeat: number,
): THREE.MeshLambertMaterial {
  const texture = tileTexture(a, b, line);
  texture.repeat.set(rect.w / repeat, rect.d / repeat);
  return new THREE.MeshLambertMaterial({ map: texture });
}

/** A painted stripe on the ground, centred at (x, z). */
const paint = (
  w: number,
  d: number,
  color: string,
  x: number,
  z: number,
): THREE.Mesh => groundPlane(w, d, material(color), x, z, PAINT_Y);

/** A sign painted on the ground or hung on a wall, ``height`` tall. */
function sign(
  text: string,
  height: number,
  color: string,
  place: (mesh: THREE.Mesh) => void,
): THREE.Mesh {
  const label = textTexture(text, { color, weight: 700 });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(height * label.aspect, height),
    new THREE.MeshBasicMaterial({
      map: label.texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  place(mesh);
  return mesh;
}

const floorSign = (
  text: string,
  height: number,
  color: string,
  x: number,
  z: number,
): THREE.Mesh =>
  sign(text, height, color, (mesh) => {
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, PAINT_Y + 0.005, z);
  });

function plate(): THREE.Group {
  const g = new THREE.Group();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(AIRPORT_WIDTH + 10, AIRPORT_DEPTH + 10),
    new THREE.MeshBasicMaterial({
      map: softShadowTexture(),
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(AIRPORT_WIDTH / 2 + 0.6, -2.2, AIRPORT_DEPTH / 2 + 0.6);
  g.add(shadow);
  const top = tileTexture(A.grassA, A.grassB, A.grassLine);
  top.repeat.set(AIRPORT_WIDTH / 6, AIRPORT_DEPTH / 6);
  const side = material(A.plateSide, { emissive: A.plateGlow });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(AIRPORT_WIDTH, PLATE_THICKNESS, AIRPORT_DEPTH),
    [side, side, new THREE.MeshLambertMaterial({ map: top }), side, side, side],
  );
  mesh.position.set(
    AIRPORT_WIDTH / 2,
    GRASS_Y - PLATE_THICKNESS / 2,
    AIRPORT_DEPTH / 2,
  );
  mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

function runwayStrip(runway: Runway): {
  group: THREE.Group;
  lights: THREE.MeshLambertMaterial;
} {
  const g = new THREE.Group();
  const { z, west, east, linkX, exitX, names } = runway;
  const half = RUNWAY_WIDTH / 2;
  // Paved from its link to its exit, so planes line up and turn off on it.
  const from = linkX - 1.4;
  const to = exitX + 1.4;
  g.add(
    groundPlane(
      to - from,
      RUNWAY_WIDTH,
      material(A.runway),
      (from + to) / 2,
      z,
      RUNWAY_Y,
    ),
  );
  // Side stripes and the dashed centre line.
  for (const side of [-1, 1]) {
    g.add(
      paint(
        east - west,
        0.16,
        A.paint,
        (west + east) / 2,
        z + side * (half - 0.3),
      ),
    );
  }
  for (let x = west + 11; x < east - 10; x += 4.5) {
    g.add(paint(2.2, 0.22, A.paint, x, z));
  }
  // Threshold bars at both ends, and the runway's names.
  for (let i = 0; i < 10; i++) {
    const bar = z - half + 0.75 + (i * (RUNWAY_WIDTH - 1.5)) / 9;
    g.add(paint(2.4, 0.26, A.paint, west + 1.8, bar));
    g.add(paint(2.4, 0.26, A.paint, east - 1.8, bar));
  }
  g.add(floorSign(names[0], 1.6, A.paint, west + 6, z));
  g.add(floorSign(names[1], 1.6, A.paint, east - 6, z));
  // Touchdown zone bars.
  for (const x of [west + 14, west + 18, east - 18, east - 14]) {
    for (const side of [-1, 1])
      g.add(paint(2.2, 0.5, A.paint, x, z + side * 1.3));
  }
  // Edge lights, green across the start and red across the far end.
  const lights = new THREE.MeshLambertMaterial({
    color: A.edgeLight,
    emissive: A.edgeGlow,
    emissiveIntensity: 0.5,
  });
  const light = (x: number, lz: number, mat: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.2, 8),
      mat,
    );
    mesh.position.set(x, 0.1, lz);
    return mesh;
  };
  for (let x = west + 1; x <= east - 1; x += 4) {
    g.add(light(x, z - half - 0.25, lights));
    g.add(light(x, z + half + 0.25, lights));
  }
  const green = material(A.green, { emissive: A.greenGlow });
  const red = material(A.red, { emissive: A.redGlow });
  for (let i = 0; i < 6; i++) {
    const lz = z - half + 0.4 + (i * (RUNWAY_WIDTH - 0.8)) / 5;
    g.add(light(west - 0.35, lz, green));
    g.add(light(east + 0.35, lz, red));
  }
  return { group: g, lights };
}

function holdSign(text: string, x: number, z: number): THREE.Group {
  const post = new THREE.Group();
  post.add(box(0.08, 0.5, 0.08, A.steel, -0.4, 0, 0));
  post.add(box(0.08, 0.5, 0.08, A.steel, 0.4, 0, 0));
  post.add(box(1.3, 0.55, 0.12, A.red, 0, 0.5, 0));
  post.add(
    sign(text, 0.42, A.paint, (mesh) => {
      mesh.position.set(0, 0.78, 0.07);
    }),
  );
  post.position.set(x, 0, z);
  return post;
}

function taxiways(): THREE.Group {
  const g = new THREE.Group();
  const asphalt = material(A.taxiway);
  g.add(rectPlane(TAXIWAY, asphalt, TAXI_Y));
  const westmost = Math.min(...RUNWAYS.map((r) => r.linkX));
  const eastmost = Math.max(...RUNWAYS.map((r) => r.exitX));
  // Yellow centre lines, and the lead-in line to each gate.
  g.add(
    paint(
      eastmost - westmost,
      0.14,
      A.taxiLine,
      (westmost + eastmost) / 2,
      TAXIWAY_Z,
    ),
  );
  for (const runway of RUNWAYS) {
    const edge = runway.z - RUNWAY_WIDTH / 2;
    for (const x of [runway.linkX, runway.exitX]) {
      g.add(
        groundPlane(
          2.8,
          edge - TAXIWAY_Z,
          asphalt,
          x,
          (edge + TAXIWAY_Z) / 2,
          TAXI_Y + 0.002,
        ),
      );
      g.add(
        paint(0.14, edge - TAXIWAY_Z, A.taxiLine, x, (edge + TAXIWAY_Z) / 2),
      );
      // The hold line before the runway, and its red sign.
      g.add(paint(2.6, 0.14, A.taxiLine, x, edge - 1.2));
      g.add(paint(2.6, 0.14, A.taxiLine, x, edge - 1.55));
      g.add(holdSign(runway.names.join("-"), x + 2.6, edge - 1.4));
    }
  }
  GATE_XS.forEach((x, i) => {
    g.add(
      paint(
        0.14,
        TAXIWAY_Z - GATE_Z + 4,
        A.taxiLine,
        x,
        (TAXIWAY_Z + GATE_Z - 4) / 2,
      ),
    );
    g.add(paint(1.4, 0.16, A.taxiLine, x, GATE_Z - 4.4));
    g.add(floorSign(`G${i + 1}`, 1, "#8e98a7", x + 2.4, TAXIWAY_Z - 3.4));
  });
  return g;
}

function apron(): THREE.Group {
  const g = new THREE.Group();
  g.add(
    rectPlane(
      APRON,
      tiled(A.concreteA, A.concreteB, A.concreteLine, APRON, 4),
      APRON_Y,
    ),
  );
  // The service road along the terminal, behind the planes' noses.
  for (let x = APRON.x + 1; x < APRON.x + APRON.w - 1; x += 2.4) {
    g.add(paint(1.2, 0.12, A.paint, x, TERMINAL.z + TERMINAL.d + 3.2));
  }
  return g;
}

/** A solid wall from (x1, z1) to (x2, z2), in the office's wall colours. */
function solidWall(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  height: number,
): THREE.Group {
  const alongX = z1 === z2;
  const length = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const w = alongX ? length : WALL_THICKNESS;
  const d = alongX ? WALL_THICKNESS : length;
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const g = new THREE.Group();
  g.add(box(w, height, d, A.wall, cx, 0, cz, { emissive: A.wallGlow }));
  g.add(
    box(w + 0.02, 0.05, d + 0.02, A.wallTop, cx, height, cz, { shadow: false }),
  );
  return g;
}

function glassWall(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
): THREE.Group {
  const alongX = z1 === z2;
  const length = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const w = alongX ? length : WALL_THICKNESS;
  const d = alongX ? WALL_THICKNESS : length;
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const g = new THREE.Group();
  g.add(box(w, GLASS_HEIGHT, d, A.glass, cx, 0, cz, { opacity: 0.32 }));
  g.add(box(w, 0.08, d, A.glassFrame, cx, GLASS_HEIGHT, cz));
  g.add(box(w, 0.12, d, A.glassFrame, cx, 0, cz));
  const posts = Math.max(1, Math.round(length / 2.4));
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    const px = alongX ? Math.min(x1, x2) + t * length : cx;
    const pz = alongX ? cz : Math.min(z1, z2) + t * length;
    g.add(box(0.08, GLASS_HEIGHT, 0.08, A.glassFrame, px, 0, pz));
  }
  return g;
}

/** Put a piece at (x, z), turned ``rot`` quarter turns, raised to ``y``. */
function place(
  piece: THREE.Object3D,
  x: number,
  z: number,
  rot = 0,
  y = 0,
): THREE.Object3D {
  piece.position.set(x, y, z);
  piece.rotation.y = (rot * Math.PI) / 2;
  return piece;
}

function departuresBoard(): {
  mesh: THREE.Group;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
} {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 288;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const g = new THREE.Group();
  const width = 8;
  const height = width * (canvas.height / canvas.width);
  g.add(box(width + 0.3, height + 0.3, 0.12, A.boardRim, 0, 0, 0));
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  face.position.set(0, (height + 0.3) / 2, 0.07);
  g.add(face);
  g.position.set(PODIUM.x, 1.15, TERMINAL.z + WALL_THICKNESS / 2 + 0.06);
  return { mesh: g, canvas, texture };
}

function terminal(): {
  group: THREE.Group;
  board: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture };
} {
  const g = new THREE.Group();
  const { x, z, w, d } = TERMINAL;
  const floor = { x, z, w, d };
  g.add(
    rectPlane(
      floor,
      tiled(A.floorA, A.floorB, A.floorLine, floor, 4),
      APRON_Y + 0.004,
    ),
  );
  g.add(solidWall(x, z, x + w, z, TERMINAL_HEIGHT));
  g.add(solidWall(x, z, x, z + d, TERMINAL_HEIGHT));
  g.add(glassWall(x, z + d, x + w, z + d));
  g.add(glassWall(x + w, z, x + w, z + d));
  g.add(
    sign("터미널 · TERMINAL", 0.56, A.wallText, (mesh) => {
      mesh.position.set(
        x + 7.5,
        TERMINAL_HEIGHT - 0.44,
        z + WALL_THICKNESS / 2 + 0.02,
      );
    }),
  );
  const board = departuresBoard();
  g.add(board.mesh);
  // Self check-in kiosks along the back wall.
  for (const kx of [12.5, 14.2, 15.9, 50.5, 52.2, 53.9]) {
    g.add(place(kiosk(), kx, z + 0.6));
  }
  // Rows of seats facing the apron, and the gate podium by the glass.
  for (const bx of [9.5, 14.5, 19.5, 47, 52, 57, 62]) {
    g.add(place(bench(), bx, 6.6), place(bench(), bx, 9.4));
  }
  g.add(place(podium(), PODIUM.x, PODIUM.z));
  // Cafe tables and plants.
  for (const cx of [26, 40.5]) g.add(place(cafeSet(), cx, 7));
  g.add(place(pottedPlant(1), 4.8, 2.8));
  g.add(place(pottedPlant(2), x + w - 0.8, 2.8));
  g.add(place(pottedPlant(3), 27.6, 3));
  g.add(place(pottedPlant(4), 38.9, 3));
  g.add(place(pottedPlant(5), 5, 12.2));
  return { group: g, board };
}

function hangar(): THREE.Group {
  const g = new THREE.Group();
  const { x, z, w, d } = HANGAR;
  g.add(
    rectPlane(
      HANGAR,
      tiled(A.hangarA, A.hangarB, A.concreteLine, HANGAR, 4),
      APRON_Y,
    ),
  );
  g.add(solidWall(x, z, x + w, z, HANGAR_HEIGHT - 1.8));
  g.add(solidWall(x, z, x, z + d, HANGAR_HEIGHT - 1.8));
  // Arched ribs over the open floor, so the plane inside shows.
  const wallTop = HANGAR_HEIGHT - 1.8;
  const rise = 3.2;
  const segments = 12;
  for (const rz of [z + 0.4, z + d * 0.36, z + d * 0.68, z + d - 0.3]) {
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI;
      const a1 = ((i + 1) / segments) * Math.PI;
      const p0 = {
        x: x + w / 2 - (Math.cos(a0) * w) / 2,
        y: wallTop + Math.sin(a0) * rise,
      };
      const p1 = {
        x: x + w / 2 - (Math.cos(a1) * w) / 2,
        y: wallTop + Math.sin(a1) * rise,
      };
      const length = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const rib = box(length + 0.06, 0.22, 0.22, A.rib, 0, -0.11, 0);
      const mount = new THREE.Group();
      mount.add(rib);
      mount.position.set((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, rz);
      mount.rotation.z = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      g.add(mount);
    }
    g.add(box(0.22, wallTop, 0.22, A.rib, x + w - 0.11, 0, rz));
  }
  // A plane in for maintenance, a tool cart and a ladder.
  const parked = buildAirplane("#94a3b8");
  // In for maintenance: its engines off, its lights dark.
  for (const light of Object.values(parked.lights).flat())
    light.visible = false;
  parked.root.position.set(x + w / 2 + 0.5, 0, z + d / 2 + 0.5);
  parked.root.rotation.y = Math.PI * 0.85;
  g.add(parked.root);
  g.add(box(1, 0.9, 0.6, A.cafeChair, x + 2.4, 0, z + 2));
  g.add(box(0.9, 0.06, 0.55, A.tugDark, x + 2.4, 0.9, z + 2));
  for (let i = 0; i < 5; i++) {
    g.add(box(0.9, 0.06, 0.12, A.tug, x + w - 4, 0.4 + i * 0.45, z + 4.5));
  }
  g.add(box(0.08, 2.4, 0.08, A.tug, x + w - 4.45, 0, z + 4.5));
  g.add(box(0.08, 2.4, 0.08, A.tug, x + w - 3.55, 0, z + 4.5));
  g.add(floorSign("격납고 · HANGAR", 0.8, A.labelText, x + w / 2, z + d + 1.1));
  return g;
}

function tower(): {
  group: THREE.Group;
  scope: THREE.Object3D;
  beacon: THREE.MeshLambertMaterial;
} {
  const g = new THREE.Group();
  const { x, z, shaft, cabFloor, cab } = TOWER;
  // A low base building, the shaft and a flared skirt under the cab.
  g.add(box(4.8, 2.2, 4.8, A.wall, x, 0, z, { emissive: A.wallGlow }));
  g.add(box(4.9, 0.06, 4.9, A.wallTop, x, 2.2, z, { shadow: false }));
  g.add(
    cylinder(shaft / 2.4, shaft / 2, cabFloor - 3.4, A.shaft, x, 2.2, z, 20),
  );
  g.add(
    cylinder(shaft / 2.3, shaft / 2.3, 0.4, A.band, x, cabFloor - 2.6, z, 20),
  );
  const skirt = cylinder(
    cab * 0.7,
    shaft / 2.4,
    1.2,
    A.wallTop,
    x,
    cabFloor - 1.2,
    z,
    4,
  );
  skirt.rotation.y = Math.PI / 4;
  g.add(skirt);
  g.add(box(cab, 0.3, cab, A.steel, x, cabFloor - 0.3, z));
  g.add(
    box(cab - 0.2, 0.02, cab - 0.2, A.carpet, x, cabFloor, z, {
      shadow: false,
    }),
  );
  // Glass all round, a frame on top and a mast with its beacon.
  const half = cab / 2;
  const glassHeight = 2.3;
  const glass = (w: number, d: number, gx: number, gz: number): THREE.Mesh =>
    box(w, glassHeight, d, A.glass, gx, cabFloor, gz, { opacity: 0.28 });
  g.add(glass(cab, 0.1, x, z - half), glass(cab, 0.1, x, z + half));
  g.add(glass(0.1, cab, x - half, z), glass(0.1, cab, x + half, z));
  for (const [fx, fz, fw, fd] of [
    [x, z - half, cab, 0.14],
    [x, z + half, cab, 0.14],
    [x - half, z, 0.14, cab],
    [x + half, z, 0.14, cab],
  ] as const) {
    g.add(box(fw, 0.14, fd, A.glassFrame, fx, cabFloor + glassHeight, fz));
    g.add(box(fw, 0.5, fd, A.wallTop, fx, cabFloor, fz));
  }
  for (const [px, pz] of [
    [x - half, z - half],
    [x + half, z - half],
    [x - half, z + half],
    [x + half, z + half],
  ] as const) {
    g.add(box(0.14, glassHeight, 0.14, A.glassFrame, px, cabFloor, pz));
  }
  g.add(
    cylinder(
      0.05,
      0.05,
      1.8,
      A.boardRim,
      x - half,
      cabFloor + glassHeight,
      z - half,
      6,
    ),
  );
  const beacon = new THREE.MeshLambertMaterial({
    color: A.red,
    emissive: A.red,
  });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), beacon);
  lamp.position.set(x - half, cabFloor + glassHeight + 1.9, z - half);
  g.add(lamp);
  // The console: screens along the desk and a radar scope in the middle.
  const consoleTop = cabFloor + 0.85;
  g.add(box(3.8, 0.85, 0.75, A.console, CONSOLE.x, cabFloor, CONSOLE.z));
  g.add(box(3.9, 0.05, 0.85, A.desk, CONSOLE.x, consoleTop, CONSOLE.z));
  for (const sx of [-1.25, 1.25]) {
    const screen = new THREE.Group();
    screen.add(box(0.95, 0.6, 0.06, A.screenFrame, 0, 0, 0));
    screen.add(
      box(0.85, 0.5, 0.02, A.screen, 0, 0.05, -0.035, { shadow: false }),
    );
    screen.position.set(CONSOLE.x + sx, consoleTop + 0.05, CONSOLE.z + 0.15);
    screen.rotation.y = Math.PI;
    g.add(screen);
  }
  const scopeBase = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 28),
    new THREE.MeshBasicMaterial({ color: A.scope }),
  );
  scopeBase.rotation.x = -Math.PI / 2;
  scopeBase.position.set(CONSOLE.x, consoleTop + 0.06, CONSOLE.z);
  g.add(scopeBase);
  const scope = new THREE.Group();
  const sweep = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.05),
    new THREE.MeshBasicMaterial({ color: A.sweep }),
  );
  sweep.rotation.x = -Math.PI / 2;
  sweep.position.x = 0.2;
  scope.add(sweep);
  scope.position.set(CONSOLE.x, consoleTop + 0.07, CONSOLE.z);
  g.add(scope);
  g.add(place(chair(), CONTROLLER_SEAT.x, CONTROLLER_SEAT.z, 0, cabFloor));
  g.add(floorSign("관제탑 · TOWER", 0.8, A.labelText, x, z + 3.6));
  return { group: g, scope, beacon };
}

function radarMast(): { group: THREE.Group; dish: THREE.Object3D } {
  const g = new THREE.Group();
  const x = 114;
  const z = 28;
  g.add(box(1.4, 0.5, 1.4, A.wall, x, 0, z, { emissive: A.wallGlow }));
  g.add(cylinder(0.14, 0.2, 3, A.steel, x, 0.5, z, 10));
  const dish = new THREE.Group();
  const face = box(2.6, 0.9, 0.12, A.white, 0, -0.45, 0);
  face.rotation.x = -0.35;
  dish.add(face);
  dish.add(box(0.2, 0.2, 0.5, A.boardRim, 0, -0.1, -0.2));
  dish.position.set(x, 3.7, z);
  g.add(dish);
  return { group: g, dish };
}

function windsock(): { group: THREE.Group; sock: THREE.Object3D } {
  const g = new THREE.Group();
  const x = 58;
  const z = (RUNWAYS[0].z + RUNWAYS[1].z) / 2;
  g.add(cylinder(0.06, 0.08, 2.8, A.steel, x, 0, z, 8));
  const sock = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const radius = 0.32 - i * 0.06;
    const cone = cylinder(
      radius - 0.06,
      radius,
      0.5,
      i % 2 === 0 ? A.sockOrange : A.white,
      0,
      -0.25,
      0,
      12,
    );
    cone.rotation.z = -Math.PI / 2;
    cone.position.x = 0.3 + i * 0.5;
    sock.add(cone);
  }
  sock.position.set(x, 2.6, z);
  g.add(sock);
  return { group: g, sock };
}

function scenery(): THREE.Group {
  const g = new THREE.Group();
  let seed = 10;
  const plantAt = (kind: "plant" | "bush", x: number, z: number): void => {
    g.add(place(kind === "plant" ? tree(seed) : shrub(seed), x, z));
    seed++;
  };
  // Along the front and left edges, between the runways and round the hangar.
  for (let x = 4; x < AIRPORT_WIDTH - 2; x += 9)
    plantAt("bush", x, AIRPORT_DEPTH - 2.4);
  for (let x = 8.5; x < AIRPORT_WIDTH - 2; x += 18)
    plantAt("plant", x, AIRPORT_DEPTH - 1.8);
  for (let z = 20; z < AIRPORT_DEPTH - 6; z += 10) plantAt("bush", 2, z);
  for (const runway of RUNWAYS.slice(1)) {
    const between = runway.z - 6;
    plantAt("bush", runway.linkX - 4.5, between);
    plantAt("bush", runway.exitX + 4.5, between);
  }
  for (const x of [40, 72])
    plantAt("bush", x, (RUNWAYS[1].z + RUNWAYS[2].z) / 2);
  plantAt("plant", AIRPORT_WIDTH - 2, 8);
  plantAt("plant", AIRPORT_WIDTH - 2, 22);
  plantAt("bush", 86, 6);
  plantAt("plant", TOWER.x - 4, TOWER.z + 6);
  // A fuel truck waiting by the hangar, and the fire trucks either side
  // of taxiway A, lengthways along it.
  g.add(place(fuelTruck(), HANGAR.x + 4, HANGAR.z + HANGAR.d + 3.5, 1));
  for (const truck of FIRE_TRUCKS)
    g.add(place(fireTruck(), truck.x, truck.z, 1));
  return g;
}

/** Build the whole static airport. */
export function buildAirport(): AirportScene {
  const root = new THREE.Group();
  root.add(plate());
  const strips = RUNWAYS.map(runwayStrip);
  root.add(...strips.map((strip) => strip.group), taxiways(), apron());
  const { group: terminalGroup, board } = terminal();
  root.add(terminalGroup, hangar());
  const { group: towerGroup, scope, beacon } = tower();
  const { group: radarGroup, dish } = radarMast();
  const { group: sockGroup, sock } = windsock();
  root.add(towerGroup, radarGroup, sockGroup, scenery());
  return {
    root,
    radar: dish,
    scope,
    beacon,
    windsock: sock,
    board,
    runwayLights: strips.map((strip) => strip.lights),
  };
}
