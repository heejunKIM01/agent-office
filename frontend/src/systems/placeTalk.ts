/**
 * What a place's tags say about a person (설정 「장소」): the tool it is
 * running in that place's own words and icons, a thinking summary or a
 * reply for a while after it comes, how long it has been thinking, and
 * trouble while a failed tool keeps it stuck. Each place (the airport, the
 * construction site) brings its words; the rules are shared. Pure.
 */

import type { Activity, BubbleContent } from "@/types";

/** One line of a tag: an icon, what is going on and on what. */
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

/** A place's way of saying what someone is doing. */
export interface PlaceTalk {
  /** What each kind of tool is there, and its icon. */
  words: Record<Activity, string>;
  icons: Record<Activity, string>;
  /** The icon for thinking, and 「Ns」 put the place's way. */
  thinkIcon: string;
  thinking: (seconds: number) => string;
  /** A failed tool. */
  trouble: string;
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
export function talkLine(input: TalkInput, talk: PlaceTalk): TalkLine | null {
  const { activity, bubble, bubbleAgeMs, stuck, thinkingSeconds } = input;
  const recent = bubbleAgeMs !== null && bubbleAgeMs < RECENT_TALK_MS;
  if (stuck) {
    return {
      icon: "⚠️",
      text: talk.trouble,
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
      icon: talk.icons[activity],
      text: talk.words[activity],
      detail: target,
      tone: "work",
    };
  }
  if (bubble?.type === "thought" && bubble.icon === THINKING_ICON && recent) {
    return {
      icon: talk.thinkIcon,
      text: bubble.text,
      detail: null,
      tone: "think",
    };
  }
  if (bubble?.type === "speech" && recent && myQuestion(bubble) === null) {
    return { icon: "💬", text: bubble.text, detail: null, tone: "say" };
  }
  if (thinkingSeconds !== null) {
    return {
      icon: talk.thinkIcon,
      text: talk.thinking(thinkingSeconds),
      detail: null,
      tone: "think",
    };
  }
  return null;
}

/** Whole seconds from ``at`` to ``now`` (ms), never below zero. */
export const secondsBetween = (at: number, now: number): number =>
  Math.max(0, Math.floor((now - at) / 1000));
