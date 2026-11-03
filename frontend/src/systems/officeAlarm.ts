/**
 * The alarm on risky commands (docs/plan/spec.md 「작업 공간 기믹」,
 * 2026-11-02): when Claude runs ``git push --force``, ``git reset --hard`` or
 * ``rm -rf``, the warning light up on the back wall spins and everyone turns
 * to look at it. Pure: no three.js.
 */

/** How long the light spins and everyone looks (ms). */
export const ALARM_MS = 4_000;

/** The command without quoted text or heredoc bodies, which only say things. */
function spoken(command: string): string {
  return command
    .replace(/<<-?\s*['"]?(\w+)['"]?[^\n]*\n[\s\S]*?\n\s*\1\s*(?=\n|$)/g, "")
    .replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, '""');
}

/** The one-letter flags among ``tokens`` (``-rf`` gives r and f). */
function shortFlags(tokens: readonly string[]): Set<string> {
  const letters = new Set<string>();
  for (const token of tokens) {
    if (/^-[A-Za-z]+$/.test(token)) {
      for (const letter of token.slice(1)) letters.add(letter);
    }
  }
  return letters;
}

/** One simple command's words: whether they force a push, reset hard or remove recursively. */
function risky(tokens: readonly string[]): boolean {
  const git = tokens.indexOf("git");
  if (git >= 0) {
    const rest = tokens.slice(git + 1);
    const forced =
      rest.some((t) => t === "--force" || t.startsWith("--force-with-lease")) ||
      shortFlags(rest).has("f");
    if (rest.includes("push") && forced) return true;
    if (rest.includes("reset") && rest.includes("--hard")) return true;
  }
  const rm = tokens.indexOf("rm");
  if (rm >= 0) {
    const rest = tokens.slice(rm + 1);
    const flags = shortFlags(rest);
    const recursive =
      flags.has("r") || flags.has("R") || rest.includes("--recursive");
    const force = flags.has("f") || rest.includes("--force");
    if (recursive && force) return true;
  }
  return false;
}

/**
 * A shell command that forces a push (``--force``, ``--force-with-lease``,
 * ``-f``), resets hard or removes recursively and by force (``rm -rf``), in
 * any of its parts (``&&``, ``;``, pipes, lines). Words inside quotes or a
 * heredoc (a commit message) do not count.
 */
export function isRiskyCommand(command: unknown): boolean {
  if (typeof command !== "string") return false;
  return spoken(command)
    .split(/\n|;|&&|\|\||\|/)
    .some((part) => risky(part.trim().split(/\s+/).filter(Boolean)));
}

/** The session's latest risky command as Claude starts it: its log id and when (ms); null otherwise. */
export function latestAlarm(
  eventLog: readonly {
    id: string;
    type: string;
    timestamp: Date;
    detail?: { toolInput?: unknown };
  }[],
): { id: string; at: number } | null {
  for (const entry of eventLog) {
    if (entry.type !== "pre_tool_use") continue;
    const input = entry.detail?.toolInput as { command?: unknown } | undefined;
    if (isRiskyCommand(input?.command)) {
      return { id: entry.id, at: entry.timestamp.getTime() };
    }
  }
  return null;
}

/** The turn (rad, about the vertical) that has someone at ``from`` face ``to``. */
export function faceToward(
  from: { x: number; z: number },
  to: { x: number; z: number },
): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}
