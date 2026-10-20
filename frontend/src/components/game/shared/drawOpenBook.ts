/**
 * Open book held in both hands while reading in the archive
 * (docs/plan/spec.md R1). Shared by the boss and agents.
 */

import { Graphics } from "pixi.js";

/** Open book held at chest height; `turn` (0..1) sweeps a page across */
export function drawOpenBook(g: Graphics, turn: number): void {
  g.clear();
  // Cover
  g.roundRect(-23, 0, 46, 28, 3);
  g.fill(0x7c2d12);
  g.roundRect(-23, 0, 46, 28, 3);
  g.stroke({ width: 1, color: 0x431407 });
  // Pages
  g.rect(-21, 2, 20, 23);
  g.fill(0xfef9e7);
  g.rect(1, 2, 20, 23);
  g.fill(0xfdf6dc);
  // Spine
  g.rect(-1, 1, 2, 25);
  g.fill(0x431407);
  // Text lines
  for (let i = 0; i < 4; i++) {
    g.rect(-18, 6 + i * 4, i % 2 === 0 ? 14 : 11, 1);
    g.fill(0x475569);
    g.rect(4, 6 + i * 4, i % 2 === 0 ? 14 : 10, 1);
    g.fill(0x475569);
  }
  // Turning page: narrows toward the spine, then opens on the left
  if (turn > 0) {
    const width = 20 * Math.abs(Math.cos(turn * Math.PI));
    const x = turn < 0.5 ? 1 : -1 - width;
    g.rect(x, 2, width, 23);
    g.fill(0xffffff);
    g.stroke({ width: 1, color: 0xd6d3d1 });
  }
}
