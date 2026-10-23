import { describe, expect, it } from "vitest";
import { MAX_LIFT, liftLabels, type LabelBox } from "@/systems/labelLift";

const box = (
  id: string,
  left: number,
  top: number,
  width = 100,
  height = 40,
): LabelBox => ({ id, left, right: left + width, top, bottom: top + height });

describe("liftLabels", () => {
  it("leaves boxes that do not touch where they are", () => {
    const lifts = liftLabels([box("a", 0, 100), box("b", 200, 100)]);
    expect([...lifts]).toEqual([
      ["a", 0],
      ["b", 0],
    ]);
  });

  it("lifts the farther box (higher on the screen) clear of the nearer", () => {
    // b is drawn 10px above a and overlaps it.
    const lifts = liftLabels([box("b", 30, 90), box("a", 0, 100)]);
    expect(lifts.get("a")).toBe(0);
    // b's bottom (130) goes 4px above a's top (100).
    expect(lifts.get("b")).toBe(34);
  });

  it("stacks a crowd, each clear of every nearer one", () => {
    const lifts = liftLabels([
      box("c", 20, 80),
      box("b", 10, 90),
      box("a", 0, 100),
    ]);
    expect(lifts.get("a")).toBe(0);
    expect(lifts.get("b")).toBe(34);
    // Clear of b where b now is, not where it was drawn.
    expect(lifts.get("c")).toBe(68);
  });

  it("lifts no further than a box can go and still belong to its person", () => {
    const crowd = ["e", "d", "c", "b", "a"].map((id, i) =>
      box(id, i, 80 + i * 5),
    );
    const lifts = liftLabels(crowd);
    expect(Math.max(...lifts.values())).toBe(MAX_LIFT);
  });
});
