"use client";

import { create } from "zustand";
import { isLocale, type Locale } from "@/i18n";
import { OFFICE_VIEWS, type OfficeView } from "@/systems/floors";
import { apiFetch } from "@/utils/api";
import {
  DEFAULT_THEME,
  isTheme,
  readStoredTheme,
  storeTheme,
  type Theme,
} from "@/utils/theme";

// ============================================================================
// TYPES
// ============================================================================

export interface PreferencesState {
  autoFollowNewSessions: boolean;
  /** Whose lead agents the office shows besides the chosen session's. */
  officeView: OfficeView;
  language: Locale;
  theme: Theme;
  isLoaded: boolean;

  // Actions
  loadPreferences: () => Promise<void>;
  setAutoFollowNewSessions: (enabled: boolean) => Promise<void>;
  setOfficeView: (view: OfficeView) => Promise<void>;
  setLanguage: (language: Locale) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PREFS_PATH = "/api/v1/preferences";

const DEFAULT_AUTO_FOLLOW_NEW_SESSIONS = true;
const DEFAULT_OFFICE_VIEW: OfficeView = "floor";
const DEFAULT_LANGUAGE: Locale = "en";

// ============================================================================
// API HELPERS
// ============================================================================

async function fetchPreferences(): Promise<Record<string, string>> {
  try {
    const res = await apiFetch(PREFS_PATH);
    if (res.ok) {
      return (await res.json()) as Record<string, string>;
    }
  } catch (err) {
    console.warn("[preferences] Failed to fetch:", err);
  }
  return {};
}

const isOfficeView = (value: string | undefined): value is OfficeView =>
  (OFFICE_VIEWS as readonly (string | undefined)[]).includes(value);

/**
 * The saved view, else the one the old 「같은 층 세션 함께 보기」 switch
 * (`show_floor_colleagues`) stands for.
 */
function savedOfficeView(prefs: Record<string, string>): OfficeView {
  if (isOfficeView(prefs.office_view)) return prefs.office_view;
  if (prefs.show_floor_colleagues === "false") return "session";
  return DEFAULT_OFFICE_VIEW;
}

async function setPreference(key: string, value: string): Promise<void> {
  try {
    await apiFetch(`${PREFS_PATH}/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
  } catch (err) {
    console.warn(`[preferences] Failed to save "${key}":`, err);
  }
}

// ============================================================================
// STORE
// ============================================================================

export const usePreferencesStore = create<PreferencesState>()((set, get) => ({
  autoFollowNewSessions: DEFAULT_AUTO_FOLLOW_NEW_SESSIONS,
  officeView: DEFAULT_OFFICE_VIEW,
  language: DEFAULT_LANGUAGE,
  // This browser's last theme until the saved preference arrives.
  theme: readStoredTheme() ?? DEFAULT_THEME,
  isLoaded: false,

  loadPreferences: async () => {
    const prefs = await fetchPreferences();

    const autoFollowRaw = prefs.auto_follow_new_sessions;
    const autoFollowNewSessions =
      autoFollowRaw === undefined
        ? DEFAULT_AUTO_FOLLOW_NEW_SESSIONS
        : autoFollowRaw === "true";
    const language = prefs.language || DEFAULT_LANGUAGE;
    // No saved theme yet: keep the one this browser used.
    const theme = isTheme(prefs.theme) ? prefs.theme : get().theme;
    storeTheme(theme);

    set({
      autoFollowNewSessions,
      officeView: savedOfficeView(prefs),
      language: isLocale(language) ? language : DEFAULT_LANGUAGE,
      theme,
      isLoaded: true,
    });
  },

  setAutoFollowNewSessions: async (enabled) => {
    set({ autoFollowNewSessions: enabled });
    await setPreference("auto_follow_new_sessions", String(enabled));
  },

  setOfficeView: async (view) => {
    set({ officeView: view });
    await setPreference("office_view", view);
  },

  setLanguage: async (language) => {
    set({ language });
    await setPreference("language", language);
  },

  setTheme: async (theme) => {
    set({ theme });
    storeTheme(theme);
    await setPreference("theme", theme);
  },
}));

// ============================================================================
// SELECTORS
// ============================================================================

export const selectAutoFollowNewSessions = (state: PreferencesState) =>
  state.autoFollowNewSessions;
export const selectOfficeView = (state: PreferencesState) => state.officeView;
export const selectLanguage = (state: PreferencesState) => state.language;
export const selectTheme = (state: PreferencesState) => state.theme;
export const selectIsLoaded = (state: PreferencesState) => state.isLoaded;
