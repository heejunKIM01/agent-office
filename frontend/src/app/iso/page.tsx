"use client";

/**
 * The isometric office (docs/plan/spec.md "화면 재설계"), opened at /iso
 * while it is being built; the classic office stays at /.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentLogo } from "@/components/iso/AgentLogo";
import { IsoFloorGuide } from "@/components/iso/IsoFloorGuide";
import { IsoOffice } from "@/components/iso/IsoOffice";
import { IsoSidePanel } from "@/components/iso/IsoSidePanel";
import { useNow } from "@/hooks/useNow";
import { useSessions } from "@/hooks/useSessions";
import { useSessionSwitch } from "@/hooks/useSessionSwitch";
import { useTranslation } from "@/hooks/useTranslation";
import { useWebSocketEvents } from "@/hooks/useWebSocketEvents";
import {
  selectBoss,
  selectCodingAgent,
  selectIsConnected,
  useGameStore,
} from "@/stores/gameStore";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { buildFloors, floorOfSession, sessionTitle } from "@/systems/floors";
import { initApiKeyFromBrowser } from "@/utils/api";

/** How long the 「▲ 3F」 lamp shows while the office changes floors (globals.css). */
const ELEVATOR_LAMP_MS = 1600;

export default function IsoOfficePage(): React.ReactNode {
  const { t } = useTranslation();
  // Status toasts are not shown on this page yet.
  const showStatus = useCallback(() => undefined, []);
  const { sessions, sessionId, setSessionId, fetchSessions } =
    useSessions(showStatus);
  const { handleSessionSelect } = useSessionSwitch({
    sessionId,
    setSessionId,
    fetchSessions,
    showStatus,
  });
  useWebSocketEvents({ sessionId });

  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);
  useEffect(() => {
    initApiKeyFromBrowser();
    loadPreferences();
  }, [loadPreferences]);

  const isConnected = useGameStore(selectIsConnected);
  const codingAgent = useGameStore(selectCodingAgent);
  const boss = useGameStore(selectBoss);
  const session = sessions.find((s) => s.id === sessionId);
  const now = useNow(15_000);
  const floors = useMemo(() => buildFloors(sessions, now), [sessions, now]);
  const floor = floorOfSession(floors, sessionId);
  const title =
    (session && sessionTitle(session)) ||
    boss.currentTask ||
    session?.id.slice(0, 8) ||
    "";

  // Moving to another floor lights 「▲ 3F」 (「▼」 going down) for a moment.
  const [lamp, setLamp] = useState<{ key: number; text: string } | null>(null);
  const goToSession = (id: string): void => {
    const from = floorOfSession(floors, sessionId);
    const to = floorOfSession(floors, id);
    if (from && to && from.number !== to.number) {
      const arrow = to.number > from.number ? "▲" : "▼";
      setLamp((previous) => ({
        key: (previous?.key ?? 0) + 1,
        text: `${arrow} ${to.number}F`,
      }));
    }
    void handleSessionSelect(id);
  };
  useEffect(() => {
    if (!lamp) return;
    const timer = window.setTimeout(() => setLamp(null), ELEVATOR_LAMP_MS);
    return () => window.clearTimeout(timer);
  }, [lamp]);

  return (
    <main
      className="flex h-dvh w-full overflow-hidden bg-gradient-to-b from-[#f5f7fa] to-[#e8ecf2] text-slate-800"
      style={{
        fontFamily:
          '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif',
      }}
    >
      <IsoFloorGuide
        floors={floors}
        sessionId={sessionId}
        now={now}
        onSelectSession={goToSession}
      />
      <div className="relative min-w-0 flex-1">
        <IsoOffice />

        {lamp && (
          <div
            key={lamp.key}
            role="status"
            className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2"
          >
            <div className="animate-elevator rounded-xl border-2 border-slate-700 bg-slate-900/95 px-5 py-2 font-mono text-2xl font-bold tracking-[0.2em] text-amber-300 shadow-lg [text-shadow:0_0_8px_rgba(252,211,77,0.7)] motion-reduce:animate-none">
              {lamp.text}
            </div>
          </div>
        )}

        {session && (
          <header className="absolute left-4 top-4 flex max-w-[60%] items-center gap-3 rounded-xl border border-slate-200/80 bg-white/95 py-2 pl-2 pr-4 shadow-sm">
            <AgentLogo codingAgent={codingAgent ?? session.codingAgent} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {floor && (
                  <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-bold text-white">
                    {floor.number}F
                  </span>
                )}
                <span className="truncate text-sm font-bold">
                  {floor?.name ?? session.projectName}
                </span>
              </div>
              <p className="truncate text-xs text-slate-500">{title}</p>
            </div>
          </header>
        )}

        <div
          className={`absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold shadow-sm ${
            isConnected ? "text-emerald-600" : "text-slate-400"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-slate-300"}`}
          />
          {isConnected ? t("iso.live") : t("iso.offline")}
        </div>
      </div>
      <IsoSidePanel session={session} />
    </main>
  );
}
