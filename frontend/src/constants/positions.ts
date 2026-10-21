/**
 * Position constants for office elements.
 *
 * All positions are in pixels relative to the canvas origin (top-left).
 */

// ============================================================================
// FLOOR ELEMENTS
// ============================================================================

/** Plant position (archive's bottom-left corner) */
export const PLANT_POSITION = { x: 30, y: 990 };

// ============================================================================
// DESK GRID
// ============================================================================

/**
 * Desk grid shape — keep in sync with backend `state_machine.py`
 * `StateMachine.DESKS_PER_ROW` / `StateMachine.MIN_DESK_COUNT`.
 * A shared cross-component source is intentionally out of scope; update both
 * sides together when changing the desk grid.
 */
export const DESKS_PER_ROW = 4;
export const MIN_DESK_COUNT = 8;
