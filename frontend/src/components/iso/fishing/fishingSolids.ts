/**
 * The fishing pier's building blocks: boxes, cylinders and spheres
 * sharing one material per colour, and a rod between two points. The pier
 * keeps its own, apart from the other places', so each can change alone
 * and shading one for the night leaves the others as they are.
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

/**
 * A lamp that is dark by day and lights up at night: ``day`` and
 * ``night`` are its colours, ``strength`` how brightly it glows.
 * lightForNight switches it.
 */
export function nightLamp(
  day: string,
  night: string,
  strength = 1,
): THREE.MeshLambertMaterial {
  const found = new THREE.MeshLambertMaterial({ color: day });
  found.userData.lamp = true;
  found.userData.dayLight = day;
  found.userData.nightLight = night;
  found.emissiveIntensity = strength;
  return found;
}

/** Mark ``object`` to show only at night (glows, the moon, fireflies). */
export function nightOnly<T extends THREE.Object3D>(object: T): T {
  object.userData.nightOnly = true;
  object.visible = false;
  return object;
}

let glowMap: THREE.CanvasTexture | null = null;

/** A soft round glow, white in the middle and fading out, drawn once. */
export function glowTexture(): THREE.CanvasTexture {
  if (glowMap) return glowMap;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  glowMap = new THREE.CanvasTexture(canvas);
  glowMap.colorSpace = THREE.SRGBColorSpace;
  return glowMap;
}

/** A glow facing the camera, ``size`` across, shown only at night. */
export function glowSprite(
  color: string,
  size: number,
  opacity = 0.9,
): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color,
      opacity,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sprite.scale.set(size, size, 1);
  return nightOnly(sprite);
}

/** A pool of light lying on the ground, ``radius`` round, shown only at night. */
export function glowPool(
  color: string,
  radius: number,
  opacity: number,
): THREE.Mesh {
  const glow = new THREE.MeshBasicMaterial({
    map: glowTexture(),
    color,
    opacity,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  glow.userData.glow = true;
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    glow,
  );
  pool.rotation.x = -Math.PI / 2;
  return nightOnly(pool);
}

/**
 * Light the night lamps under ``root`` and show what shows only at night,
 * or put them out for the day.
 */
export function lightForNight(root: THREE.Object3D, night: boolean): void {
  root.traverse((object) => {
    if (object.userData.nightOnly) object.visible = night;
    if (!(object instanceof THREE.Mesh)) return;
    const m = object.material;
    if (!(m instanceof THREE.MeshLambertMaterial) || !m.userData.nightLight)
      return;
    m.color.set(night ? m.userData.nightLight : m.userData.dayLight);
    m.emissive.set(night ? m.userData.nightLight : "#000000");
  });
}

/** Moonlight: the colours go darker and bluer at night. */
const NIGHT_TINT = new THREE.Color(0.34, 0.41, 0.6);

/**
 * Tint everything under ``root`` for a moonlit night, or back to day.
 * Lamps (and anything marked to glow) keep their colour. The shared
 * materials are tinted once for all who use them, so things made later at
 * night come out tinted too.
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
      m.color.copy(day);
      if (night) m.color.multiply(NIGHT_TINT);
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

/** A thin rod (a line, a rope) from ``from`` to ``to``. */
export function strand(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  color: string,
): THREE.Mesh {
  const length = from.distanceTo(to);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 6),
    material(color),
  );
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    to.clone().sub(from).normalize(),
  );
  return mesh;
}
