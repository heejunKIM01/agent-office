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

/** A sticky note on the whiteboard per to-do, coloured by how far it got. */
export type NoteStatus = "pending" | "in_progress" | "completed";

/** The whiteboard holds this many to-do notes. */
export const MAX_NOTES = 12;

/**
 * The notes for a to-do list tool's input: Claude Code's TodoWrite and
 * OpenCode's todowrite and Gemini's write_todos send ``todos``, Codex's
 * update_plan ``plan``; anything else is not a list (null).
 */
export function todoNotes(input: unknown): NoteStatus[] | null {
  if (typeof input !== "object" || input === null) return null;
  const { todos, plan } = input as { todos?: unknown; plan?: unknown };
  const list = Array.isArray(todos) ? todos : Array.isArray(plan) ? plan : null;
  if (!list) return null;
  return list.slice(0, MAX_NOTES).map((item: unknown) => {
    const status = (item as { status?: unknown } | null)?.status;
    return status === "completed" || status === "in_progress"
      ? status
      : "pending";
  });
}

/** The newest to-do list in the log (newest first), or null when there is none. */
export function latestTodoNotes(
  eventLog: readonly { detail?: { toolInput?: unknown } }[],
): NoteStatus[] | null {
  for (const entry of eventLog) {
    const notes = todoNotes(entry.detail?.toolInput);
    if (notes) return notes;
  }
  return null;
}
