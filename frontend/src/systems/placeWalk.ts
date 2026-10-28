/**
 * Walking about a place (설정 「장소」): a person heading along a path of
 * points a step at a time, facing the way it goes. The construction site
 * and the fishing pier both walk this way; each has its own way of
 * finding the path. Pure: no three.js.
 */

export interface Point {
  x: number;
  z: number;
}

export const distance = (a: Point, b: Point): number =>
  Math.hypot(b.x - a.x, b.z - a.z);

export interface Walker {
  x: number;
  z: number;
  /** Heading about y (0 faces +z). */
  facing: number;
  /** The points still to walk to, the last one the destination. */
  path: Point[];
}

/** How fast people walk (units a second). */
export const WALK_SPEED = 3.4;

/** Move a walker ``dt`` seconds along its path, facing the way it goes. */
export function stepWalk(
  walker: Walker,
  dt: number,
  speed = WALK_SPEED,
): Walker {
  let { x, z, facing } = walker;
  const path = [...walker.path];
  let left = speed * dt;
  while (path.length > 0 && left > 0) {
    const next = path[0];
    const gap = distance({ x, z }, next);
    if (gap > 1e-6) facing = Math.atan2(next.x - x, next.z - z);
    if (gap <= left) {
      x = next.x;
      z = next.z;
      left -= gap;
      path.shift();
    } else {
      x += ((next.x - x) / gap) * left;
      z += ((next.z - z) / gap) * left;
      left = 0;
    }
  }
  return { x, z, facing, path };
}
