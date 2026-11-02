import { describe, expect, it } from "vitest";
import { bowAngle, isPushback, lastPushback } from "../src/systems/officeBow";

describe("isPushback", () => {
  it("is a prompt that starts with 아니, 왜 or 다시", () => {
    expect(
      ["아니 그게 아니라", "왜 또 깨졌어?", "다시 해줘", "  아니요"].map(
        isPushback,
      ),
    ).toEqual([true, true, true, true]);
  });

  it("is not one that only has them later, or says thanks", () => {
    expect(
      ["이건 아니야", "그거 왜 했어", "아니 고마워", "", undefined].map(
        isPushback,
      ),
    ).toEqual([false, false, false, false, false]);
  });
});

describe("lastPushback", () => {
  const prompt = (id: string, text: string, at: number) => ({
    id,
    type: "user_prompt_submit",
    timestamp: new Date(at),
    detail: { prompt: text },
  });

  it("takes my latest prompt when it pushed back", () => {
    const log = [prompt("b", "다시 해줘", 2000), prompt("a", "고쳐줘", 1000)];
    expect(lastPushback(log)).toEqual({ id: "b", at: 2000 });
  });

  it("is null once a later prompt does not push back", () => {
    const log = [prompt("b", "좋아", 2000), prompt("a", "아니야", 1000)];
    expect(lastPushback(log)).toBeNull();
  });
});

describe("bowAngle", () => {
  it("bows down and up twice", () => {
    expect(bowAngle(0)).toBe(0);
    expect(bowAngle(0.25)).toBeCloseTo(0.7);
    expect(bowAngle(0.5)).toBeCloseTo(0);
    expect(bowAngle(0.75)).toBeCloseTo(0.7);
    expect(bowAngle(1)).toBe(0);
  });
});
