/**
 * The office keeps real time (docs/plan/spec.md 「작업 공간 기믹」,
 * 2026-11-02): the wall clock shows the local time, at lunch (12–13) whoever
 * is on a break eats a lunch box in the cafe, and working on past 19 o'clock
 * turns the desk lamps on and brings a pizza. Pure: no three.js.
 */

export type DayPart = "day" | "lunch" | "night";

/** Lunch runs from noon to one o'clock. */
export const LUNCH_FROM = 12;
export const LUNCH_UNTIL = 13;
/** The night runs from seven in the evening to six in the morning. */
export const NIGHT_FROM = 19;
export const NIGHT_UNTIL = 6;

/** What part of the day it is by the local clock. */
export function dayPart(date: Date): DayPart {
  const hour = date.getHours();
  if (hour >= LUNCH_FROM && hour < LUNCH_UNTIL) return "lunch";
  if (hour >= NIGHT_FROM || hour < NIGHT_UNTIL) return "night";
  return "day";
}

/**
 * Where the clock's hands point, in radians clockwise from twelve: the hour
 * hand moves on with the minutes, the minute hand with the seconds.
 */
export function clockAngles(date: Date): {
  hour: number;
  minute: number;
  second: number;
} {
  const seconds = date.getSeconds();
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;
  const turn = Math.PI * 2;
  return {
    hour: (hours / 12) * turn,
    minute: (minutes / 60) * turn,
    second: (seconds / 60) * turn,
  };
}

/** When tonight began (ms): seven o'clock today, or yesterday before dawn. */
export function nightStart(date: Date): number {
  const start = new Date(date);
  start.setHours(NIGHT_FROM, 0, 0, 0);
  if (date.getHours() < NIGHT_UNTIL) start.setDate(start.getDate() - 1);
  return start.getTime();
}

/** Whether someone has worked tonight: it is night and work came in since it began. */
export function workedTonight(lastWorkAt: number | null, date: Date): boolean {
  return (
    lastWorkAt !== null &&
    dayPart(date) === "night" &&
    lastWorkAt >= nightStart(date)
  );
}

/** Event kinds that are work: a prompt, or a tool starting or ending. */
const WORK_EVENTS = new Set([
  "user_prompt_submit",
  "pre_tool_use",
  "post_tool_use",
]);

/** When the session last saw work (ms), from its log (newest first). */
export function lastWorkAt(
  eventLog: readonly { type: string; timestamp: Date }[],
): number | null {
  const entry = eventLog.find((e) => WORK_EVENTS.has(e.type));
  return entry ? entry.timestamp.getTime() : null;
}
