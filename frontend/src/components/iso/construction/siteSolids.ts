/**
 * The construction site's building blocks: boxes, cylinders and spheres
 * sharing one material per colour. The site keeps its own, apart from the
 * office's furniture and the airport's, so each place can change alone.
 */

import * as THREE from "three";

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

/** A material of its own, for a light that blinks or fades by itself. */
export function lamp(color: string): THREE.MeshLambertMaterial {
  const found = new THREE.MeshLambertMaterial({ color, emissive: color });
  found.userData.lamp = true;
  return found;
}

/** How much darker the site's colours go at night. */
const NIGHT_SHADE = 0.45;

/**
 * Shade everything under ``root`` for the night, or back to day. Lamps (and
 * anything marked to glow) keep their colour. The shared materials are
 * shaded once for all who use them, so things made later at night come out
 * shaded too.
 */
export function shadeForNight(root: THREE.Object3D, night: boolean): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const list: THREE.Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const m of list) {
      if (!(
        m instanceof THREE.MeshLambertMaterial ||
        m instanceof THREE.MeshBasicMaterial
      ))
        continue;
      if (m.userData.lamp || m.userData.glow) continue;
      const day = (m.userData.dayColor ??= m.color.clone()) as THREE.Color;
      m.color.copy(day).multiplyScalar(night ? NIGHT_SHADE : 1);
    }
  });
}

/** A box whose bottom sits at ``y`` (not its centre). */
export function box(
  w: number,
  h: number,
  d: number,
  color: string | THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  options: { opacity?: number; emissive?: string; shadow?: boolean } = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    typeof color === "string" ? material(color, options) : color,
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
  color: string | THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  segments = 20,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, h, segments),
    typeof color === "string" ? material(color) : color,
  );
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A sphere centred at (x, y, z). */
export function sphere(
  radius: number,
  color: string | THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  segments: [number, number] = [16, 12],
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, segments[0], segments[1]),
    typeof color === "string" ? material(color) : color,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}
