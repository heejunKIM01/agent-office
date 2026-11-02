/**
 * The approval board on my desk (systems/officeApproval.ts reads the log):
 * the latest pull request's board lies on the reception desk in front of me,
 * its title shown over it a while once Claude hands it over. When the pull
 * request is merged a stamp comes down on it and leaves a red seal.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { FURNITURE, type Furniture } from "@/constants/isoFloorPlan";
import { VISIT_MAX_MS, type Approval } from "@/systems/officeApproval";
import { FRESH_MS } from "@/systems/roomGimmicks";
import { box, cylinder } from "./isoFurniture";
import { ISO_COLORS as C } from "./isoPalette";

/** The reception desk's top, which the board lies on. */
const DESK_TOP = 1.01;
/** On the desk to my right of the monitor, in reach of my chair (desk space: along its length, across). */
const ON_DESK = { along: 0.55, across: 0.1 };
/** The title shows over the board this long after it lands or is stamped (s). */
const NOTE_SECONDS = 4;
/** The stamp comes down and lifts again over this long (s). */
const STAMP_SECONDS = 0.9;
const STAMP_HIGH = 0.7;

const NOTE_CLASS =
  "line-clamp-2 max-w-[220px] rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium leading-snug text-slate-800 shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

/** Where on the floor plan the board lies: on the reception desk. */
function boardSpot(): { x: number; z: number; turn: number } {
  const desk = FURNITURE.find(
    (piece): piece is Furniture => piece.kind === "receptionDesk",
  );
  const turn = ((desk?.rot ?? 0) * Math.PI) / 2;
  // The desk runs along its own x; a quarter turn lays that along -z.
  const { along, across } = ON_DESK;
  return {
    x: (desk?.x ?? 0) + along * Math.cos(turn) + across * Math.sin(turn),
    z: (desk?.z ?? 0) - along * Math.sin(turn) + across * Math.cos(turn),
    turn,
  };
}

export class IsoApproval {
  private readonly board = new THREE.Group();
  private readonly seal: THREE.Object3D;
  private readonly stamp = new THREE.Group();
  private readonly note: CSS2DObject;
  private readonly noteText: HTMLDivElement;
  private noteUntil: number | null = null;
  private createdId: string | null = null;
  private mergedId: string | null = null;
  private title = "";
  /** Claude is still on its way with the board (since when, ms). */
  private awaitingSince: number | null = null;
  private stamped = false;
  /** A merge came while Claude was on its way: stamp once it lands. */
  private stampAfterHandover = false;
  private stampPending = false;
  private stampStart: number | null = null;
  /** Show the note from the next frame, which knows the clock. */
  private showNote = false;

  constructor(office: THREE.Object3D) {
    const spot = boardSpot();
    this.board.position.set(spot.x, DESK_TOP, spot.z);
    // Lying flat, its top edge away from my chair.
    this.board.rotation.y = spot.turn + Math.PI / 2;
    this.board.add(box(0.44, 0.02, 0.56, C.boardBack, 0, 0, 0));
    this.board.add(box(0.36, 0.01, 0.44, C.bookPages, 0, 0.02, 0.02));
    for (const z of [-0.12, -0.04, 0.04]) {
      this.board.add(box(0.26, 0.004, 0.025, C.boardLines, 0, 0.03, z));
    }
    this.board.add(box(0.18, 0.04, 0.07, C.boardClip, 0, 0.02, -0.25));
    this.seal = cylinder(0.08, 0.08, 0.006, C.stampInk, 0.08, 0.03, 0.12, 24);
    this.seal.visible = false;
    this.board.add(this.seal);
    this.board.visible = false;
    office.add(this.board);

    // A wooden handle on a red rubber base, over the seal's spot.
    this.stamp.add(cylinder(0.05, 0.06, 0.22, C.stampHandle, 0, 0.06, 0, 12));
    this.stamp.add(cylinder(0.09, 0.09, 0.06, C.stampInk, 0, 0, 0, 20));
    this.stamp.position.set(0.08, STAMP_HIGH, 0.12);
    this.stamp.visible = false;
    this.board.add(this.stamp);

    this.noteText = document.createElement("div");
    this.noteText.className = NOTE_CLASS;
    this.note = new CSS2DObject(this.noteText);
    this.note.center.set(0.5, 1);
    this.note.position.set(spot.x, DESK_TOP + 0.9, spot.z);
    this.note.visible = false;
    office.add(this.note);
  }

  /**
   * The session's latest pull request and its merge. Returns true when one
   * was just opened, for Claude to bring its board over; until then the desk
   * has none. A pull request opened earlier lies there already, stamped if
   * it was merged.
   */
  setApproval(approval: Approval, now = Date.now()): boolean {
    const { created, merged } = approval;
    let bring = false;
    if ((created?.id ?? null) !== this.createdId) {
      this.createdId = created?.id ?? null;
      this.title = created?.title ?? "";
      this.stamped = false;
      this.stampAfterHandover = false;
      this.stampPending = false;
      this.stampStart = null;
      this.mergedId = null;
      this.noteUntil = null;
      bring = created !== null && now - created.at < FRESH_MS;
      this.awaitingSince = bring ? now : null;
      this.board.visible = created !== null && !bring;
    }
    if (merged && merged.id !== this.mergedId) {
      this.mergedId = merged.id;
      if (now - merged.at >= FRESH_MS) this.stamped = true;
      else if (this.awaitingSince !== null) this.stampAfterHandover = true;
      else this.stampPending = true;
    }
    return bring;
  }

  /** Claude has reached my desk: the board lands with its title over it. */
  handOver(): void {
    if (this.awaitingSince === null) return;
    this.land();
  }

  private land(): void {
    this.awaitingSince = null;
    this.board.visible = this.createdId !== null;
    this.noteText.textContent = `📋 ${this.title}`;
    this.noteUntil = null;
    this.showNote = true;
    if (this.stampAfterHandover) {
      this.stampAfterHandover = false;
      this.stampPending = true;
    }
  }

  /** Bring the board and stamp up to date for this frame (``seconds`` is the clock). */
  update(seconds: number): void {
    // Claude never made it (stuck, or no Claude): the board turns up anyway.
    if (
      this.awaitingSince !== null &&
      Date.now() - this.awaitingSince > VISIT_MAX_MS
    ) {
      this.land();
    }
    if (this.showNote) {
      this.showNote = false;
      this.noteUntil = seconds + NOTE_SECONDS;
    }
    if (this.stampPending && this.board.visible) {
      this.stampPending = false;
      this.stampStart = seconds;
    }
    this.press(seconds);
    this.seal.visible = this.stamped;
    this.note.visible =
      this.board.visible && this.noteUntil !== null && seconds < this.noteUntil;
  }

  /** The stamp coming down on the board, inking the seal, and lifting off. */
  private press(seconds: number): void {
    if (this.stampStart === null) {
      this.stamp.visible = false;
      return;
    }
    const t = (seconds - this.stampStart) / STAMP_SECONDS;
    if (t >= 1) {
      this.stampStart = null;
      this.stamp.visible = false;
      return;
    }
    this.stamp.visible = true;
    // Down over the first 40%, held, then up over the last 40%.
    const height = t < 0.4 ? 1 - t / 0.4 : t < 0.6 ? 0 : (t - 0.6) / 0.4;
    this.stamp.position.y = 0.04 + height * STAMP_HIGH;
    if (t >= 0.4 && !this.stamped) {
      this.stamped = true;
      this.noteText.textContent = `📋 ${this.title}`;
      this.noteUntil = seconds + NOTE_SECONDS;
    }
  }

  dispose(): void {
    this.note.removeFromParent();
  }
}
