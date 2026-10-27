/**
 * Things standing about the construction site, built from the site's own
 * solids: the site office containers, the plan table, the rest tent with
 * its benches, water cooler and portable toilets, materials in the yard
 * (bricks, rebar, pipes, formwork, slabs), a generator,
 * traffic cones and the mesh fence. Each faces +z with its origin on the
 * ground at its centre.
 */

import * as THREE from "three";
import { SITE } from "./sitePalette";
import { box, cylinder, sphere } from "./siteSolids";

/** A rounded tree, varied a little by ``seed``. */
export function tree(seed: number): THREE.Group {
  const g = new THREE.Group();
  const height = 1.6 + (seed % 3) * 0.3;
  g.add(cylinder(0.12, 0.16, height, SITE.trunk, 0, 0, 0, 8));
  const crown = seed % 2 === 0 ? SITE.leafA : SITE.leafB;
  g.add(sphere(0.9, crown, 0, height + 0.4, 0, [12, 10]));
  g.add(sphere(0.65, crown, 0.45, height + 0.1, 0.2, [10, 8]));
  return g;
}

/** One site office container, ``w`` long, its door and windows on its +z side. */
export function container(w: number): THREE.Group {
  const g = new THREE.Group();
  const d = 2.6;
  const h = 2.5;
  g.add(box(w, h, d, SITE.container, 0, 0, 0));
  g.add(
    box(w + 0.05, 0.12, d + 0.05, SITE.containerTrim, 0, h - 0.12, 0, {
      shadow: false,
    }),
  );
  g.add(
    box(w + 0.05, 0.12, d + 0.05, SITE.containerTrim, 0, 0, 0, {
      shadow: false,
    }),
  );
  g.add(
    box(0.9, 1.9, 0.06, SITE.door, -w / 2 + 1, 0.05, d / 2 + 0.01, {
      shadow: false,
    }),
  );
  for (let x = -w / 2 + 2.6; x < w / 2 - 0.8; x += 1.8) {
    g.add(
      box(1.1, 0.8, 0.06, SITE.glass, x, 1.1, d / 2 + 0.01, { shadow: false }),
    );
  }
  return g;
}

/** A stair up the side of the containers, rising towards -x. */
export function stair(steps: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < steps; i++) {
    g.add(box(0.5, 0.08, 1.1, SITE.steel, -i * 0.42, (i + 1) * 0.36, 0));
  }
  g.add(box(0.06, 1, 0.06, SITE.steel, 0, 0.36, 0.55));
  return g;
}

/** The plan table with the drawings spread on it. */
export function planTable(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [
    [-1, -0.6],
    [1, -0.6],
    [-1, 0.6],
    [1, 0.6],
  ]) {
    g.add(box(0.1, 0.9, 0.1, SITE.steel, x, 0, z));
  }
  g.add(box(2.4, 0.08, 1.5, SITE.plank, 0, 0.9, 0));
  g.add(box(1.8, 0.02, 1.1, SITE.blueprint, 0, 0.98, 0, { shadow: false }));
  for (let i = 0; i < 4; i++) {
    g.add(
      box(1.4, 0.005, 0.03, SITE.paper, 0, 1.0, -0.4 + i * 0.25, {
        shadow: false,
      }),
    );
  }
  return g;
}

/** The rest tent: a blue canopy on four poles. */
export function tent(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const h = 2.6;
  for (const [x, z] of [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ]) {
    g.add(cylinder(0.06, 0.06, h, SITE.steel, x, 0, z, 8));
  }
  g.add(box(w + 0.4, 0.12, d + 0.4, SITE.tent, 0, h, 0, { opacity: 0.9 }));
  g.add(box(w + 0.4, 0.4, 0.05, SITE.tent, 0, h - 0.4, d / 2 + 0.2));
  return g;
}

/** A long wooden bench, seats facing +z. */
export function bench(length: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(length, 0.1, 0.5, SITE.bench, 0, 0.42, 0));
  for (const x of [-length / 2 + 0.3, length / 2 - 0.3]) {
    g.add(box(0.1, 0.42, 0.45, SITE.steel, x, 0, 0));
  }
  return g;
}

export function waterCooler(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.5, 0.9, 0.5, SITE.container, 0, 0, 0));
  g.add(cylinder(0.22, 0.22, 0.5, SITE.cooler, 0, 0.9, 0, 12));
  return g;
}

export function portaToilet(color: string): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.1, 2.2, 1.1, color, 0, 0, 0));
  g.add(box(1.2, 0.1, 1.2, SITE.container, 0, 2.2, 0));
  g.add(box(0.7, 1.7, 0.04, SITE.container, 0, 0.2, 0.56, { shadow: false }));
  return g;
}

/** A pallet stacked with bricks. */
export function brickPallet(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.4, 0.15, 1.1, SITE.pallet, 0, 0, 0));
  for (let layer = 0; layer < 4; layer++) {
    for (let i = 0; i < 3; i++) {
      g.add(
        box(
          0.42,
          0.18,
          1.0,
          SITE.brick,
          -0.45 + i * 0.45,
          0.15 + layer * 0.19,
          0,
        ),
      );
    }
  }
  return g;
}

/** A bundle of rebar lying along x. */
export function rebarBundle(length: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const bar = cylinder(0.04, 0.04, length, SITE.rebar, 0, -length / 2, 0, 6);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(
      0,
      0.12 + Math.floor(i / 3) * 0.09,
      -0.12 + (i % 3) * 0.12,
    );
    g.add(bar);
  }
  g.add(box(0.2, 0.1, 0.6, SITE.pallet, -length / 3, 0, 0));
  g.add(box(0.2, 0.1, 0.6, SITE.pallet, length / 3, 0, 0));
  return g;
}

/** Pipes stacked in a pyramid, lying along x. */
export function pipeStack(length: number): THREE.Group {
  const g = new THREE.Group();
  const rows = [3, 2, 1];
  rows.forEach((count, row) => {
    for (let i = 0; i < count; i++) {
      const pipe = cylinder(
        0.22,
        0.22,
        length,
        SITE.pipe,
        0,
        -length / 2,
        0,
        12,
      );
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 0.22 + row * 0.38, (i - (count - 1) / 2) * 0.46);
      g.add(pipe);
    }
  });
  return g;
}

/** Formwork panels leaning in a stack. */
export function formwork(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++)
    g.add(box(2.2, 0.08, 1.2, SITE.formwork, 0, i * 0.09, 0));
  return g;
}

/** Precast slabs waiting for the crane, ``count`` high. */
export function slabStack(count: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    g.add(box(0.15, 0.12, 2.6, SITE.pallet, -1.2, i * 0.4, 0));
    g.add(box(0.15, 0.12, 2.6, SITE.pallet, 1.2, i * 0.4, 0));
    g.add(box(3.2, 0.28, 2.8, SITE.slab, 0, i * 0.4 + 0.12, 0));
  }
  return g;
}

export function generator(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.8, 1.1, 1, SITE.yellow, 0, 0.2, 0));
  g.add(box(1.9, 0.2, 1.1, SITE.dark, 0, 0, 0));
  g.add(cylinder(0.08, 0.08, 0.5, SITE.dark, 0.6, 1.3, 0, 8));
  return g;
}

export function cone(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.5, 0.06, 0.5, SITE.dark, 0, 0, 0));
  g.add(cylinder(0.04, 0.2, 0.7, SITE.cone, 0, 0.06, 0, 10));
  g.add(cylinder(0.14, 0.16, 0.12, SITE.reflective, 0, 0.36, 0, 10));
  return g;
}

/** A run of mesh fence along x, ``length`` long. */
export function fence(length: number): THREE.Group {
  const g = new THREE.Group();
  const height = 1.8;
  g.add(
    box(length, height - 0.2, 0.06, SITE.fenceMesh, 0, 0.15, 0, {
      opacity: 0.35,
    }),
  );
  g.add(box(length, 0.08, 0.08, SITE.fence, 0, height - 0.05, 0));
  const posts = Math.max(1, Math.round(length / 2.5));
  for (let i = 0; i <= posts; i++) {
    const x = -length / 2 + (i * length) / posts;
    g.add(box(0.1, height, 0.1, SITE.fence, x, 0, 0));
    g.add(box(0.5, 0.15, 0.3, SITE.dark, x, 0, 0));
  }
  return g;
}
