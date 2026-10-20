/**
 * Thinking dots: three rising circles beside a pondering character's head
 * (docs/plan/spec.md R3). Shared by the boss (seated and on errands) and
 * agents.
 */

import { Graphics } from "pixi.js";

/** Time between dots appearing (ms); the cycle is three dots plus a pause */
const DOT_STEP_MS = 450;
// Offsets clear the name label that sits above the head
const DOTS: Array<{ dx: number; dy: number; radius: number }> = [
  { dx: 24, dy: -2, radius: 3 },
  { dx: 33, dy: -13, radius: 4.5 },
  { dx: 44, dy: -27, radius: 6 },
];

/**
 * Draw the dots above-right of a head whose top edge is at `headTopY`.
 * Dots appear one by one and the cycle restarts after a short pause.
 */
export function drawThinkingDots(
  g: Graphics,
  timeMs: number,
  headTopY: number,
): void {
  g.clear();
  const visible = Math.floor(timeMs / DOT_STEP_MS) % (DOTS.length + 1);
  for (let i = 0; i < visible; i++) {
    const { dx, dy, radius } = DOTS[i];
    g.circle(dx, headTopY + dy, radius);
    g.fill(0xffffff);
    g.circle(dx, headTopY + dy, radius);
    g.stroke({ width: 1.5, color: 0x1f2937 });
  }
}
