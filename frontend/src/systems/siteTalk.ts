/**
 * What the construction site's tags say (설정 「장소」 · 건설 현장): the tool
 * someone is running put the site's way. Reading files is checking the
 * drawings, editing is building, commands run the machines, the web and
 * outside tools are ordering materials, plans and to-dos are the schedule
 * meeting, and a question for me is a call to the owner. The rules
 * (thoughts, replies, trouble) are systems/placeTalk.ts', shared with the
 * other places.
 */

import type { Activity } from "@/types";
import { talkLine, type TalkInput, type TalkLine } from "./placeTalk";

/** Words the site needs, already translated. */
export interface SiteWords {
  /** What each kind of tool is on the site. */
  reading: string;
  editing: string;
  running: string;
  browsing: string;
  planning: string;
  asking: string;
  /** 「검토 중 Ns」 */
  thinking: (seconds: number) => string;
  /** A failed tool: 「작업 중단」. */
  trouble: string;
  /** A worker done with its work, on its way out: 「작업 완료!」. */
  done: string;
  /** The conversation being compacted: 「작업 일지 정리 중」. */
  handover: string;
  /** Me, when the site manager calls me: 「현장 호출」. */
  called: string;
  /** Me, passing on my question: 「요청 전달 중」. */
  request: string;
  /** Codes on the manager's and my tags: 「소장」 and 「건축주」. */
  manager: string;
  owner: string;
}

export const SITE_ICONS: Record<Activity, string> = {
  reading: "📐",
  editing: "🧱",
  running: "🚜",
  browsing: "📦",
  planning: "📋",
  asking: "📞",
};

/** The line a site tag shows now, or null for none. */
export function siteLine(input: TalkInput, words: SiteWords): TalkLine | null {
  return talkLine(input, {
    words,
    icons: SITE_ICONS,
    thinkIcon: "🤔",
    thinking: words.thinking,
    trouble: words.trouble,
  });
}
