/**
 * Projects as floors of a building, for the floor guide (docs/plan/spec.md
 * "화면 재설계"): 1F is the project seen first, and each floor's sessions are
 * its shops.
 */

import type { Session } from "@/hooks/useSessions";

/** An open session counts as working now while its events are this recent. */
export const ACTIVE_NOW_MS = 5 * 60 * 1000;
/** Floors quiet for longer than this fold under 「오래 쉰 층 N개 더 보기」. */
export const IDLE_FLOOR_MS = 60 * 60 * 1000;
/** Sessions ended longer ago than this fold under 「지난 세션 N개 더 보기」. */
export const PAST_SESSION_MS = 60 * 60 * 1000;

/**
 * Whose lead agents the office shows: the chosen session's alone, with the
 * other sessions working on its floor, or with those working on every floor.
 */
export type OfficeView = "session" | "floor" | "building";
export const OFFICE_VIEWS: readonly OfficeView[] = [
  "session",
  "floor",
  "building",
];

export interface Floor {
  /** 1-based floor number; 1F is the project whose first session is oldest. */
  number: number;
  projectKey: string;
  name: string;
  /** Newest first. */
  sessions: Session[];
  /** Whether one of its sessions is working now. */
  active: boolean;
  /** When its newest session last changed, in ms. */
  updatedAt: number;
}

/** Whether a session is open, in the middle of a turn and has just sent events. */
export function isActiveNow(session: Session, now: number): boolean {
  return (
    session.status === "active" &&
    !session.idle &&
    now - Date.parse(session.updatedAt) < ACTIVE_NOW_MS
  );
}

/** What a session is called: its own name, else its first prompt. */
export function sessionTitle(session: Session): string | null {
  return session.label || session.title || null;
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

/**
 * The listed sessions plus the one being shown when the list leaves it out:
 * the backend drops sessions ended by `/clear` or ended with nothing in them,
 * and the floor guide still shows the session the office is on, as ended.
 */
export function keepShownSession(
  listed: Session[],
  previous: Session[],
  shownId: string,
): Session[] {
  if (!shownId || listed.some((s) => s.id === shownId)) return listed;
  const shown = previous.find((s) => s.id === shownId);
  return shown ? [...listed, { ...shown, status: "completed" }] : listed;
}

/** Group sessions into floors, listed top floor first like a building directory. */
export function buildFloors(sessions: Session[], now = Date.now()): Floor[] {
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
        active: list.some((s) => isActiveNow(s, now)),
        updatedAt: Date.parse(newestFirst[0].updatedAt),
      };
    })
    .reverse();
}

/** Another session working now, and its floor's number when the chip shows it. */
export interface ColleagueSession {
  session: Session;
  /** Set when the office has every floor, so you can tell whose it is. */
  floor: number | null;
}

/**
 * The other sessions working now whose lead agents work in the office
 * beside the session shown, newest first: none, those on its floor, or
 * those on every floor.
 */
export function officeColleagues(
  floors: Floor[],
  sessionId: string,
  view: OfficeView,
  now: number,
): ColleagueSession[] {
  if (view === "session") return [];
  const current = floorOfSession(floors, sessionId);
  const shown = view === "building" ? floors : current ? [current] : [];
  return shown
    .flatMap((floor) =>
      floor.sessions.map((session) => ({
        session,
        floor: view === "building" ? floor.number : null,
      })),
    )
    .filter(
      ({ session }) => session.id !== sessionId && isActiveNow(session, now),
    )
    .sort(
      (a, b) =>
        Date.parse(b.session.updatedAt) - Date.parse(a.session.updatedAt),
    );
}

/**
 * How many lead agents each floor has in the office when it holds every
 * floor, by project: the session shown and the others working now. Floors
 * with nobody there are left out.
 */
export function floorHeadcounts(
  floors: Floor[],
  sessionId: string,
  now: number,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const floor of floors) {
    const count = floor.sessions.filter(
      (session) => session.id === sessionId || isActiveNow(session, now),
    ).length;
    if (count > 0) counts.set(floor.projectKey, count);
  }
  return counts;
}

/**
 * A floor's sessions the guide lists at first and the rest it folds: those
 * that ended over an hour ago and those opened but never given anything to
 * do. The session shown and ones working now are always listed.
 */
export function splitSessions(
  floor: Floor,
  sessionId: string | null,
  now: number,
): { recent: Session[]; past: Session[] } {
  const recent: Session[] = [];
  const past: Session[] = [];
  for (const session of floor.sessions) {
    const isPast =
      session.id !== sessionId &&
      !isActiveNow(session, now) &&
      (!session.hasWork ||
        (session.status === "completed" &&
          now - Date.parse(session.updatedAt) >= PAST_SESSION_MS));
    (isPast ? past : recent).push(session);
  }
  return { recent, past };
}

/** The floor a session belongs to. */
export function floorOfSession(
  floors: Floor[],
  sessionId: string,
): Floor | undefined {
  return floors.find((floor) => floor.sessions.some((s) => s.id === sessionId));
}

/**
 * The floors the guide shows at first (the one being viewed, busy ones and
 * ones used within the hour) and the quiet rest, both top floor first.
 */
export function splitFloors(
  floors: Floor[],
  currentKey: string | undefined,
  now: number,
): { awake: Floor[]; idle: Floor[] } {
  const awake: Floor[] = [];
  const idle: Floor[] = [];
  for (const floor of floors) {
    const isAwake =
      floor.projectKey === currentKey ||
      floor.active ||
      now - floor.updatedAt < IDLE_FLOOR_MS;
    (isAwake ? awake : idle).push(floor);
  }
  return { awake, idle };
}
