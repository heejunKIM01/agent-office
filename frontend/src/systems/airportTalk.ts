/**
 * What the airport's data tags say (설정 「장소」 · 공항): the tool a person
 * or plane is running, put the airport's way. Reading files is checking the
 * flight records, editing is amending the flight plan, commands are ground
 * work, the web and outside tools are the weather and outside calls,
 * planning is the operations plan, and a question for me is a call to the
 * gate. The rules (thoughts, replies, trouble) are systems/placeTalk.ts',
 * shared with the other places.
 */

import type { Activity } from "@/types";
import {
  talkLine as placeLine,
  type PlaceTalk,
  type TalkInput,
  type TalkLine,
} from "./placeTalk";

export {
  myQuestion,
  RECENT_TALK_MS,
  secondsBetween,
  type TalkInput,
  type TalkLine,
} from "./placeTalk";

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

/** The airport's way of saying what someone is doing. */
function airportTalk(words: AirportWords): PlaceTalk {
  return {
    words,
    icons: ACTIVITY_ICONS,
    thinkIcon: "🎧",
    thinking: words.thinking,
    trouble: words.trouble,
  };
}

/** The line an airport tag shows now, or null for none. */
export function talkLine(
  input: TalkInput,
  words: AirportWords,
): TalkLine | null {
  return placeLine(input, airportTalk(words));
}
