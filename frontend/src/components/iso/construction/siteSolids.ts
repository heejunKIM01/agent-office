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
  return new THREE.MeshLambertMaterial({ color, emissive: color });
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
