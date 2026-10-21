"use client";

/**
 * The right-hand column of the isometric office (docs/plan/spec.md
 * 「화면 재설계」, wording after the video): the project and session,
 * 「사무실 사람들」 with what each person is doing, 「활동 로그」 and
 * 「어디서 무엇을 하나」. ``className`` places it: a column beside the
 * office, or a sheet on phones.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@/hooks/useSessions";
import { useCodingAgentName } from "@/hooks/useCodingAgentName";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/stores/gameStore";
import { officePeople, type Colleague } from "@/systems/officePeople";
import { OUTFIT_COLORS } from "./isoPalette";
import {
  logLines,
  rosterRows,
  startedTasks,
  toolCounts,
  type RosterRow,
  type RosterWords,
} from "@/systems/officeRoster";

const ROOM_LEGEND = [
  { icon: "📚", room: "library" },
  { icon: "💻", room: "dev" },
  { icon: "🗄️", room: "server" },
  { icon: "🌐", room: "search" },
  { icon: "🗒️", room: "meeting" },
  { icon: "🧑‍💻", room: "mydesk" },
  { icon: "🛗", room: "elevator" },
] as const;

const card =
  "rounded-2xl border border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/90";

/** When each row's status and task were last seen to change. */
interface Clock {
  now: number;
  since: Map<string, { key: string; at: number }>;
}

const rowKey = (row: RosterRow): string => `${row.status}|${row.doing}`;

function stamp(previous: Clock, rows: RosterRow[], now: number): Clock {
  const since = new Map<string, { key: string; at: number }>();
  for (const row of rows) {
    const seen = previous.since.get(row.id);
    const key = rowKey(row);
    since.set(row.id, seen && seen.key === key ? seen : { key, at: now });
  }
  return { now, since };
}

/** Seconds since each row's status or task last changed, ticking once a second. */
function useSecondsInState(rows: RosterRow[]): Map<string, number> {
  const latest = useRef(rows);
  useEffect(() => {
    latest.current = rows;
  }, [rows]);
  const [clock, setClock] = useState<Clock>(() => ({
    now: Date.now(),
    since: new Map(),
  }));
  useEffect(() => {
    const timer = window.setInterval(
      () => setClock((previous) => stamp(previous, latest.current, Date.now())),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  return useMemo(() => {
    const seconds = new Map<string, number>();
    for (const row of rows) {
      const seen = clock.since.get(row.id);
      // A change the clock has not stamped yet has just happened.
      const at = seen && seen.key === rowKey(row) ? seen.at : clock.now;
      seconds.set(row.id, Math.max(0, Math.round((clock.now - at) / 1000)));
    }
    return seconds;
  }, [rows, clock]);
}

function Avatar({ row }: { row: RosterRow }): React.ReactNode {
  const claude = row.kind === "claude" || row.kind === "colleague";
  return (
    <span
      aria-hidden="true"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{
        background: claude ? "#d97757" : OUTFIT_COLORS[row.outfit],
      }}
    >
      {claude ? "✳" : (row.typeLabel || row.title).slice(0, 1)}
    </span>
  );
}

export function IsoSidePanel({
  session,
  colleagues,
  className,
}: {
  session: Session | undefined;
  /** Other sessions' lead agents working on this floor. */
  colleagues: Colleague[];
  className: string;
}): React.ReactNode {
  const { t } = useTranslation();
  const agentName = useCodingAgentName();
  const boss = useGameStore((s) => s.boss);
  const agents = useGameStore((s) => s.agents);
  const eventLog = useGameStore((s) => s.eventLog);

  const words = useMemo<RosterWords>(
    () => ({
      thinking: t("iso.bubble.thinking"),
      looking: t("iso.bubble.looking"),
      rooms: {
        library: t("iso.room.library"),
        seat: t("iso.room.dev"),
        server: t("iso.room.server"),
        search: t("iso.room.search"),
        meeting: t("iso.room.meeting"),
        mydesk: t("iso.room.mydesk"),
      },
    }),
    [t],
  );
  const people = useMemo(
    () =>
      officePeople(
        { boss, agents },
        {
          agentName,
          me: t("iso.me"),
          generalType: t("iso.agentType.general"),
        },
        colleagues,
      ),
    [boss, agents, agentName, t, colleagues],
  );
  const rows = useMemo(
    () => rosterRows(people, toolCounts(eventLog), words),
    [people, eventLog, words],
  );
  const seconds = useSecondsInState(rows);
  const lines = useMemo(() => {
    const titles = new Map(people.map((p) => [p.id, p.title]));
    // Subagents that went home are named by the task they were started with.
    const tasks = startedTasks(eventLog);
    return logLines(
      eventLog,
      (agentId, type) => {
        if (type === "user_prompt_submit") return t("iso.me");
        if (agentId === "main") return agentName;
        return titles.get(agentId) ?? tasks.get(agentId) ?? agentId.slice(0, 8);
      },
      words,
    );
  }, [eventLog, people, agentName, words, t]);

  return (
    <aside className={className}>
      <section
        className={`${card} grid grid-cols-[3.5em_1fr] gap-x-2 gap-y-0.5 text-[11px]`}
      >
        <span className="text-slate-400">{t("iso.panel.project")}</span>
        <span className="truncate font-mono text-slate-700 dark:text-slate-300">
          {session?.projectRoot || session?.projectName || "—"}
        </span>
        <span className="text-slate-400">{t("iso.panel.session")}</span>
        <span className="truncate font-mono text-slate-700 dark:text-slate-300">
          {session?.id.slice(0, 8) ?? "—"}
        </span>
      </section>

      <section className={`${card} flex min-h-0 flex-[3] flex-col gap-2`}>
        <header className="flex items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-bold">{t("iso.panel.people")}</h2>
          <span className="text-[11px] text-slate-400">
            {t("iso.panel.atWork", { count: rows.length })}
          </span>
        </header>
        <ul className="-mr-1 flex min-h-0 flex-col gap-2.5 overflow-y-auto pr-1">
          {rows.map((row) => (
            <li key={row.id} className="flex gap-2">
              <Avatar row={row} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-[12px] font-semibold">
                    {row.title}
                  </span>
                  {row.typeLabel && row.typeLabel !== row.title && (
                    <span className="shrink-0 text-[10.5px] text-slate-400">
                      {row.typeLabel}
                    </span>
                  )}
                  {row.status && (
                    <span
                      className={`ml-auto shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ${
                        row.status === "thinking"
                          ? "bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300"
                          : "bg-blue-100 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300"
                      }`}
                    >
                      {row.status === "thinking"
                        ? t("iso.bubble.thinking")
                        : t("iso.panel.working")}
                    </span>
                  )}
                </div>
                {row.doing && (
                  <p className="truncate text-[11px] text-slate-600 dark:text-slate-300">
                    {row.doing}
                  </p>
                )}
                <p className="text-[10px] text-slate-400">
                  {/* Its tools are logged in its own session, not this one. */}
                  {row.kind === "colleague"
                    ? t("iso.panel.colleague", {
                        seconds: seconds.get(row.id) ?? 0,
                      })
                    : t("iso.panel.tools", {
                        count: row.tools,
                        seconds: seconds.get(row.id) ?? 0,
                      })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${card} flex min-h-0 flex-[2] flex-col gap-2`}>
        <h2 className="text-[13px] font-bold">{t("iso.panel.log")}</h2>
        <ol className="-mr-1 flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
          {lines.map((line) => (
            <li
              key={line.id}
              className="grid grid-cols-[6.6em_4.6em_1fr] gap-1.5 text-[10.5px] leading-snug"
            >
              <span className="whitespace-nowrap text-slate-400 tabular-nums">
                {t("iso.panel.logTime", {
                  h: line.time.getHours(),
                  m: String(line.time.getMinutes()).padStart(2, "0"),
                  s: String(line.time.getSeconds()).padStart(2, "0"),
                })}
              </span>
              <span className="truncate font-semibold">{line.who}</span>
              <span className="line-clamp-4 break-words text-slate-600 dark:text-slate-300">
                {line.what}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className={card}>
        <h2 className="mb-1.5 text-[13px] font-bold">{t("iso.panel.rooms")}</h2>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] leading-snug">
          {ROOM_LEGEND.map(({ icon, room }) => (
            <li key={room} className="flex gap-1">
              <span aria-hidden="true">{icon}</span>
              <span className="min-w-0">
                <b className="font-semibold">{t(`iso.room.${room}`)}</b>{" "}
                <span className="text-slate-400">
                  {t(`iso.roomDoes.${room}`)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
