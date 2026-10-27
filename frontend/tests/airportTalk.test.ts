import { describe, expect, it } from "vitest";
import {
  myQuestion,
  RECENT_TALK_MS,
  talkLine,
  type AirportWords,
  type TalkInput,
} from "@/systems/airportTalk";

const words: AirportWords = {
  takeoff: "이륙 허가",
  landing: "착륙 허가",
  reading: "운항 기록 확인",
  editing: "비행 계획 수정",
  running: "지상 작업",
  browsing: "기상 · 외부 교신",
  planning: "운항 계획",
  asking: "게이트 호출",
  thinking: (s) => `판단 중 ${s}s`,
  trouble: "이상 발생",
  done: "임무 완료!",
  handover: "교대 인수인계 중",
  called: "관제탑 호출",
  announce: "안내 방송 중",
};

const input = (over: Partial<TalkInput>): TalkInput => ({
  activity: null,
  bubble: null,
  bubbleAgeMs: null,
  stuck: false,
  thinkingSeconds: null,
  ...over,
});

describe("talkLine", () => {
  it("says each tool the airport's way, with what it works on", () => {
    expect(
      talkLine(
        input({
          activity: "reading",
          bubble: { type: "thought", icon: "📖", text: "src/auth.ts" },
          bubbleAgeMs: 100,
        }),
        words,
      ),
    ).toEqual({
      icon: "📋",
      text: "운항 기록 확인",
      detail: "src/auth.ts",
      tone: "work",
    });
    expect(talkLine(input({ activity: "running" }), words)).toMatchObject({
      icon: "🛠️",
      text: "지상 작업",
      detail: null,
    });
    expect(talkLine(input({ activity: "asking" }), words)?.text).toBe(
      "게이트 호출",
    );
  });

  it("shows trouble over everything while a failed tool keeps it stuck", () => {
    expect(
      talkLine(
        input({
          activity: "running",
          stuck: true,
          bubble: { type: "thought", text: "npm test" },
        }),
        words,
      ),
    ).toEqual({
      icon: "⚠️",
      text: "이상 발생",
      detail: "npm test",
      tone: "alert",
    });
  });

  it("shows a fresh thought or reply, then how long it has been thinking", () => {
    const thought = {
      type: "thought",
      icon: "💭",
      text: "어디부터 볼까",
    } as const;
    expect(
      talkLine(input({ bubble: thought, bubbleAgeMs: 1000 }), words),
    ).toMatchObject({ icon: "🎧", text: "어디부터 볼까", tone: "think" });
    expect(
      talkLine(
        input({
          bubble: { type: "speech", text: "끝났어요" },
          bubbleAgeMs: 1000,
        }),
        words,
      ),
    ).toMatchObject({ icon: "💬", text: "끝났어요", tone: "say" });
    expect(
      talkLine(
        input({
          bubble: thought,
          bubbleAgeMs: RECENT_TALK_MS + 1,
          thinkingSeconds: 12,
        }),
        words,
      ),
    ).toMatchObject({ text: "판단 중 12s", tone: "think" });
    expect(talkLine(input({}), words)).toBeNull();
  });

  it("leaves my question to me: it is not the agent speaking", () => {
    const question = { type: "speech", icon: "📞", text: "고마워!" } as const;
    expect(myQuestion(question)).toBe("고마워!");
    expect(
      talkLine(input({ bubble: question, bubbleAgeMs: 500 }), words),
    ).toBeNull();
    const reply = { ...question, persistent: true };
    expect(myQuestion(reply)).toBeNull();
    expect(
      talkLine(input({ bubble: reply, bubbleAgeMs: 500 }), words)?.tone,
    ).toBe("say");
  });
});
