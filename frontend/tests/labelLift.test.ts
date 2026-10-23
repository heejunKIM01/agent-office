import { describe, expect, it } from "vitest";
import { MAX_LIFT, liftLabels, type LabelBox } from "@/systems/labelLift";

/** A 100×20 chip with its bottom centre at (x, y), and a 160×60 bubble when ``says``. */
const box = (id: string, x: number, y: number, says = false): LabelBox => ({
  id,
  x,
  y,
  chip: { width: 100, height: 20 },
  bubble: says ? { width: 160, height: 60 } : null,
});

describe("liftLabels", () => {
  it("leaves people whose labels do not touch where they are", () => {
    const lifts = liftLabels([box("a", 0, 100), box("b", 300, 100, true)]);
    expect([...lifts]).toEqual([
      ["a", { by: 0, hush: false }],
      ["b", { by: 0, hush: false }],
    ]);
  });

  it("lifts the farther label (higher on the screen) clear of the nearer", () => {
    const lifts = liftLabels([box("b", 30, 90), box("a", 0, 100)]);
    expect(lifts.get("a")).toEqual({ by: 0, hush: false });
    // b's chip bottom (90) goes 4px above a's chip top (80).
    expect(lifts.get("b")).toEqual({ by: 14, hush: false });
  });

  it("stacks a crowd, each clear of every nearer one where it now is", () => {
    const lifts = liftLabels([
      box("c", 20, 80, true),
      box("b", 10, 90, true),
      box("a", 0, 100, true),
    ]);
    expect(lifts.get("a")?.by).toBe(0);
    // b (30..90) over a (40..100): b's bottom to 36.
    expect(lifts.get("b")?.by).toBe(54);
    // c clears a, then b where b was lifted to (-24..36): bottom to -28.
    expect(lifts.get("c")?.by).toBe(108);
  });

  it("keeps only the chip of one that would float away to clear the crowd", () => {
    const lifts = liftLabels([
      box("d", 30, 70, true),
      box("c", 20, 80, true),
      box("b", 10, 90, true),
      box("a", 0, 100, true),
    ]);
    const d = lifts.get("d");
    expect(d?.hush).toBe(true);
    expect(d?.by).toBeLessThanOrEqual(MAX_LIFT);
    expect([...lifts.values()].filter((lift) => lift.hush)).toHaveLength(1);
  });
});
