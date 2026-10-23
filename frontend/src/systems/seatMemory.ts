/**
 * Which dev room chair each person last sat in, kept for this tab, so seeing
 * the office afresh (another session shown, a reload) seats everyone where
 * they were instead of in the order they happen to be listed.
 */

const SEATS_STORAGE = "agent-office:seats";
/** Plenty for every person on a busy floor; the oldest are forgotten first. */
const MAX_REMEMBERED = 64;

const isEntry = (value: unknown): value is [string, number] =>
  Array.isArray(value) &&
  typeof value[0] === "string" &&
  Number.isInteger(value[1]);

/** The chairs remembered in this tab (none when storage is unavailable). */
export function rememberedSeats(): Map<string, number> {
  try {
    const raw = sessionStorage.getItem(SEATS_STORAGE);
    const entries: unknown = raw ? JSON.parse(raw) : [];
    return new Map(Array.isArray(entries) ? entries.filter(isEntry) : []);
  } catch {
    return new Map();
  }
}

/** Note the chair a person sits in, for this tab. */
export function rememberSeat(
  seats: Map<string, number>,
  id: string,
  index: number,
): void {
  seats.delete(id);
  seats.set(id, index);
  for (const oldest of seats.keys()) {
    if (seats.size <= MAX_REMEMBERED) break;
    seats.delete(oldest);
  }
  try {
    sessionStorage.setItem(SEATS_STORAGE, JSON.stringify([...seats]));
  } catch {
    // Storage unavailable (private mode): the chairs last for this page only.
  }
}

/**
 * The chair for a newcomer, of ``count`` in the order they are taken: the one
 * it last sat in while that is free, else the first free one, else the last.
 */
export function chooseSeat(
  count: number,
  taken: ReadonlySet<number>,
  remembered: number | undefined,
): number {
  if (remembered !== undefined && remembered < count && !taken.has(remembered))
    return remembered;
  for (let index = 0; index < count; index++) {
    if (!taken.has(index)) return index;
  }
  return count - 1;
}
