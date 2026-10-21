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
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-lg transition-colors"
        >
          {t("modal.close")}
        </button>
      }
    >
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-800/50 rounded-lg border border-slate-700">
        {(["general", "connect"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
              activeTab === tab
                ? "bg-purple-500/20 border border-purple-500 text-purple-300"
                : "bg-transparent border border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800"
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
            <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
              {t("settings.language")}
            </label>
            <div
              className="flex gap-3"
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
                    className={`flex-1 px-4 py-3 rounded-lg border text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 outline-none ${
                      language === locale
                        ? "bg-purple-500/20 border-purple-500 text-purple-300"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Session Settings */}
          <div className="pt-4 border-t border-slate-800">
            <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
              {t("settings.sessionBehavior")}
            </label>
            <div
              role="switch"
              aria-checked={autoFollowNewSessions}
              aria-label={t("settings.autoFollow")}
              tabIndex={0}
              onClick={handleAutoFollowToggle}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleAutoFollowToggle();
                }
              }}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer hover:border-slate-600 transition-colors"
            >
              <div>
                <p className="text-slate-300 text-sm font-medium">
                  {t("settings.autoFollow")}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {t("settings.autoFollowDesc")}
                </p>
              </div>
              <div
                className={`w-11 h-6 rounded-full relative transition-colors ${
                  autoFollowNewSessions ? "bg-purple-500" : "bg-slate-600"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                    autoFollowNewSessions ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === "connect" && <ConnectTab />}
    </Modal>
  );
}
