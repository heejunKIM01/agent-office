/**
 * When people crowd together (neighbouring desks, one room), their name
 * chips and bubbles cover each other. Each person's chip and bubble move as
 * one box: the one lowest on the screen, nearest the viewer, stays put, and
 * any box over a nearer one is lifted just clear of it.
 */

/** A person's chip and bubble together, where they are drawn unlifted (px). */
export interface LabelBox {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Space kept between a lifted box and the one under it (px). */
const LIFT_GAP = 4;
/** Lifted further than this, a box would float away from its person (px). */
export const MAX_LIFT = 120;

const overlaps = (a: LabelBox, b: LabelBox, lift: number): boolean =>
  a.left < b.right &&
  b.left < a.right &&
  a.top - lift < b.bottom &&
  b.top < a.bottom - lift;

/** How far up (px) to draw each box so none covers a nearer one. */
export function liftLabels(boxes: LabelBox[]): Map<string, number> {
  const nearestFirst = [...boxes].sort(
    (a, b) => b.bottom - a.bottom || a.id.localeCompare(b.id),
  );
  const lifts = new Map<string, number>();
  const placed: LabelBox[] = [];
  for (const box of nearestFirst) {
    let lift = 0;
    for (;;) {
      const under = placed.find((other) => overlaps(box, other, lift));
      if (!under) break;
      lift = box.bottom - under.top + LIFT_GAP;
      if (lift >= MAX_LIFT) {
        lift = MAX_LIFT;
        break;
      }
    }
    lifts.set(box.id, lift);
    placed.push({ ...box, top: box.top - lift, bottom: box.bottom - lift });
  }
  return lifts;
}
