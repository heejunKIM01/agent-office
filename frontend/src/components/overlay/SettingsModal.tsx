"use client";

import { useState, ReactNode } from "react";
import Modal from "./Modal";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useTranslation } from "@/hooks/useTranslation";
import { locales, type Locale } from "@/i18n";
import { ConnectTab } from "@/components/settings/ConnectTab";

// ============================================================================
// TYPES
// ============================================================================

type SettingsTab = "general" | "connect";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

// ============================================================================
// COMPONENT
// ============================================================================

/** One on/off row of the session settings: label and description, then the switch. */
function SessionSwitch({
  checked,
  label,
  description,
  onToggle,
}: {
  checked: boolean;
  label: string;
  description: string;
  onToggle: () => void;
}): ReactNode {
  return (
    <div
      role="switch"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <div>
        <p className="text-slate-700 text-[13px] font-semibold">{label}</p>
        <p className="text-slate-500 text-[11px] mt-0.5">{description}</p>
      </div>
      <div
        className={`w-11 h-6 shrink-0 rounded-full relative transition-colors ${
          checked ? "bg-[#2ca056]" : "bg-slate-200"
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </div>
    </div>
  );
}

export default function SettingsModal({
  isOpen,
  onClose,
  initialTab = "general",
}: SettingsModalProps): ReactNode {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Sync tab when initialTab changes (e.g. the empty office's connect button).
  // Adjust-state-during-render pattern: reinitializes from the prop without a
  // cascading setState-in-effect (react-hooks/set-state-in-effect).
  const [syncedInitialTab, setSyncedInitialTab] = useState(initialTab);
  if (syncedInitialTab !== initialTab) {
    setSyncedInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  const autoFollowNewSessions = usePreferencesStore(
    (s) => s.autoFollowNewSessions,
  );
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const setAutoFollowNewSessions = usePreferencesStore(
    (s) => s.setAutoFollowNewSessions,
  );
  const showFloorColleagues = usePreferencesStore((s) => s.showFloorColleagues);
  const setShowFloorColleagues = usePreferencesStore(
    (s) => s.setShowFloorColleagues,
  );

  const { t } = useTranslation();

  const handleLanguageChange = (locale: Locale) => {
    setLanguage(locale);
  };

  const handleAutoFollowToggle = () => {
    setAutoFollowNewSessions(!autoFollowNewSessions);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissible={false}
      title={t("settings.title")}
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        >
          {t("modal.close")}
        </button>
      }
    >
      {/* Tab bar */}
      <div className="flex gap-1 mb-5 p-1 bg-slate-100 rounded-xl">
        {(["general", "connect"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-1.5 rounded-lg text-[13px] font-bold transition-colors ${
              activeTab === tab
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {t(`settings.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "general" && (
        <div className="space-y-6">
          {/* Language */}
          <div>
            <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2.5">
              {t("settings.language")}
            </label>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="radiogroup"
              aria-label={t("settings.language")}
            >
              {(Object.entries(locales) as [Locale, string][]).map(
                ([locale, label]) => (
                  <button
                    key={locale}
                    type="button"
                    role="radio"
                    aria-checked={language === locale}
                    tabIndex={language === locale ? 0 : -1}
                    onClick={() => handleLanguageChange(locale)}
                    onKeyDown={(e) => {
                      const items = Object.keys(locales) as Locale[];
                      const idx = items.indexOf(locale);
                      let next: number | null = null;
                      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                        e.preventDefault();
                        next = (idx + 1) % items.length;
                      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                        e.preventDefault();
                        next = (idx - 1 + items.length) % items.length;
                      }
                      if (next !== null) {
                        handleLanguageChange(items[next]);
                        const parent = e.currentTarget.parentElement;
                        if (parent)
                          (parent.children[next] as HTMLElement)?.focus();
                      }
                    }}
                    className={`px-3 py-2.5 rounded-xl border text-[13px] font-bold break-keep transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white outline-none ${
                      language === locale
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Session Settings */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2.5">
              {t("settings.sessionBehavior")}
            </label>
            <div className="space-y-2">
              <SessionSwitch
                checked={autoFollowNewSessions}
                label={t("settings.autoFollow")}
                description={t("settings.autoFollowDesc")}
                onToggle={handleAutoFollowToggle}
              />
              <SessionSwitch
                checked={showFloorColleagues}
                label={t("settings.floorTogether")}
                description={t("settings.floorTogetherDesc")}
                onToggle={() =>
                  void setShowFloorColleagues(!showFloorColleagues)
                }
              />
            </div>
          </div>
        </div>
      )}
      {activeTab === "connect" && <ConnectTab />}
    </Modal>
  );
}
