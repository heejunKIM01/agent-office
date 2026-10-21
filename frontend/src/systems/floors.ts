/**
 * Projects as floors of a building, for the floor guide (docs/plan/spec.md
 * "화면 재설계"): 1F is the project seen first, and each floor's sessions are
 * its shops.
 */

import type { Session } from "@/hooks/useSessions";

export interface Floor {
  /** 1-based floor number; 1F is the project whose first session is oldest. */
  number: number;
  projectKey: string;
  name: string;
  /** Newest first. */
  sessions: Session[];
  /** Whether any of its sessions is still active. */
  active: boolean;
}

function projectKey(session: Session): string {
  return session.projectRoot || session.projectName || session.id;
}

function projectName(session: Session): string {
  if (session.projectName) return session.projectName;
  if (session.projectRoot)
    return session.projectRoot.split("/").filter(Boolean).pop() ?? "";
  return session.id.slice(0, 8);
}

/** Group sessions into floors, listed top floor first like a building directory. */
export function buildFloors(sessions: Session[]): Floor[] {
  const byProject = new Map<string, Session[]>();
  for (const session of sessions) {
    const key = projectKey(session);
    byProject.set(key, [...(byProject.get(key) ?? []), session]);
  }
  const firstSeen = (list: Session[]): number =>
    Math.min(...list.map((s) => Date.parse(s.createdAt)));
  const ordered = [...byProject.entries()].sort(
    ([, a], [, b]) => firstSeen(a) - firstSeen(b),
  );
  return ordered
    .map(([key, list], index): Floor => {
      const newestFirst = [...list].sort(
        (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      );
      return {
        number: index + 1,
        projectKey: key,
        name: projectName(newestFirst[0]),
        sessions: newestFirst,
        active: list.some((s) => s.status === "active"),
      };
    })
    .reverse();
}

/** The floor a session belongs to. */
export function floorOfSession(
  floors: Floor[],
  sessionId: string,
): Floor | undefined {
  return floors.find((floor) => floor.sessions.some((s) => s.id === sessionId));
}
