/**
 * Where the agents work (설정 「장소」): the office, or the airport where
 * Claude is the controller in the tower and subagents fly as planes. The
 * choice is saved as the ``place`` preference and mirrored in localStorage,
 * so the page opens on the last place without drawing the other first.
 */

export const places = ["office", "airport"] as const;
export type Place = (typeof places)[number];

export const DEFAULT_PLACE: Place = "office";

const PLACE_STORAGE_KEY = "agent-office-place";

export function isPlace(value: unknown): value is Place {
  return places.includes(value as Place);
}

/** The place this browser last showed, or null when none is stored. */
export function readStoredPlace(): Place | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(PLACE_STORAGE_KEY);
    return isPlace(stored) ? stored : null;
  } catch {
    // localStorage may be unavailable (private mode).
    return null;
  }
}

export function storePlace(place: Place): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PLACE_STORAGE_KEY, place);
  } catch {
    // Ignore storage errors; the preference on the backend still holds it.
  }
}
