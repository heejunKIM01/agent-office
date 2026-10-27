/**
 * The construction site's moments, as plain numbers (설정 「장소」 · 건설
 * 현장): how the warning beacon flashes after failed tests, how the
 * inspection stamp lands after passing ones, how the topping-out flag
 * rises and the ribbon is cut when work ships. Each takes the time since
 * its moment began (ms) and says how it looks; null once it is over. The
 * scene (components/iso/construction/siteMoments.ts) draws them.
 */

/** The beacon on the site office flashes this long after tests fail (ms). */
export const ALARM_MS = 6000;
/** The warning sign stands by whoever's tests failed this long (ms). */
export const SIGN_MS = 8000;
/** The inspection stamp shows this long after tests pass (ms). */
export const STAMP_MS = 3500;
/** The topping-out flag flies this long after work ships (ms). */
export const FLAG_MS = 20_000;
/** The ribbon across the gate is up this long after work ships (ms). */
export const TAPE_MS = 9000;
/** The ribbon is cut this long after it goes up (ms). */
export const TAPE_CUT_MS = 1500;
/** Everyone waves their hard hat this long after I say thanks (ms). */
export const HAT_WAVE_MS = 3000;

const smooth = (t: number): number => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

/** Whether the beacon's light is on: four flashes a second while it lasts. */
export function beaconOn(sinceMs: number): boolean | null {
  if (sinceMs < 0 || sinceMs >= ALARM_MS) return null;
  return Math.floor(sinceMs / 125) % 2 === 0;
}

/** The stamp comes down big and settles, holds, then fades. */
export function stampLook(
  sinceMs: number,
): { scale: number; opacity: number } | null {
  if (sinceMs < 0 || sinceMs >= STAMP_MS) return null;
  const land = smooth(sinceMs / 220);
  const fade = smooth((STAMP_MS - sinceMs) / 500);
  return { scale: 1.8 - 0.8 * land, opacity: Math.min(land, fade) };
}

/** How far the flag is up its pole (0 hidden, 1 flying): up, flying, down. */
export function flagRaised(sinceMs: number): number | null {
  if (sinceMs < 0 || sinceMs >= FLAG_MS) return null;
  return Math.min(smooth(sinceMs / 1500), smooth((FLAG_MS - sinceMs) / 1500));
}

/** How far each half of the cut ribbon has dropped (0 taut, 1 hanging). */
export function tapeDropped(sinceMs: number): number | null {
  if (sinceMs < 0 || sinceMs >= TAPE_MS) return null;
  return smooth((sinceMs - TAPE_CUT_MS) / 700);
}
