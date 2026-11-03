/**
 * The printer in the dev room (docs/plan/spec.md 「작업 공간 기믹」, 2026-11-02):
 * when anyone in the session writes a file that was not there, the printer
 * prints a sheet with the file's name and it lands in the tray on top.
 * Pure: no three.js.
 */

import { FRESH_MS } from "./roomGimmicks";

/** The tray on top of the printer holds this many sheets. */
export const MAX_PRINTOUTS = 6;

/** How long a sheet takes to come out of the slot (ms). */
export const PRINT_MS = 2_400;

export interface Printout {
  id: string;
  /** The new file's name, without its folders. */
  name: string;
  /** When the file was written (ms). */
  at: number;
}

/** The last part of ``path`` (``src/a/b.ts`` → ``b.ts``), or null when there is none. */
export function fileName(path: unknown): string | null {
  if (typeof path !== "string") return null;
  const parts = path.split(/[\\/]/).filter((part) => part !== "");
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

/**
 * The session's new files: how many, and the latest one (the log is newest
 * first). A Write counts only when it made a file that was not there and
 * went through.
 */
export function printouts(
  eventLog: readonly {
    id: string;
    type: string;
    timestamp: Date;
    detail?: { toolInput?: unknown; errorType?: string; fileCreated?: boolean };
  }[],
): { count: number; last: Printout | null } {
  let count = 0;
  let last: Printout | null = null;
  for (const entry of eventLog) {
    if (entry.type !== "post_tool_use") continue;
    if (!entry.detail?.fileCreated || entry.detail.errorType) continue;
    const input = entry.detail.toolInput as { file_path?: unknown } | undefined;
    const name = fileName(input?.file_path);
    if (name === null) continue;
    count += 1;
    last ??= { id: entry.id, name, at: entry.timestamp.getTime() };
  }
  return { count, last };
}

/** Whether a new printout is one to print now: unseen and just written. */
export function isFreshPrintout(
  last: Printout | null,
  seen: string | null,
  now: number,
): last is Printout {
  return last !== null && last.id !== seen && now - last.at < FRESH_MS;
}

/** How far the sheet being printed has come out of the slot, from 0 to 1. */
export function printProgress(startedAt: number, now: number): number {
  return Math.min(1, Math.max(0, (now - startedAt) / PRINT_MS));
}
