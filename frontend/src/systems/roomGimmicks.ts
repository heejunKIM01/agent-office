/**
 * Small touches in the rooms while people work (docs/plan/spec.md 「작업
 * 공간 기믹」): when they show is decided here, how they look in the
 * character and room code.
 */

/** A command running this long has the one waiting at the rack check its watch (ms). */
export const WATCH_AFTER_MS = 10_000;

/** Waiting at the rack for a long command: arms crossed, an eye on the watch. */
export function watchesTheClock(runningForMs: number): boolean {
  return runningForMs >= WATCH_AFTER_MS;
}
