/**
 * The pot on my desk grows with the day's commits (docs/plan/spec.md
 * 「작업 공간 기믹」, 2026-11-02): a sprout with no commits yet, taller and
 * leafier with each few, a bud and then a flower, and a sprout again the
 * next day. Pure: no three.js.
 */

import { FRESH_MS, isCommitCommand } from "./roomGimmicks";

/** Commits it takes to reach each stage: sprout, seedling, leafy, bud, flower. */
export const STAGE_AT = [0, 1, 3, 5, 8] as const;
export type PlantStage = 0 | 1 | 2 | 3 | 4;

/** The plant's stage for ``commits`` made today. */
export function plantStage(commits: number): PlantStage {
  let stage = 0;
  STAGE_AT.forEach((needed, i) => {
    if (commits >= needed) stage = i;
  });
  return stage as PlantStage;
}

/** When the session's commits went through (ms), newest first. */
export function commitTimes(
  eventLog: readonly {
    type: string;
    timestamp: Date;
    detail?: { toolInput?: unknown; errorType?: string };
  }[],
): number[] {
  const times: number[] = [];
  for (const entry of eventLog) {
    if (entry.type !== "post_tool_use" || entry.detail?.errorType) continue;
    const input = entry.detail?.toolInput as { command?: unknown } | undefined;
    if (isCommitCommand(input?.command)) times.push(entry.timestamp.getTime());
  }
  return times;
}

/** How many of ``times`` fall on ``date``'s day (local midnight to midnight). */
export function commitsToday(times: readonly number[], date: Date): number {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return times.filter((t) => t >= start.getTime() && t < end.getTime()).length;
}

/**
 * Whether one of ``times`` went through within the last minute of ``date``: a
 * stage reached then pops up, while a session opened on older commits just
 * shows its stage once they have loaded.
 */
export function committedJustNow(
  times: readonly number[],
  date: Date,
): boolean {
  const now = date.getTime();
  return times.some((t) => now - t < FRESH_MS);
}
