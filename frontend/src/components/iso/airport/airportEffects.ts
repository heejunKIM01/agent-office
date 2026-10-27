/**
 * The airport's moments (설정 「장소」 · 공항): the approach lights before a
 * runway run towards it in turn while a plane comes in to land there, a
 * puff of tyre smoke rises where a plane touches down, the fire trucks
 * either side of taxiway A spray a water arch when work ships, and hearts
 * rise over the tower and the gate when I say thanks.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { FIRE_TRUCKS, RUNWAYS } from "@/constants/isoAirportPlan";
import { heart } from "./airportLabels";
import { AIR } from "./airportPalette";
import { box, lamp } from "./airportSolids";

/** Approach lights per runway, west of where its pavement starts. */
const APPROACH_LIGHTS = 4;
const APPROACH_GAP = 1.5;
const SMOKE_MS = 1300;
const SALUTE_MS = 4000;
const SALUTE_DROPS = 40;
const SALUTE_HEIGHT = 7;
const HEART_MS = 2600;

interface Puff {
  mesh: THREE.Mesh;
  material: THREE.MeshLambertMaterial;
  start: number;
}

interface Heart {
  label: CSS2DObject;
  element: HTMLSpanElement;
  start: number;
  drift: number;
}

export class AirportMoments {
  private readonly root = new THREE.Group();
  /** Each runway's approach lights, nearest the runway last. */
  private readonly approach: THREE.MeshLambertMaterial[][];
  private readonly puffs: Puff[] = [];
  private readonly drops: THREE.Mesh[] = [];
  private saluteFrom: number | null = null;
  private readonly hearts: Heart[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    this.approach = RUNWAYS.map((runway) => {
      const start = runway.linkX - 1.4;
      return Array.from({ length: APPROACH_LIGHTS }, (_, i) => {
        const material = lamp(AIR.approach);
        material.emissiveIntensity = 0.1;
        const x = start - 1 - (APPROACH_LIGHTS - 1 - i) * APPROACH_GAP;
        this.root.add(box(0.25, 0.12, 1.6, material, x, 0, runway.z));
        return material;
      });
    });
    const water = new THREE.MeshLambertMaterial({
      color: AIR.water,
      emissive: AIR.water,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.85,
    });
    for (let i = 0; i < SALUTE_DROPS * 2; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), water);
      drop.visible = false;
      this.drops.push(drop);
      this.root.add(drop);
    }
  }

  /** A plane touched down at (x, z): a puff by each main wheel. */
  touchdown(x: number, z: number, yaw: number, now: number): void {
    for (const side of [-1, 1]) {
      const material = new THREE.MeshLambertMaterial({
        color: "#d5d9df",
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 10, 8),
        material,
      );
      // Beside the main wheels, a little behind the plane's centre.
      const right = side * 0.9;
      mesh.position.set(
        x + Math.cos(yaw) * right - Math.sin(yaw) * 0.4,
        0.4,
        z - Math.sin(yaw) * right - Math.cos(yaw) * 0.4,
      );
      this.root.add(mesh);
      this.puffs.push({ mesh, material, start: now });
    }
  }

  /** Work shipped: the fire trucks spray their arch. */
  salute(now: number): void {
    this.saluteFrom = now;
  }

  /** I said thanks: hearts rise over each of ``over``. */
  thank(over: THREE.Object3D[], now: number): void {
    for (const anchor of over) {
      for (let i = 0; i < 3; i++) {
        const element = heart();
        const label = new CSS2DObject(element);
        label.center.set(0.5, 1);
        anchor.add(label);
        this.hearts.push({
          label,
          element,
          start: now + i * 250,
          drift: (i - 1) * 0.5,
        });
      }
    }
  }

  /** ``landing`` marks the runways a plane is coming in to land on. */
  update(now: number, landing: readonly boolean[]): void {
    const seconds = now / 1000;
    // The approach lights run towards the runway, one after another.
    this.approach.forEach((lights, k) => {
      const lit = Math.floor(seconds * 8) % (APPROACH_LIGHTS + 2);
      lights.forEach((material, i) => {
        material.emissiveIntensity = landing[k]
          ? i === lit
            ? 1.6
            : 0.25
          : 0.1;
      });
    });
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const puff = this.puffs[i];
      const t = (now - puff.start) / SMOKE_MS;
      if (t >= 1) {
        puff.mesh.removeFromParent();
        puff.mesh.geometry.dispose();
        puff.material.dispose();
        this.puffs.splice(i, 1);
        continue;
      }
      puff.mesh.scale.setScalar(0.6 + 1.8 * t);
      puff.mesh.position.y = 0.4 + 0.8 * t;
      puff.material.opacity = 0.7 * (1 - t);
    }
    this.sprayArch(now);
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      const t = (now - h.start) / HEART_MS;
      if (t >= 1) {
        h.label.removeFromParent();
        this.hearts.splice(i, 1);
        continue;
      }
      h.label.visible = t >= 0;
      if (t < 0) continue;
      h.label.position.set(h.drift * t, 0.6 + 2.2 * t, 0);
      h.element.style.opacity = String(t < 0.7 ? 1 : (1 - t) / 0.3);
    }
  }

  /** Two jets from the fire trucks, meeting in an arch over taxiway A. */
  private sprayArch(now: number): void {
    const t =
      this.saluteFrom === null ? 1 : (now - this.saluteFrom) / SALUTE_MS;
    const on = t < 1;
    const [a, b] = FIRE_TRUCKS;
    this.drops.forEach((drop, i) => {
      drop.visible = on;
      if (!on) return;
      const [from, to] = i < SALUTE_DROPS ? [a, b] : [b, a];
      const u = ((i % SALUTE_DROPS) / SALUTE_DROPS + (now / 1000) * 0.9) % 1;
      // Each jet rises from its truck to just past the middle of the arch.
      const f = u * 0.55;
      drop.position.set(
        from.x + (to.x - from.x) * f,
        2.4 + SALUTE_HEIGHT * 4 * f * (1 - f),
        from.z + (to.z - from.z) * f,
      );
      drop.scale.setScalar(1 - 0.4 * u);
    });
    if (!on) this.saluteFrom = null;
  }

  dispose(): void {
    for (const h of this.hearts) h.label.removeFromParent();
    this.root.removeFromParent();
  }
}
