import { describe, expect, it } from "vitest";
import { siteLine, type SiteWords } from "@/systems/siteTalk";

const words: SiteWords = {
  reading: "도면 확인",
  editing: "시공",
  running: "장비 가동",
  browsing: "자재 조달",
  planning: "공정 회의",
  asking: "건축주 호출",
  thinking: (s) => `검토 중 ${s}s`,
  trouble: "작업 중단",
  done: "작업 완료!",
  handover: "작업 일지 정리 중",
  called: "현장 호출",
  request: "요청 전달 중",
  manager: "소장",
  owner: "건축주",
};

describe("siteLine", () => {
  it("says each tool the site's way, with what it works on", () => {
    expect(
      siteLine(
        {
          activity: "editing",
          bubble: { type: "thought", icon: "✏️", text: "src/app.ts" },
          bubbleAgeMs: 100,
          stuck: false,
          thinkingSeconds: null,
        },
        words,
      ),
    ).toEqual({ icon: "🧱", text: "시공", detail: "src/app.ts", tone: "work" });
  });

  it("thinks the site's way, and stops work while a tool keeps failing", () => {
    const base = {
      activity: null,
      bubble: null,
      bubbleAgeMs: null,
      stuck: false,
    };
    expect(siteLine({ ...base, thinkingSeconds: 7 }, words)).toMatchObject({
      icon: "🤔",
      text: "검토 중 7s",
    });
    expect(
      siteLine(
        { ...base, activity: "running", stuck: true, thinkingSeconds: null },
        words,
      ),
    ).toMatchObject({ icon: "⚠️", text: "작업 중단", tone: "alert" });
  });
});
