/**
 * Thinking dots appear one by one, then pause, then repeat.
 */

import { describe, expect, it } from "vitest";
import type { Graphics } from "pixi.js";
import { drawThinkingDots } from "@/components/game/shared/drawThinkingDots";

/** Minimal Graphics stand-in that counts drawn circles */
function countingGraphics(): { g: Graphics; circles: () => number } {
  let circles = 0;
  const g = {
    clear: () => {
      circles = 0;
      return g;
    },
    circle: () => {
      circles++;
      return g;
    },
    fill: () => g,
    stroke: () => g,
  };
  // Each dot is drawn twice: once to fill, once to outline
  return { g: g as unknown as Graphics, circles: () => circles / 2 };
}

describe("drawThinkingDots", () => {
  it("shows 0, 1, 2, 3 dots in turn and starts over", () => {
    const { g, circles } = countingGraphics();
    const counts = [0, 450, 900, 1350, 1800, 2250].map((t) => {
      drawThinkingDots(g, t, -40);
      return circles();
    });
    expect(counts).toEqual([0, 1, 2, 3, 0, 1]);
  });
});
