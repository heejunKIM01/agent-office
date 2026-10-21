"use client";

/**
 * The isometric office (docs/plan/spec.md "화면 재설계"), opened at /iso
 * while it is being built; the classic office stays at /.
 */

import { useCallback, useEffect, useMemo } from "react";
import { AgentLogo } from "@/components/iso/AgentLogo";
import { IsoOffice } from "@/components/iso/IsoOffice";
import { useSessions } from "@/hooks/useSessions";
import { useTranslation } from "@/hooks/useTranslation";
import { useWebSocketEvents } from "@/hooks/useWebSocketEvents";
import {
  selectBoss,
  selectCodingAgent,
  selectIsConnected,
  useGameStore,
} from "@/stores/gameStore";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { buildFloors, floorOfSession } from "@/systems/floors";
import { initApiKeyFromBrowser } from "@/utils/api";

export default function IsoOfficePage(): React.ReactNode {
  const { t } = useTranslation();
  // Status toasts are not shown on this page yet.
  const showStatus = useCallback(() => undefined, []);
  const { sessions, sessionId } = useSessions(showStatus);
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
  const floor = useMemo(
    () => floorOfSession(buildFloors(sessions), sessionId),
    [sessions, sessionId],
  );
  const title =
    session?.label || boss.currentTask || session?.id.slice(0, 8) || "";

  return (
    <main
      className="relative h-dvh w-full overflow-hidden bg-gradient-to-b from-[#f5f7fa] to-[#e8ecf2] text-slate-800"
      style={{
        fontFamily:
          '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif',
      }}
    >
      <IsoOffice />

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
    </main>
  );
}
