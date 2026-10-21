import { describe, expect, it } from "vitest";
import { WATCH_AFTER_MS, watchesTheClock } from "../src/systems/roomGimmicks";

describe("watchesTheClock", () => {
  it("checks the watch only once a command has run for a while", () => {
    expect(watchesTheClock(0)).toBe(false);
    expect(watchesTheClock(WATCH_AFTER_MS - 1)).toBe(false);
    expect(watchesTheClock(WATCH_AFTER_MS)).toBe(true);
  });
});
