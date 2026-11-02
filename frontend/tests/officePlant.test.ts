import { describe, expect, it } from "vitest";
import {
  committedJustNow,
  commitTimes,
  commitsToday,
  plantStage,
} from "../src/systems/officePlant";

describe("plantStage", () => {
  it("is a sprout without commits, then grows at 1, 3, 5 and 8", () => {
    expect([0, 1, 2, 3, 4, 5, 7, 8, 20].map(plantStage)).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4, 4,
    ]);
  });
});

describe("commitTimes", () => {
  const post = (command: string, at: number, errorType?: string) => ({
    type: "post_tool_use",
    timestamp: new Date(at),
    detail: { toolInput: { command }, ...(errorType ? { errorType } : {}) },
  });

  it("keeps the commits that went through", () => {
    const log = [
      post('git commit -m "b"', 3000),
      post('git commit -m "x"', 2000, "tool_error"),
      post("git push", 1500),
      post('git commit -m "a"', 1000),
    ];
    expect(commitTimes(log)).toEqual([3000, 1000]);
  });
});

describe("commitsToday", () => {
  const at = (day: number, h: number) => new Date(2026, 10, day, h).getTime();

  it("counts only the day's commits, by the local clock", () => {
    const times = [at(2, 23), at(2, 9), at(2, 0), at(1, 23)];
    expect(commitsToday(times, new Date(2026, 10, 2, 23, 30))).toBe(3);
  });

  it("starts again the next day", () => {
    const times = [at(2, 23), at(2, 9)];
    expect(commitsToday(times, new Date(2026, 10, 3, 0, 5))).toBe(0);
  });
});

describe("committedJustNow", () => {
  const now = new Date(2026, 10, 2, 15, 0, 0);
  const ago = (s: number) => now.getTime() - s * 1000;

  it("is true for a commit within the last minute", () => {
    expect(committedJustNow([ago(5), ago(600)], now)).toBe(true);
  });

  it("is false once the newest commit is a minute old", () => {
    expect(committedJustNow([ago(61), ago(600)], now)).toBe(false);
    expect(committedJustNow([], now)).toBe(false);
  });
});
