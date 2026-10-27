/**
 * What the airport's data tags say (설정 「장소」 · 공항): the tool a person
 * or plane is running, put the airport's way. Reading files is checking the
 * flight records, editing is amending the flight plan, commands are ground
 * work, the web and outside tools are the weather and outside calls,
 * planning is the operations plan, and a question for me is a call to the
 * gate. A thinking summary or a reply shows for a while after it comes,
 * and a failed tool shows as trouble. Pure, so the scene and the tests
 * share it.
 */

import type { Activity, BubbleContent } from "@/types";

/** Words the airport needs, already translated. */
export interface AirportWords {
  /** 「이륙 허가」 and 「착륙 허가」 on the tower's radio. */
  takeoff: string;
  landing: string;
  /** What each kind of tool is at the airport. */
  reading: string;
  editing: string;
  running: string;
  browsing: string;
  planning: string;
  asking: string;
  /** 「판단 중 Ns」 */
  thinking: (seconds: number) => string;
  /** A failed tool: 「이상 발생」. */
  trouble: string;
  /** A plane done with its work on its way to the gate: 「임무 완료!」. */
  done: string;
  /** The conversation being compacted: 「교대 인수인계 중」. */
  handover: string;
  /** Me, when the tower calls the gate: 「관제탑 호출」. */
  called: string;
  /** Me, announcing my question over the PA: 「안내 방송 중」. */
  announce: string;
}

export const ACTIVITY_ICONS: Record<Activity, string> = {
  reading: "📋",
  editing: "✏️",
  running: "🛠️",
  browsing: "🌦️",
  planning: "🗂️",
  asking: "📞",
};

/** One line of a data tag: an icon, what is going on and on what. */
export interface TalkLine {
  icon: string;
  text: string;
  detail: string | null;
  tone: "work" | "think" | "say" | "alert";
}

export interface TalkInput {
  activity: Activity | null;
  bubble: Pick<BubbleContent, "type" | "text" | "icon" | "persistent"> | null;
  /** How long ago that bubble came (ms). */
  bubbleAgeMs: number | null;
  stuck: boolean;
  /** Seconds it has been thinking, or null when it is not. */
  thinkingSeconds: number | null;
}

/** How long a thinking summary or a reply stays up after it comes (ms). */
export const RECENT_TALK_MS = 8000;

/** Thinking summaries from the transcript carry this icon. */
const THINKING_ICON = "💭";
/**
 * The lead agent's speech carries this icon both for my question (at the
 * start of a turn) and for its reply (when the turn ends); only the reply
 * stays, so a passing one is my question, not the agent speaking.
 */
const PHONE_ICON = "📞";

/** My question, when the bubble is it rather than the agent's own words. */
export function myQuestion(
  bubble: Pick<BubbleContent, "type" | "text" | "icon" | "persistent"> | null,
): string | null {
  return bubble?.type === "speech" &&
    bubble.icon === PHONE_ICON &&
    !bubble.persistent
    ? bubble.text
    : null;
}

/** The line a tag shows now, or null for none. */
export function talkLine(
  input: TalkInput,
  words: AirportWords,
): TalkLine | null {
  const { activity, bubble, bubbleAgeMs, stuck, thinkingSeconds } = input;
  const recent = bubbleAgeMs !== null && bubbleAgeMs < RECENT_TALK_MS;
  if (stuck) {
    return {
      icon: "⚠️",
      text: words.trouble,
      detail: bubble?.text ?? null,
      tone: "alert",
    };
  }
  if (activity) {
    const target =
      bubble?.type === "thought" && bubble.icon !== THINKING_ICON
        ? bubble.text
        : null;
    return {
      icon: ACTIVITY_ICONS[activity],
      text: words[activity],
      detail: target,
      tone: "work",
    };
  }
  if (bubble?.type === "thought" && bubble.icon === THINKING_ICON && recent) {
    return { icon: "🎧", text: bubble.text, detail: null, tone: "think" };
  }
  if (bubble?.type === "speech" && recent && myQuestion(bubble) === null) {
    return { icon: "💬", text: bubble.text, detail: null, tone: "say" };
  }
  if (thinkingSeconds !== null) {
    return {
      icon: "🎧",
      text: words.thinking(thinkingSeconds),
      detail: null,
      tone: "think",
    };
  }
  return null;
}

/** Whole seconds from ``at`` to ``now`` (ms), never below zero. */
export const secondsBetween = (at: number, now: number): number =>
  Math.max(0, Math.floor((now - at) / 1000));
