/**
 * Claude bows when I push back (docs/plan/spec.md 「작업 공간 기믹」,
 * 2026-11-02): a prompt that starts with 「아니」, 「왜」 or 「다시」 has it
 * break into a sweat and bow its head, the other half of the hearts a thanks
 * brings. Pure: no three.js.
 */

import { isThanks } from "./roomGimmicks";

/** How long Claude bows (ms): down and up twice. */
export const BOW_MS = 2_400;
/** How long a bow waits for Claude to stop walking before it is dropped (ms). */
export const BOW_WAIT_MS = 15_000;
/** How far Claude bends at the bottom of a bow (rad). */
const BOW_DEPTH = 0.7;

/**
 * A prompt that pushes back: it starts with 「아니」, 「왜」 or 「다시」. One
 * that also says thanks (「아니 고마워」) brings hearts instead.
 */
export function isPushback(prompt: unknown): boolean {
  return (
    typeof prompt === "string" &&
    /^\s*(아니|왜|다시)/.test(prompt) &&
    !isThanks(prompt)
  );
}

/** My latest prompt when it pushed back: its log id and when (ms); null otherwise. */
export function lastPushback(
  eventLog: readonly {
    id: string;
    type: string;
    timestamp: Date;
    detail?: { prompt?: string };
  }[],
): { id: string; at: number } | null {
  const prompt = eventLog.find((entry) => entry.type === "user_prompt_submit");
  return prompt && isPushback(prompt.detail?.prompt)
    ? { id: prompt.id, at: prompt.timestamp.getTime() }
    : null;
}

/** How far Claude bends ``t`` (0 to 1) of the way through its bow (rad). */
export function bowAngle(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  return BOW_DEPTH * Math.sin(Math.PI * ((t * 2) % 1));
}
