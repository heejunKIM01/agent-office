/**
 * The approval board for pull requests (docs/plan/spec.md 「작업 공간 기믹」,
 * 2026-11-02): when ``gh pr create`` goes through, Claude brings a board
 * with the pull request's title to my desk, and when it is merged the board
 * gets a stamp. Pure: no three.js.
 */

/** A shell command that opens a pull request. */
export function isPrCreateCommand(command: unknown): boolean {
  return typeof command === "string" && /\bgh\s+pr\s+create\b/.test(command);
}

/** A shell command that merges a pull request. */
export function isPrMergeCommand(command: unknown): boolean {
  return typeof command === "string" && /\bgh\s+pr\s+merge\b/.test(command);
}

/**
 * The title a ``gh pr create`` command gives (``--title``/``-t``, quoted or
 * not), or the command itself when it gives none (``--fill``).
 */
export function prTitle(command: string): string {
  const create = /\bgh\s+pr\s+create\b/.exec(command);
  const rest = create ? command.slice(create.index) : command;
  const quoted = /(?:--title|-t)(?:\s+|=)(["'])([\s\S]*?)\1/.exec(rest);
  if (quoted) return quoted[2].split("\n")[0].trim();
  const bare = /(?:--title|-t)(?:\s+|=)([^\s"'-][^\s]*)/.exec(rest);
  if (bare) return bare[1];
  return "gh pr create";
}

export interface Approval {
  /** The latest pull request opened: its log id, title and when (ms). */
  created: { id: string; title: string; at: number } | null;
  /** A merge that went through after it: its log id and when (ms). */
  merged: { id: string; at: number } | null;
}

export const NO_APPROVAL: Approval = { created: null, merged: null };

/**
 * The latest pull request the session opened, and whether a merge went
 * through after it (the log is newest first). Failed commands do not count.
 */
export function latestApproval(
  eventLog: readonly {
    id: string;
    type: string;
    timestamp: Date;
    detail?: { toolInput?: unknown; errorType?: string };
  }[],
): Approval {
  let merged: Approval["merged"] = null;
  for (const entry of eventLog) {
    if (entry.type !== "post_tool_use" || entry.detail?.errorType) continue;
    const input = entry.detail?.toolInput as { command?: unknown } | undefined;
    const command = input?.command;
    if (isPrMergeCommand(command)) {
      merged ??= { id: entry.id, at: entry.timestamp.getTime() };
      continue;
    }
    if (isPrCreateCommand(command)) {
      return {
        created: {
          id: entry.id,
          title: prTitle(command as string),
          at: entry.timestamp.getTime(),
        },
        merged,
      };
    }
  }
  return NO_APPROVAL;
}

/** Once at my desk, Claude hands the board over and stays this long (ms). */
export const HANDOVER_MS = 2_500;
/** Claude gives up the errand after this long, wherever it got to (ms). */
export const VISIT_MAX_MS = 30_000;

/** Claude's errand to my desk with the board, from when it set off (ms). */
export interface Visit {
  since: number;
  /** When it leaves my desk again, once it got there; null on the way. */
  until: number | null;
}

/**
 * Step the errand: it ends ``HANDOVER_MS`` after Claude reaches my desk, or
 * after ``VISIT_MAX_MS`` in any case. ``handedOver`` is true the frame
 * Claude gets there.
 */
export function stepVisit(
  visit: Visit,
  now: number,
  atMyDesk: boolean,
): { visit: Visit | null; handedOver: boolean } {
  if (now - visit.since > VISIT_MAX_MS)
    return { visit: null, handedOver: false };
  if (visit.until === null) {
    return atMyDesk
      ? { visit: { ...visit, until: now + HANDOVER_MS }, handedOver: true }
      : { visit, handedOver: false };
  }
  return { visit: now < visit.until ? visit : null, handedOver: false };
}
