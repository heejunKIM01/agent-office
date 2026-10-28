/**
 * The fish tank by the office: a glass tank of water on a stand, with
 * the session's latest catch swimming round inside it (systems/
 * fishingCatch.ts). A new fish lands with a splash on the water.
 */

import * as THREE from "three";
import { TANK } from "@/constants/fishingPlan";
import type { Species } from "@/systems/fishingCatch";
import { FISH } from "./fishingPalette";
import { fishModel } from "./fishingProps";
import { box, material } from "./fishingSolids";

const STAND = 0.4;
const GLASS = 1.3;
/** How long a splash ring spreads on the water (ms). */
const SPLASH_MS = 900;
/** The tank's fish are drawn at this size. */
const FISH_SIZE = 0.75;

interface Swimmer {
  model: THREE.Group;
  /** Where on its round it starts, how wide the round is, how fast. */
  phase: number;
  reach: number;
  speed: number;
  depth: number;
}

export class FishTank {
  readonly root = new THREE.Group();
  private readonly school = new THREE.Group();
  private swimmers: Swimmer[] = [];
  private readonly ring: THREE.Mesh;
  private splashAt: number | null = null;
  /** The top of the water, for the splash and the sign above. */
  readonly waterTop = STAND + GLASS - 0.15;

  constructor() {
    const { x, z, w, d } = TANK;
    this.root.position.set(x + w / 2, 0, z + d / 2);
    this.root.add(box(w + 0.2, STAND, d + 0.2, FISH.steel, 0, 0, 0));
    this.root.add(
      box(w - 0.1, GLASS - 0.2, d - 0.1, FISH.tankWater, 0, STAND, 0, {
        opacity: 0.5,
      }),
    );
    this.root.add(
      box(w, GLASS, d, FISH.tankGlass, 0, STAND, 0, { opacity: 0.22 }),
    );
    // The frame round the top.
    for (const [fw, fd, fx, fz] of [
      [w + 0.1, 0.1, 0, d / 2],
      [w + 0.1, 0.1, 0, -d / 2],
      [0.1, d + 0.1, w / 2, 0],
      [0.1, d + 0.1, -w / 2, 0],
    ]) {
      this.root.add(box(fw, 0.1, fd, FISH.steel, fx, STAND + GLASS - 0.05, fz));
    }
    this.root.add(this.school);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.45, 24),
      material(FISH.ripple, { opacity: 0.9 }).clone(),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = this.waterTop + 0.02;
    this.ring.visible = false;
    this.root.add(this.ring);
  }

  /** Put these fish in the tank, oldest first, in place of the ones there. */
  setFish(fish: readonly Species[]): void {
    for (const swimmer of this.swimmers) {
      swimmer.model.removeFromParent();
      swimmer.model.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
    }
    this.swimmers = fish.map((species, i) => {
      const model = fishModel(species);
      model.scale.multiplyScalar(FISH_SIZE);
      this.school.add(model);
      return {
        model,
        phase: i * 2.399,
        reach: 0.55 + (i % 4) * 0.12,
        speed: 0.35 + (i % 3) * 0.12,
        depth: STAND + 0.3 + (i % 3) * 0.25,
      };
    });
  }

  /** A fish just landed in the tank. */
  splash(now: number): void {
    this.splashAt = now;
  }

  update(now: number): void {
    const seconds = now / 1000;
    const halfW = TANK.w / 2 - 0.7;
    const halfD = TANK.d / 2 - 0.4;
    for (const swimmer of this.swimmers) {
      const angle = swimmer.phase + seconds * swimmer.speed;
      const x = Math.cos(angle) * halfW * swimmer.reach;
      const z = Math.sin(angle) * halfD * swimmer.reach;
      swimmer.model.position.set(
        x,
        swimmer.depth + 0.05 * Math.sin(seconds * 2 + swimmer.phase),
        z,
      );
      // Nose along the way it swims round: the tangent of the ellipse.
      swimmer.model.rotation.y = Math.atan2(
        -Math.cos(angle) * halfD,
        -Math.sin(angle) * halfW,
      );
    }
    const since = this.splashAt === null ? -1 : now - this.splashAt;
    this.ring.visible = since >= 0 && since < SPLASH_MS;
    if (this.ring.visible) {
      const k = since / SPLASH_MS;
      this.ring.scale.setScalar(1 + 3 * k);
      (this.ring.material as THREE.MeshLambertMaterial).opacity = 0.9 * (1 - k);
    }
  }

  dispose(): void {
    this.setFish([]);
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
  }
}
