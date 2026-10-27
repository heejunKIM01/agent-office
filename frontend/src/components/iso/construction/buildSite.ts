/**
 * Assemble the isometric construction site from its plan
 * (constants/sitePlan.ts) in the office's style: packed earth with a
 * gravel road from the gate, a mesh fence round it, the site office
 * containers with the plan table and the schedule board, the rest tent,
 * the material yard, the excavator by its pit and heap, the building with
 * its hoist, the tower crane and the trucks' way in. Only the site's own
 * parts: nothing of the office's or the airport's. Returns the pieces the
 * scene moves.
 */

import * as THREE from "three";
import {
  BUILDING,
  EXCAVATOR,
  GATE,
  PLAN_TABLE,
  REST_AREA,
  SCHEDULE_BOARD,
  SITE_DEPTH,
  SITE_OFFICE,
  SITE_WIDTH,
  SLAB_STACK,
  YARD,
} from "@/constants/sitePlan";
import { softShadowTexture, textTexture, tileTexture } from "../isoTextures";
import { SiteBuilding } from "./siteBuilding";
import { TowerCrane } from "./siteCrane";
import { Excavator, Hoist, SiteTraffic } from "./siteMachines";
import { SITE } from "./sitePalette";
import {
  bench,
  brickPallet,
  cone,
  container,
  fence,
  formwork,
  generator,
  pipeStack,
  planTable,
  portaToilet,
  rebarBundle,
  slabStack,
  stair,
  tent,
  tree,
  waterCooler,
} from "./siteProps";
import { box, material } from "./siteSolids";

/** The earth plate's thickness under the site. */
export const PLATE_THICKNESS = 0.5;
const ROAD_Y = 0.012;
const SIGN_Y = 0.03;

export interface SiteScene {
  root: THREE.Group;
  crane: TowerCrane;
  building: SiteBuilding;
  excavator: Excavator;
  hoist: Hoist;
  traffic: SiteTraffic;
  /** The schedule board by the site office, drawn into. */
  board: { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture };
}

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

function groundPlane(
  w: number,
  d: number,
  mat: THREE.Material,
  x: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, ROAD_Y, z);
  mesh.receiveShadow = true;
  return mesh;
}

/** A sign painted on the ground, reading along x, ``height`` tall. */
function floorSign(
  text: string,
  height: number,
  x: number,
  z: number,
): THREE.Mesh {
  const label = textTexture(text, { color: SITE.labelText, weight: 700 });
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

function plate(): THREE.Group {
  const g = new THREE.Group();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(SITE_WIDTH + 10, SITE_DEPTH + 10),
    new THREE.MeshBasicMaterial({
      map: softShadowTexture(),
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(SITE_WIDTH / 2 + 0.6, -2.2, SITE_DEPTH / 2 + 0.6);
  g.add(shadow);
  const top = tileTexture(SITE.earthA, SITE.earthB, SITE.earthLine);
  top.repeat.set(SITE_WIDTH / 5, SITE_DEPTH / 5);
  const side = material(SITE.plateSide, { emissive: SITE.plateGlow });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(SITE_WIDTH, PLATE_THICKNESS, SITE_DEPTH),
    [side, side, new THREE.MeshLambertMaterial({ map: top }), side, side, side],
  );
  mesh.position.set(SITE_WIDTH / 2, -PLATE_THICKNESS / 2, SITE_DEPTH / 2);
  mesh.receiveShadow = true;
  g.add(mesh);
  // Gravel: the road in from the gate, the apron along the building's
  // front and the yard.
  const gravel = (w: number, d: number, x: number, z: number): THREE.Mesh => {
    const texture = tileTexture(SITE.gravelA, SITE.gravelB, SITE.gravelLine, 4);
    texture.repeat.set(w / 4, d / 4);
    return groundPlane(
      w,
      d,
      new THREE.MeshLambertMaterial({ map: texture }),
      x,
      z,
    );
  };
  const front = BUILDING.z + BUILDING.d;
  g.add(
    gravel(GATE.width, SITE_DEPTH - front, GATE.x, (front + SITE_DEPTH) / 2),
  );
  g.add(gravel(BUILDING.w + 6, 4.5, BUILDING.x + BUILDING.w / 2, front + 2.25));
  g.add(gravel(YARD.w, YARD.d, YARD.x + YARD.w / 2, YARD.z + YARD.d / 2));
  return g;
}

function fenceRound(): THREE.Group {
  const g = new THREE.Group();
  g.add(place(fence(SITE_WIDTH), SITE_WIDTH / 2, 0.1));
  g.add(place(fence(SITE_DEPTH), 0.1, SITE_DEPTH / 2, 1));
  g.add(place(fence(SITE_DEPTH), SITE_WIDTH - 0.1, SITE_DEPTH / 2, 1));
  // The front, open at the gate.
  const left = GATE.x - GATE.width / 2;
  const right = GATE.x + GATE.width / 2;
  g.add(place(fence(left), left / 2, SITE_DEPTH - 0.1));
  g.add(
    place(
      fence(SITE_WIDTH - right),
      (right + SITE_WIDTH) / 2,
      SITE_DEPTH - 0.1,
    ),
  );
  for (const x of [left, right]) {
    g.add(box(0.3, 2.4, 0.3, SITE.yellow, x, 0, SITE_DEPTH - 0.1));
  }
  // A safety-first board by the gate.
  const label = textTexture("안전제일 · SAFETY FIRST", {
    color: "#ffffff",
    weight: 800,
    background: "#1f7a3a",
  });
  const signBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1 * label.aspect, 1.1),
    new THREE.MeshBasicMaterial({ map: label.texture, transparent: true }),
  );
  signBoard.position.set(left - 4.5, 1.2, SITE_DEPTH - 0.04);
  g.add(signBoard);
  return g;
}

function siteOffice(): { group: THREE.Group; board: SiteScene["board"] } {
  const g = new THREE.Group();
  const { x, z, w, d } = SITE_OFFICE;
  const cx = x + w / 2;
  const cz = z + d / 2;
  g.add(place(container(w), cx, cz));
  g.add(place(container(w), cx, cz, 0, 2.5));
  g.add(place(stair(6), x + w - 0.3, z + d + 0.6));
  g.add(box(w, 0.08, 1, SITE.steel, cx, 2.5, z + d + 0.5));
  g.add(place(planTable(), PLAN_TABLE.x, PLAN_TABLE.z));
  // The schedule board on legs, facing +x towards the site.
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Group();
  board.add(box(0.1, 2, 0.1, SITE.steel, 0, 0, -1.3));
  board.add(box(0.1, 2, 0.1, SITE.steel, 0, 0, 1.3));
  board.add(box(0.08, 1.75, 2.9, SITE.boardRim, 0, 0.9, 0));
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 1.6875),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  face.rotation.y = Math.PI / 2;
  face.position.set(0.05, 1.775, 0);
  board.add(face);
  g.add(place(board, SCHEDULE_BOARD.x, SCHEDULE_BOARD.z));
  g.add(floorSign("현장 사무소 · SITE OFFICE", 0.7, cx, z - 1.1));
  return { group: g, board: { canvas, texture } };
}

function restArea(): THREE.Group {
  const g = new THREE.Group();
  const { x, z, w, d } = REST_AREA;
  g.add(place(tent(7, 6.4), x + 5.1, z + 5.4));
  g.add(place(bench(5.2), x + 5.1, z + 3.4));
  g.add(place(bench(5.2), x + 5.1, z + 7.6, 2));
  g.add(place(waterCooler(), x + 9.6, z + 3));
  g.add(place(portaToilet(SITE.toiletBlue), x + w - 1, z + d - 2.6));
  g.add(place(portaToilet(SITE.toiletGreen), x + w - 2.4, z + d - 2.6));
  g.add(floorSign("휴게소 · REST", 0.7, x + 5, z + d + 0.6));
  return g;
}

function yard(): THREE.Group {
  const g = new THREE.Group();
  const { x, z, w } = YARD;
  for (const [px, pz] of [
    [x + 2, z + 2],
    [x + 4, z + 2],
    [x + 2, z + 4],
  ]) {
    g.add(place(brickPallet(), px, pz));
  }
  g.add(place(rebarBundle(6), x + 10, z + 2.2));
  g.add(place(pipeStack(5), x + 10, z + 6.5));
  g.add(place(formwork(), x + 3, z + 8));
  g.add(place(slabStack(3), SLAB_STACK.x, SLAB_STACK.z));
  g.add(floorSign("자재 야적장 · YARD", 0.7, x + w / 2, z + 13));
  return g;
}

function digging(): THREE.Group {
  const g = new THREE.Group();
  for (const [cx, cz] of [
    [EXCAVATOR.x - 8, EXCAVATOR.z - 3],
    [EXCAVATOR.x - 8, EXCAVATOR.z + 3],
    [EXCAVATOR.x - 2, EXCAVATOR.z - 3.6],
    [EXCAVATOR.x - 2, EXCAVATOR.z + 3.6],
  ]) {
    g.add(place(cone(), cx, cz));
  }
  g.add(place(generator(), 42, 42.4));
  return g;
}

/** Build the whole static site, with its crane and building. */
export function buildSite(): SiteScene {
  const root = new THREE.Group();
  root.add(plate(), fenceRound());
  const office = siteOffice();
  root.add(office.group, restArea(), yard(), digging());
  let seed = 0;
  for (const [tx, tz] of [
    [61, 3],
    [61, 22],
    [2, 22],
    [18, 2.5],
    [61, 46],
  ]) {
    root.add(place(tree(seed++), tx, tz));
  }
  const building = new SiteBuilding();
  const crane = new TowerCrane();
  const excavator = new Excavator();
  const hoist = new Hoist();
  const traffic = new SiteTraffic();
  root.add(building.root, crane.root, excavator.root, hoist.root, traffic.root);
  return {
    root,
    crane,
    building,
    excavator,
    hoist,
    traffic,
    board: office.board,
  };
}
