/**
 * The pot on my desk (systems/officePlant.ts counts the day's commits): a
 * terracotta pot at the left end of the reception desk with a sprout in it that
 * grows taller and leafier with the day's commits, buds at five and flowers
 * at eight. Each new stage pops up with a little bounce; the next day it is
 * a sprout again.
 */

import * as THREE from "three";
import { FURNITURE, type Furniture } from "@/constants/isoFloorPlan";
import {
  committedJustNow,
  commitsToday,
  plantStage,
  type PlantStage,
} from "@/systems/officePlant";
import { cylinder, material } from "./isoFurniture";
import { ISO_COLORS as C } from "./isoPalette";

/**
 * The reception desk's top, and where on it the pot stands (along its length,
 * across): the end away from where visitors stand to ask me something
 * (WORK_SPOTS.mydesk), so they do not hide it, and clear of tonight's pizza.
 */
const DESK_TOP = 1.01;
const ON_DESK = { along: -2.95, across: 0.1 };
/** How tall the stem is at each stage (m). */
const STEM = [0.07, 0.18, 0.32, 0.46, 0.5] as const;
/** How many leaves show at each stage. */
const LEAVES = [2, 3, 5, 7, 7] as const;
/** Larger than a real desk pot so the stages read at the floor's zoom. */
const SIZE = 1.6;
/** A new stage pops up over this long (s). */
const GROW_SECONDS = 0.8;

/** A leaf: a flattened green ball sticking out from the stem. */
function leaf(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 8),
    material(C.plantLeaf),
  );
  mesh.scale.set(1, 0.28, 0.55);
  mesh.castShadow = true;
  return mesh;
}

export class IsoPlant {
  private readonly root = new THREE.Group();
  private readonly plant = new THREE.Group();
  /** The stem, its bottom on the soil, stretched to the stage's height. */
  private readonly stem = new THREE.Group();
  private readonly leaves: THREE.Mesh[] = [];
  private readonly bud: THREE.Mesh;
  private readonly flower = new THREE.Group();
  private times: readonly number[] = [];
  private stage: PlantStage | null = null;
  private growStart: number | null = null;

  constructor(office: THREE.Object3D) {
    const desk = FURNITURE.find(
      (piece): piece is Furniture => piece.kind === "receptionDesk",
    );
    const turn = ((desk?.rot ?? 0) * Math.PI) / 2;
    const { along, across } = ON_DESK;
    this.root.position.set(
      (desk?.x ?? 0) + along * Math.cos(turn) + across * Math.sin(turn),
      DESK_TOP,
      (desk?.z ?? 0) - along * Math.sin(turn) + across * Math.cos(turn),
    );
    this.root.scale.setScalar(SIZE);
    this.root.add(cylinder(0.17, 0.13, 0.28, C.plantPot, 0, 0, 0, 18));
    this.root.add(cylinder(0.19, 0.19, 0.05, C.plantPot, 0, 0.25, 0, 18));
    this.root.add(cylinder(0.155, 0.155, 0.02, C.plantSoil, 0, 0.28, 0, 18));

    this.plant.position.y = 0.3;
    this.stem.add(cylinder(0.018, 0.022, 1, C.plantStem, 0, 0, 0, 8));
    this.plant.add(this.stem);
    for (let i = 0; i < LEAVES[4]; i++) {
      const mesh = leaf();
      this.leaves.push(mesh);
      this.plant.add(mesh);
    }
    this.bud = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 10),
      material(C.plantBud),
    );
    this.bud.scale.set(1, 1.4, 1);
    this.plant.add(this.bud);
    for (let i = 0; i < 5; i++) {
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 12, 8),
        material(C.plantPetal),
      );
      const a = (i / 5) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06);
      petal.scale.set(1, 0.35, 1);
      this.flower.add(petal);
    }
    const middle = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 12, 8),
      material(C.plantFlowerMiddle),
    );
    middle.position.y = 0.015;
    this.flower.add(middle);
    // Tilted towards the camera so the open flower shows.
    this.flower.rotation.set(0.5, 0, -0.35);
    this.plant.add(this.flower);
    this.root.add(this.plant);
    office.add(this.root);
  }

  /** When the session's commits went through (ms). */
  setCommitTimes(times: readonly number[]): void {
    this.times = times;
  }

  /** Grow to the stage of the commits made on ``date``'s day; ``seconds`` is the clock. */
  update(date: Date, seconds: number): void {
    const stage = plantStage(commitsToday(this.times, date));
    if (stage !== this.stage) {
      // A stage a commit just reached pops up; the first one, and one that
      // older commits reach once the session has loaded, just shows.
      const grew = this.stage !== null && stage > this.stage;
      if (grew && committedJustNow(this.times, date)) this.growStart = seconds;
      this.stage = stage;
      this.shape(stage);
    }
    let pop = 1;
    if (this.growStart !== null) {
      const t = (seconds - this.growStart) / GROW_SECONDS;
      if (t >= 1) this.growStart = null;
      else pop = 0.55 + 0.45 * t + 0.25 * Math.sin(Math.PI * t);
    }
    this.plant.scale.setScalar(pop);
  }

  /** Lay the stem, leaves, bud and flower out for ``stage``. */
  private shape(stage: PlantStage): void {
    const height = STEM[stage];
    this.stem.scale.set(1, height, 1);
    this.leaves.forEach((mesh, i) => {
      mesh.visible = i < LEAVES[stage];
      // Up the stem in pairs, turning a little each time.
      const up = Math.min(height - 0.03, 0.03 + Math.floor(i / 2) * 0.1);
      const side = i % 2 === 0 ? 1 : -1;
      const turn = i * 1.1;
      mesh.position.set(
        Math.cos(turn) * 0.06 * side,
        Math.max(0.02, up),
        Math.sin(turn) * 0.06 * side,
      );
      mesh.rotation.set(0, turn, side * 0.5);
    });
    this.bud.visible = stage === 3;
    this.bud.position.y = height + 0.04;
    this.flower.visible = stage === 4;
    this.flower.position.y = height + 0.03;
  }
}
