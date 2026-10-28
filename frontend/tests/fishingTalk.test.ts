import { describe, expect, it } from "vitest";
import { fishingLine, type FishingWords } from "@/systems/fishingTalk";

const words: FishingWords = {
  reading: "포인트 탐색",
  editing: "낚시 중",
  running: "채집망",
  browsing: "미끼 사기",
  planning: "출조 회의",
  asking: "손님 호출",
  thinking: (s) => `찌 보는 중 ${s}s`,
  trouble: "줄 엉킴",
  done: "철수!",
  handover: "조행기 정리 중",
  called: "사장님 호출",
  request: "손님 요청",
  boss: "사장",
  guest: "손님",
};

const idle = { activity: null, bubble: null, bubbleAgeMs: null, stuck: false };

describe("fishingLine", () => {
  it("says each tool the angler's way, with what it works on", () => {
    expect(
      fishingLine(
        {
          activity: "editing",
          bubble: { type: "thought", icon: "✏️", text: "src/app.ts" },
          bubbleAgeMs: 100,
          stuck: false,
          thinkingSeconds: null,
        },
        words,
      ),
    ).toEqual({
      icon: "🎣",
      text: "낚시 중",
      detail: "src/app.ts",
      tone: "work",
    });
    expect(
      fishingLine(
        { ...idle, activity: "running", thinkingSeconds: null },
        words,
      ),
    ).toMatchObject({ icon: "🦐", text: "채집망" });
  });

  it("watches the float while thinking, and tangles while a tool keeps failing", () => {
    expect(fishingLine({ ...idle, thinkingSeconds: 7 }, words)).toMatchObject({
      icon: "🤔",
      text: "찌 보는 중 7s",
    });
    expect(
      fishingLine(
        { ...idle, activity: "browsing", stuck: true, thinkingSeconds: null },
        words,
      ),
    ).toMatchObject({ icon: "⚠️", text: "줄 엉킴", tone: "alert" });
  });
});
