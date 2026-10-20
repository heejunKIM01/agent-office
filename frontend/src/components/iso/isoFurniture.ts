/**
 * Furniture of the isometric office, built from simple solids.
 *
 * Every builder returns a group whose origin is the piece's centre on the
 * floor, facing +z (a chair's seat faces +z, a shelf's books face +z).
 */

import * as THREE from "three";
import type { FurnitureKind } from "@/constants/isoFloorPlan";
import { ISO_COLORS as C } from "./isoPalette";
import { textTexture } from "./isoTextures";

const materials = new Map<string, THREE.MeshLambertMaterial>();

/** Shared Lambert material per colour (and transparency/emission). */
export function material(
  color: string,
  options: { opacity?: number; emissive?: string } = {},
): THREE.MeshLambertMaterial {
  const key = `${color}|${options.opacity ?? 1}|${options.emissive ?? ""}`;
  let found = materials.get(key);
  if (!found) {
    found = new THREE.MeshLambertMaterial({
      color,
      transparent: options.opacity !== undefined && options.opacity < 1,
      opacity: options.opacity ?? 1,
      depthWrite: options.opacity === undefined || options.opacity >= 1,
      emissive: options.emissive ?? "#000000",
    });
    materials.set(key, found);
  }
  return found;
}

/** A box whose bottom sits at ``y`` (not its centre). */
export function box(
  w: number,
  h: number,
  d: number,
  color: string,
  x = 0,
  y = 0,
  z = 0,
  options: { opacity?: number; emissive?: string; shadow?: boolean } = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material(color, options),
  );
  mesh.position.set(x, y + h / 2, z);
  const shadow =
    options.shadow ?? (options.opacity === undefined || options.opacity >= 1);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
}

/** A cylinder whose bottom sits at ``y``. */
export function cylinder(
  radiusTop: number,
  radiusBottom: number,
  h: number,
  color: string,
  x = 0,
  y = 0,
  z = 0,
  segments = 20,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, h, segments),
    material(color),
  );
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.add(...children);
  return g;
}

/** Deterministic 0..1 values, so every bookshelf looks the same on each load. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function bookshelf(seed: number): THREE.Group {
  const width = 2.6;
  const depth = 0.5;
  const height = 2.2;
  const g = group(
    box(width, height, 0.06, C.shelfWood, 0, 0, -depth / 2 + 0.03),
    box(0.08, height, depth, C.shelfWood, -width / 2 + 0.04, 0, 0),
    box(0.08, height, depth, C.shelfWood, width / 2 - 0.04, 0, 0),
  );
  const shelves = 4;
  const random = seeded(seed + 1);
  const books = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: "#ffffff" }),
    shelves * 16,
  );
  books.castShadow = true;
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  let count = 0;
  for (let s = 0; s < shelves; s++) {
    const y = 0.08 + (s * height) / shelves;
    g.add(box(width - 0.12, 0.05, depth, C.shelfWood, 0, y - 0.05, 0));
    let x = -width / 2 + 0.14;
    while (x < width / 2 - 0.2 && count < books.count) {
      const w = 0.09 + random() * 0.07;
      const h = 0.32 + random() * 0.14;
      matrix.compose(
        new THREE.Vector3(x + w / 2, y + h / 2, 0.02),
        new THREE.Quaternion(),
        new THREE.Vector3(w, h, depth - 0.12),
      );
      books.setMatrixAt(count, matrix);
      books.setColorAt(
        count,
        color.set(C.books[Math.floor(random() * C.books.length)]),
      );
      count++;
      x += w + 0.01;
    }
  }
  books.count = count;
  g.add(books, box(width, 0.06, depth, C.shelfWood, 0, height, 0));
  return g;
}

function woodenChair(): THREE.Group {
  return group(
    box(0.5, 0.06, 0.5, "#8a6a4f", 0, 0.42, 0),
    box(0.5, 0.5, 0.06, "#8a6a4f", 0, 0.48, -0.22),
    box(0.05, 0.42, 0.05, "#5f4632", -0.2, 0, -0.2),
    box(0.05, 0.42, 0.05, "#5f4632", 0.2, 0, -0.2),
    box(0.05, 0.42, 0.05, "#5f4632", -0.2, 0, 0.2),
    box(0.05, 0.42, 0.05, "#5f4632", 0.2, 0, 0.2),
  );
}

function officeChair(): THREE.Group {
  return group(
    box(0.56, 0.1, 0.54, C.officeChair, 0, 0.46, 0),
    box(0.54, 0.62, 0.08, C.officeChair, 0, 0.56, -0.26),
    cylinder(0.04, 0.04, 0.4, "#5b616b", 0, 0.06, 0),
    box(0.62, 0.05, 0.08, "#5b616b", 0, 0.03, 0),
    box(0.08, 0.05, 0.62, "#5b616b", 0, 0.03, 0),
  );
}

function longDesk(): THREE.Group {
  const length = 12;
  return group(
    box(length, 0.06, 1.0, C.desk, 0, 0.72, 0),
    box(0.06, 0.72, 0.9, C.deskLeg, -length / 2 + 0.1, 0, 0),
    box(0.06, 0.72, 0.9, C.deskLeg, length / 2 - 0.1, 0, 0),
    box(0.06, 0.72, 0.9, C.deskLeg, 0, 0, 0),
    box(length - 0.3, 0.3, 0.03, C.deskLeg, 0, 0.4, -0.42),
  );
}

function imac(): THREE.Group {
  return group(
    box(0.32, 0.03, 0.22, C.imacFrame, 0, 0, 0),
    box(0.06, 0.24, 0.05, C.imacFrame, 0, 0.02, -0.04),
    box(0.92, 0.6, 0.05, C.imacFrame, 0, 0.2, 0),
    box(0.84, 0.48, 0.01, C.imacScreen, 0, 0.27, 0.03, {
      emissive: C.imacScreenDark,
    }),
  );
}

function roundTable(): THREE.Group {
  return group(
    cylinder(1.0, 1.0, 0.08, C.tableWood, 0, 0.7, 0, 28),
    cylinder(0.08, 0.08, 0.7, "#9aa1ab", 0, 0, 0),
    cylinder(0.4, 0.4, 0.04, "#9aa1ab", 0, 0, 0),
  );
}

function meetingTable(): THREE.Group {
  return group(
    box(4.4, 0.07, 1.6, C.tableWood, 0, 0.7, 0),
    box(0.1, 0.7, 1.2, "#b9a07c", -1.9, 0, 0),
    box(0.1, 0.7, 1.2, "#b9a07c", 1.9, 0, 0),
  );
}

function meetingChair(): THREE.Group {
  return group(
    box(0.52, 0.08, 0.5, C.meetingChair, 0, 0.44, 0),
    box(0.52, 0.55, 0.08, C.meetingChair, 0, 0.5, -0.22),
    cylinder(0.035, 0.035, 0.44, "#3a3f48", 0, 0, 0),
    box(0.5, 0.04, 0.06, "#3a3f48", 0, 0, 0),
  );
}

function whiteboard(): THREE.Group {
  return group(
    box(2.8, 1.3, 0.06, C.whiteboardFrame, 0, 1.0, 0),
    box(2.66, 1.16, 0.02, C.whiteboard, 0, 1.07, 0.04),
    box(1.2, 0.04, 0.02, "#e15b5b", -0.5, 1.75, 0.06),
    box(1.6, 0.04, 0.02, "#3c6fd9", -0.3, 1.55, 0.06),
    box(0.9, 0.04, 0.02, "#2f9e6d", -0.65, 1.35, 0.06),
  );
}

function sofa(): THREE.Group {
  return group(
    box(3.0, 0.42, 0.9, C.sofa, 0, 0, 0),
    box(3.0, 0.85, 0.26, C.sofaDark, 0, 0, -0.32),
    box(0.26, 0.6, 0.9, C.sofaDark, -1.37, 0, 0),
    box(0.26, 0.6, 0.9, C.sofaDark, 1.37, 0, 0),
    box(1.2, 0.1, 0.6, "#7d5747", -0.62, 0.42, 0.08),
    box(1.2, 0.1, 0.6, "#7d5747", 0.62, 0.42, 0.08),
  );
}

function armchair(): THREE.Group {
  return group(
    box(1.0, 0.42, 0.9, C.armchair, 0, 0, 0),
    box(1.0, 0.8, 0.22, "#e7e2da", 0, 0, -0.34),
    box(0.2, 0.58, 0.9, "#e7e2da", -0.42, 0, 0),
    box(0.2, 0.58, 0.9, "#e7e2da", 0.42, 0, 0),
  );
}

function coffeeTable(): THREE.Group {
  return group(
    box(1.6, 0.08, 0.8, C.tableWood, 0, 0.36, 0),
    box(1.5, 0.36, 0.7, "#c9ad84", 0, 0, 0),
  );
}

function sideTable(): THREE.Group {
  return group(
    cylinder(0.38, 0.38, 0.05, C.tableWood, 0, 0.5, 0),
    cylinder(0.05, 0.05, 0.5, "#9aa1ab", 0, 0, 0),
  );
}

function tvStand(): THREE.Group {
  return group(
    box(2.2, 0.5, 0.5, C.tableWood, 0, 0, 0),
    box(1.9, 1.05, 0.07, C.tv, 0, 1.05, -0.12),
    box(1.78, 0.93, 0.01, "#323a47", 0, 1.11, -0.08),
  );
}

function serverRack(seed: number): THREE.Group {
  const g = group(box(1.0, 2.1, 0.9, C.rack, 0, 0, 0));
  const random = seeded(seed + 7);
  for (let row = 0; row < 9; row++) {
    const y = 0.25 + row * 0.2;
    g.add(box(0.8, 0.12, 0.02, "#2b3342", 0, y, 0.46));
    for (let led = 0; led < 3; led++) {
      const color = random() > 0.3 ? C.rackLedBlue : C.rackLedGreen;
      g.add(
        box(0.05, 0.04, 0.02, color, -0.3 + led * 0.08, y + 0.04, 0.475, {
          emissive: color,
          shadow: false,
        }),
      );
    }
  }
  return g;
}

function kiosk(): THREE.Group {
  return group(
    box(0.7, 0.08, 0.5, "#4b3399", 0, 0, 0),
    box(0.6, 2.0, 0.36, C.kiosk, 0, 0.08, 0),
    box(0.46, 0.9, 0.02, C.kioskScreen, 0, 1.0, 0.19, { emissive: "#24184f" }),
  );
}

function globe(): THREE.Group {
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 24, 18),
    material(C.globeSea),
  );
  sphere.position.set(0, 1.25, 0);
  sphere.castShadow = true;
  const land = new THREE.Mesh(
    new THREE.SphereGeometry(0.425, 24, 18, 0.3, 1.4, 0.6, 1.0),
    material(C.globeLand),
  );
  land.position.copy(sphere.position);
  const land2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.425, 24, 18, 2.6, 1.0, 1.2, 0.9),
    material(C.globeLand),
  );
  land2.position.copy(sphere.position);
  return group(
    cylinder(0.32, 0.36, 0.06, C.shelfWood, 0, 0, 0),
    cylinder(0.04, 0.04, 0.8, C.shelfWood, 0, 0.06, 0),
    sphere,
    land,
    land2,
  );
}

function workDesk(): THREE.Group {
  return group(
    box(2.2, 0.06, 0.9, C.desk, 0, 0.72, 0),
    box(0.06, 0.72, 0.8, C.deskLeg, -1.0, 0, 0),
    box(0.06, 0.72, 0.8, C.deskLeg, 1.0, 0, 0),
    box(0.62, 0.42, 0.04, "#2a303a", -0.45, 0.95, -0.2),
    box(0.62, 0.42, 0.04, "#2a303a", 0.45, 0.95, -0.2),
    box(0.06, 0.2, 0.04, "#2a303a", -0.45, 0.78, -0.2),
    box(0.06, 0.2, 0.04, "#2a303a", 0.45, 0.78, -0.2),
  );
}

function cafeTable(): THREE.Group {
  return group(
    box(0.9, 0.05, 0.9, C.cafeTable, 0, 0.7, 0),
    box(0.08, 0.7, 0.08, "#4a4f58", 0, 0, 0),
    box(0.5, 0.03, 0.5, "#4a4f58", 0, 0, 0),
  );
}

function cafeChair(): THREE.Group {
  return group(
    box(0.46, 0.06, 0.46, C.cafeChair, 0, 0.44, 0),
    box(0.46, 0.48, 0.06, C.cafeChair, 0, 0.5, -0.2),
    box(0.04, 0.44, 0.04, "#4a4f58", -0.18, 0, -0.18),
    box(0.04, 0.44, 0.04, "#4a4f58", 0.18, 0, -0.18),
    box(0.04, 0.44, 0.04, "#4a4f58", -0.18, 0, 0.18),
    box(0.04, 0.44, 0.04, "#4a4f58", 0.18, 0, 0.18),
  );
}

function receptionDesk(): THREE.Group {
  const sign = textTexture("Agent Office", { color: "#ffffff", weight: 700 });
  const signHeight = 0.32;
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(signHeight * sign.aspect, signHeight),
    new THREE.MeshBasicMaterial({ map: sign.texture, transparent: true }),
  );
  signMesh.position.set(0.6, 0.5, 0.42);
  return group(
    box(4.6, 0.95, 0.8, C.receptionFront, 0, 0, 0),
    box(4.8, 0.06, 1.0, C.receptionTop, 0, 0.95, 0),
    signMesh,
    box(0.86, 0.56, 0.05, C.imacFrame, -0.7, 1.2, -0.25),
    box(0.78, 0.46, 0.01, C.imacScreen, -0.7, 1.25, -0.28, {
      emissive: C.imacScreenDark,
    }),
    box(0.06, 0.2, 0.05, C.imacFrame, -0.7, 1.0, -0.25),
    box(0.5, 0.36, 0.05, "#2a303a", 0.6, 1.08, -0.25),
  );
}

function plant(seed: number): THREE.Group {
  const g = group(cylinder(0.3, 0.24, 0.42, C.pot, 0, 0, 0, 18));
  const random = seeded(seed + 3);
  const leaves = 7;
  for (let i = 0; i < leaves; i++) {
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 1.1, 6),
      material(i % 2 === 0 ? C.leafA : C.leafB),
    );
    const angle = (i / leaves) * Math.PI * 2 + random() * 0.4;
    const tilt = 0.55 + random() * 0.35;
    leaf.position.set(Math.cos(angle) * 0.22, 0.95, Math.sin(angle) * 0.22);
    leaf.rotation.set(Math.sin(angle) * tilt, 0, -Math.cos(angle) * tilt);
    leaf.castShadow = true;
    g.add(leaf);
  }
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 1.3, 6),
    material(C.leafA),
  );
  top.position.set(0, 1.05, 0);
  top.castShadow = true;
  g.add(top);
  return g;
}

function elevator(): THREE.Group {
  const floorSign = textTexture("▲", { color: "#3fb950", weight: 800 });
  const indicator = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2 * floorSign.aspect, 0.2),
    new THREE.MeshBasicMaterial({ map: floorSign.texture, transparent: true }),
  );
  indicator.position.set(0, 2.42, 0.16);
  return group(
    box(2.6, 2.5, 0.2, C.elevatorFrame, 0, 0, 0),
    box(1.08, 2.2, 0.06, C.elevatorDoor, -0.56, 0, 0.12),
    box(1.08, 2.2, 0.06, C.elevatorDoor, 0.56, 0, 0.12),
    box(0.5, 0.22, 0.04, "#20252e", 0, 2.32, 0.12),
    indicator,
  );
}

function clock(): THREE.Group {
  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.05, 28),
    material(C.clockFace),
  );
  face.rotation.x = Math.PI / 2;
  face.position.set(0, 2.0, 0.05);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.035, 8, 28),
    material(C.clockRim),
  );
  rim.position.set(0, 2.0, 0.07);
  const hour = box(0.04, 0.2, 0.02, C.clockRim, 0, 2.0, 0.09);
  const minute = box(0.03, 0.28, 0.02, C.clockRim, 0, 2.0, 0.09);
  minute.rotation.z = -2.1;
  minute.position.set(0.12, 2.06, 0.09);
  return group(face, rim, hour, minute);
}

function windowPane(): THREE.Group {
  return group(
    box(2.5, 1.5, 0.04, C.window, 0, 0.95, 0.13, { opacity: 0.85 }),
    box(2.6, 0.08, 0.08, C.glassFrame, 0, 0.9, 0.13),
    box(2.6, 0.08, 0.08, C.glassFrame, 0, 2.45, 0.13),
    box(0.08, 1.6, 0.08, C.glassFrame, 0, 0.9, 0.13),
  );
}

/** Build one piece of furniture; ``seed`` varies books, LEDs and leaves. */
export function buildFurniture(kind: FurnitureKind, seed = 0): THREE.Group {
  switch (kind) {
    case "bookshelf":
      return bookshelf(seed);
    case "roundTable":
      return roundTable();
    case "chair":
      return woodenChair();
    case "officeChair":
      return officeChair();
    case "longDesk":
      return longDesk();
    case "imac":
      return imac();
    case "meetingTable":
      return meetingTable();
    case "meetingChair":
      return meetingChair();
    case "whiteboard":
      return whiteboard();
    case "sofa":
      return sofa();
    case "armchair":
      return armchair();
    case "coffeeTable":
      return coffeeTable();
    case "sideTable":
      return sideTable();
    case "tvStand":
      return tvStand();
    case "serverRack":
      return serverRack(seed);
    case "kiosk":
      return kiosk();
    case "globe":
      return globe();
    case "workDesk":
      return workDesk();
    case "cafeTable":
      return cafeTable();
    case "cafeChair":
      return cafeChair();
    case "receptionDesk":
      return receptionDesk();
    case "plant":
      return plant(seed);
    case "elevator":
      return elevator();
    case "clock":
      return clock();
    case "window":
      return windowPane();
  }
}
