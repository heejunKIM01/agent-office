/**
 * The printer's sheets (systems/officePrinter.ts decides what it prints): a
 * sheet per new file in the session lies in the tray on top of the printer
 * in the dev room (the body is furniture, isoFurniture.ts). When a file is
 * written that was not there, the lamp on the front panel blinks green, a
 * sheet slides out of the slot into the tray and the file's name shows over
 * the printer a while.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { PRINTER } from "@/constants/isoFloorPlan";
import {
  MAX_PRINTOUTS,
  isFreshPrintout,
  printProgress,
  type Printout,
} from "@/systems/officePrinter";
import { box, material } from "./isoFurniture";
import { ISO_COLORS as C } from "./isoPalette";

/** The tray's floor, the top of the printer (isoFurniture.ts printer). */
const TRAY_TOP = 0.922;
const SHEET = { w: 0.42, d: 0.3, h: 0.004 };
/** Where a sheet lies in the tray, and where it starts, under the slot. */
const TRAY_Z = 0.05;
const SLOT_Z = -0.2;
/** The file's name shows over the printer this long after a print starts (s). */
const NOTE_SECONDS = 5;
/** New files wait their turn no deeper than this. */
const MAX_QUEUE = 3;
/** How fast the lamp blinks while printing (blinks a second). */
const BLINKS = 4;

const NOTE_CLASS =
  "line-clamp-2 max-w-[220px] break-all rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium leading-snug text-slate-800 shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

/** A sheet of paper with three printed lines, its bottom at the origin. */
function sheet(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(SHEET.w, SHEET.h, SHEET.d, C.paper));
  [-0.08, -0.03, 0.02].forEach((z, i) => {
    g.add(
      box(
        i === 0 ? 0.24 : 0.3,
        0.001,
        0.014,
        C.paperInk,
        i === 0 ? -0.03 : 0,
        SHEET.h,
        z,
      ),
    );
  });
  return g;
}

/** Where sheet ``i`` lies in the tray, bottom up, each a little askew. */
function traySpot(i: number): { y: number; x: number; turn: number } {
  return {
    y: TRAY_TOP + i * (SHEET.h + 0.002),
    x: ((i * 37) % 5) * 0.006 - 0.012,
    turn: ((i * 53) % 7) * 0.012 - 0.036,
  };
}

export class IsoPrinter {
  private readonly root = new THREE.Group();
  private readonly tray: THREE.Group[] = [];
  /** The sheet coming out of the slot. */
  private readonly printing = sheet();
  private readonly lamp: THREE.Mesh;
  private readonly lampOff: THREE.Material;
  private readonly lampOn = new THREE.MeshBasicMaterial({
    color: C.printerLightOn,
  });
  private readonly note: CSS2DObject;
  private readonly noteText: HTMLDivElement;
  private noteUntil: number | null = null;
  private readonly queue: Printout[] = [];
  /** The printout coming out now and when it started (ms), once its turn comes. */
  private current: { printout: Printout; from: number } | null = null;
  private count = 0;
  private seen: string | null = null;

  constructor(office: THREE.Object3D) {
    this.root.position.set(PRINTER.x, 0, PRINTER.z);
    for (let i = 0; i < MAX_PRINTOUTS; i++) {
      const lying = sheet();
      const spot = traySpot(i);
      lying.position.set(spot.x, spot.y, TRAY_Z);
      lying.rotation.y = spot.turn;
      lying.visible = false;
      this.tray.push(lying);
      this.root.add(lying);
    }
    this.printing.visible = false;
    this.root.add(this.printing);

    this.lampOff = material(C.printerLightOff);
    this.lamp = box(0.05, 0.05, 0.02, C.printerLightOff, 0.24, 0.79, 0.29);
    this.lamp.material = this.lampOff;
    this.root.add(this.lamp);

    this.noteText = document.createElement("div");
    this.noteText.className = NOTE_CLASS;
    this.note = new CSS2DObject(this.noteText);
    // Up and to the left of the printer, its right end over the printer:
    // the wall clock is up and to the right, and at the floor's own zoom a
    // tag centred over the printer hides it.
    this.note.center.set(1, 1);
    this.note.position.set(-0.2, TRAY_TOP + 0.45, 0);
    this.note.visible = false;
    this.root.add(this.note);
    office.add(this.root);
  }

  /**
   * The session's new files: a sheet each in the tray. One written just now
   * is printed, and lies in the tray once it is out.
   */
  setPrintouts(printouts: { count: number; last: Printout | null }): void {
    const { count, last } = printouts;
    if (count < this.count) {
      // Another session: its own tray, nothing printing.
      this.queue.length = 0;
      this.current = null;
      this.noteUntil = null;
    }
    this.count = count;
    if (isFreshPrintout(last, this.seen, Date.now())) {
      if (this.queue.length < MAX_QUEUE) this.queue.push(last);
    }
    this.seen = last?.id ?? null;
  }

  /** Print for this frame (``now`` in ms). */
  update(now: number): void {
    if (!this.current && this.queue.length > 0) {
      this.current = { printout: this.queue.shift() as Printout, from: now };
      this.noteText.textContent = `🖨️ ${this.current.printout.name}`;
      this.noteUntil = now + NOTE_SECONDS * 1000;
    }
    let progress = 0;
    if (this.current) {
      progress = printProgress(this.current.from, now);
      if (progress >= 1) this.current = null;
    }
    const printing = this.current !== null;

    // The sheets already out, less the ones still to come.
    const coming = this.queue.length + (printing ? 1 : 0);
    const lying = Math.min(MAX_PRINTOUTS, Math.max(0, this.count - coming));
    this.tray.forEach((sheetInTray, i) => {
      sheetInTray.visible = i < lying;
    });

    this.printing.visible = printing;
    if (printing) {
      // Out of the slot and down into the tray, onto the pile.
      const top = traySpot(Math.min(lying, MAX_PRINTOUTS - 1));
      const eased = 1 - (1 - progress) ** 2;
      this.printing.position.set(
        top.x * eased,
        top.y + 0.05 * (1 - eased),
        SLOT_Z + (TRAY_Z - SLOT_Z) * eased,
      );
      this.printing.rotation.y = top.turn * eased;
    }
    const blink = Math.floor((now / 1000) * BLINKS * 2) % 2 === 0;
    this.lamp.material = printing && blink ? this.lampOn : this.lampOff;
    this.note.visible = this.noteUntil !== null && now < this.noteUntil;
  }

  dispose(): void {
    this.note.removeFromParent();
    this.lampOn.dispose();
  }
}
