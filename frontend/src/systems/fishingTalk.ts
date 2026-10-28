/**
 * What the fishing spot's tags say (설정 「장소」 · 낚시터): the tool someone
 * is running put the angler's way. Reading files is looking for a spot
 * from the pontoon, editing is fishing from a seat, commands are the
 * shrimp net, the web and outside tools are buying bait at the office,
 * plans and to-dos are the meeting at the chalkboard, and a question for
 * me is the boss calling the guest. The rules (thoughts, replies, trouble)
 * are systems/placeTalk.ts', shared with the other places.
 */

import type { Activity } from "@/types";
import { talkLine, type TalkInput, type TalkLine } from "./placeTalk";

/** Words the fishing spot needs, already translated. */
export interface FishingWords {
  /** What each kind of tool is at the fishing spot. */
  reading: string;
  editing: string;
  running: string;
  browsing: string;
  planning: string;
  asking: string;
  /** 「찌 보는 중 Ns」 */
  thinking: (seconds: number) => string;
  /** A failed tool: 「줄 엉킴」. */
  trouble: string;
  /** An angler done with its work, on its way out: 「철수!」. */
  done: string;
  /** The conversation being compacted: 「조행기 정리 중」. */
  handover: string;
  /** Me, when the boss calls me: 「사장님 호출」. */
  called: string;
  /** Me, passing on my question: 「손님 요청」. */
  request: string;
  /** Codes on the boss's and my tags: 「사장」 and 「손님」. */
  boss: string;
  guest: string;
}

export const FISHING_ICONS: Record<Activity, string> = {
  reading: "🔎",
  editing: "🎣",
  running: "🦐",
  browsing: "🪱",
  planning: "📋",
  asking: "📻",
};

/** The line a fishing spot tag shows now, or null for none. */
export function fishingLine(
  input: TalkInput,
  words: FishingWords,
): TalkLine | null {
  return talkLine(input, {
    words,
    icons: FISHING_ICONS,
    thinkIcon: "🤔",
    thinking: words.thinking,
    trouble: words.trouble,
  });
}
