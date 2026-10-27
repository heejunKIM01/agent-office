/**
 * Room effects of the isometric office, from the video author's notes in
 * docs/plan/spec.md 「화면 재설계」: code runs down the iMac of whoever is
 * editing (and flashes red when its tests fail), the rack lights blink
 * faster while a command runs, and planning
 * writes on the meeting room whiteboard. The elevator doors open while
 * someone steps in or out, and paper confetti falls over the office when work
 * ships (a push or merge). Each commit drops a sheet into the tray on
 * Claude's desk, its message's first line shown over it for a moment.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  CLAUDE_SEAT,
  FLOOR_DEPTH,
  FLOOR_WIDTH,
  type Furniture,
  type IsoSpot,
} from "@/constants/isoFloorPlan";
import {
  FRESH_MS,
  MAX_SHEETS,
  globeSpeed,
  lampLit,
  type NoteStatus,
} from "@/systems/roomGimmicks";
import { box, material } from "./isoFurniture";
import { ISO_COLORS } from "./isoPalette";
import type { RoomsInUse } from "./isoPeople";

/** Blink speed of the rack lights (rad/s), idle and while a command runs. */
const LED_IDLE_SPEED = 2.5;
const LED_BUSY_SPEED = 14;
/** A failed test's screen flashes between these this many times a second. */
const ALARM_COLORS = ["#ef4444", "#7f1d1d"] as const;
const ALARM_FLASHES = 3;
/** Confetti: how many pieces, how long they fall (s), from how high and how fast (m). */
const CONFETTI_PIECES = 90;
const CONFETTI_SECONDS = 3;
const CONFETTI_TOP = 9;
const CONFETTI_FALL = 3;
const CONFETTI_COLORS = [
  "#f87171",
  "#fbbf24",
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
];
/** A commit's sheet falls into the tray this fast (s), and its line shows this long (s). */
const SHEET_DROP_SECONDS = 0.35;
const SHEET_NOTE_SECONDS = 4;
const SHEET_THICKNESS = 0.018;
/** How far the code scrolls per second, in screen heights. */
const CODE_SCROLL_SPEED = 0.25;
/** Seconds of planning to fill the whiteboard's writing rows. */
const BOARD_FILL_SECONDS = 8;
/** An iMac sits this far in front of the chair of the person using it (m). */
const SEAT_TO_SCREEN = 1.6;
/** How fast the elevator doors open and close (fully per second). */
const DOOR_SPEED = 2.2;
/** Where a closed elevator door sits from the middle, and how far it slides. */
const DOOR_CLOSED_X = 0.58;
const DOOR_SLIDE = 0.5;
/** An open door narrows to this share of its width in its pocket. */
const DOOR_OPEN_WIDTH = 0.2;
/** The lamp over the elevator door when lit, and its arrow's opacity when not. */
const LAMP_COLOR = "#f5b942";
const ARROW_DIM = 0.3;
/** The TV cuts to a new scene this often while someone watches (s). */
const TV_SCENE_SECONDS = 4;
/** A to-do note's colour by status, and the board's notes before any list. */
const NOTE_COLORS: Record<NoteStatus, string> = {
  pending: ISO_COLORS.notePending,
  in_progress: ISO_COLORS.noteInProgress,
  completed: ISO_COLORS.noteDone,
};
const DEFAULT_NOTES: readonly NoteStatus[] = [
  "pending",
  "in_progress",
  "completed",
];

const CODE_COLORS = [
  "#7dd3fc",
  "#fca5a5",
  "#fde68a",
  "#86efac",
  "#c4b5fd",
  "#e2e8f0",
];
const INK = ["#2f5bd3", "#1f2937", "#2f5bd3"];

/** Deterministic 0..1 values so every load looks the same. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const placeKey = (x: number, z: number): string =>
  `${x.toFixed(2)},${z.toFixed(2)}`;

/** Lines of make-believe code, tiled vertically so it can scroll forever. */
function codeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1d2636";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const random = seeded(11);
    for (let y = 6; y < canvas.height - 4; y += 11) {
      let x = 6 + Math.floor(random() * 4) * 8;
      const words = 1 + Math.floor(random() * 4);
      for (let w = 0; w < words && x < canvas.width - 10; w++) {
        const width = 8 + random() * 26;
        ctx.fillStyle = CODE_COLORS[Math.floor(random() * CODE_COLORS.length)];
        ctx.fillRect(x, y, Math.min(width, canvas.width - 6 - x), 5);
        x += width + 5;
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 0.5);
  return texture;
}

/** Handwriting rows: words as wavy strokes, drawn up to a fraction of their length. */
interface Board {
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  mesh: THREE.Mesh;
  words: { row: number; x0: number; x1: number; seed: number }[];
  length: number;
  progress: number;
  drawnPercent: number;
}

function makeBoard(whiteboard: THREE.Object3D): Board | null {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // The clear bottom half of the board, under its notes and boxes.
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.3, 0.5),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.position.set(0, 1.39, 0.075);
  whiteboard.add(mesh);
  const random = seeded(5);
  const words: Board["words"] = [];
  for (let row = 0; row < 3; row++) {
    let x = 8 + random() * 20;
    while (x < canvas.width - 40) {
      const width = 24 + random() * 60;
      words.push({ row, x0: x, x1: x + width, seed: random() * 10 });
      x += width + 14;
    }
  }
  const length = words.reduce((sum, w) => sum + (w.x1 - w.x0), 0);
  return { ctx, texture, mesh, words, length, progress: 0, drawnPercent: 0 };
}

function drawBoard(board: Board): void {
  const { ctx, words } = board;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  let left = board.progress * board.length;
  for (const word of words) {
    if (left <= 0) break;
    const end = Math.min(word.x1, word.x0 + left);
    left -= word.x1 - word.x0;
    const baseline = 12 + word.row * 20;
    ctx.strokeStyle = INK[word.row];
    ctx.beginPath();
    for (let x = word.x0; x <= end; x += 2) {
      const y = baseline + 4 * Math.sin((x + word.seed * 7) * 0.45);
      if (x === word.x0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  board.texture.needsUpdate = true;
}

export class IsoEffects {
  private readonly leds: { mesh: THREE.Object3D; phase: number }[] = [];
  private readonly screens = new Map<
    string,
    { mesh: THREE.Mesh; idle: THREE.Material | THREE.Material[] }
  >();
  private readonly code = codeTexture();
  private readonly codeMaterial = new THREE.MeshBasicMaterial({
    map: this.code,
  });
  private readonly alarmMaterial = new THREE.MeshBasicMaterial({
    color: ALARM_COLORS[0],
  });
  private readonly board: Board | null = null;
  private wasPlanning = false;
  private readonly doors: { mesh: THREE.Object3D; side: number }[] = [];
  private doorsOpen = 0;
  private tv: {
    mesh: THREE.Mesh;
    off: THREE.Material | THREE.Material[];
  } | null = null;
  private readonly tvOn = new THREE.MeshBasicMaterial();
  /** The whiteboard's to-do note slots, in order. */
  private readonly notes: THREE.Mesh[] = [];
  private readonly globes: THREE.Object3D[] = [];
  private globeTurn = 0;
  private lamp: {
    mesh: THREE.Mesh;
    off: THREE.Material | THREE.Material[];
  } | null = null;
  private arrow: THREE.MeshBasicMaterial | null = null;
  private readonly lampOn = new THREE.MeshBasicMaterial({
    color: LAMP_COLOR,
  });
  private lastArrival: number | null = null;
  /** Paper confetti, falling from ``confettiStart`` (s) once work ships. */
  private readonly confetti = new THREE.Group();
  private confettiPending = false;
  private confettiStart: number | null = null;
  /** The tray beside Claude's iMac, its sheets, the one falling in and its note. */
  private readonly tray = new THREE.Group();
  private readonly sheets: THREE.Mesh[] = [];
  private readonly dropping: THREE.Mesh;
  private readonly sheetNote: CSS2DObject;
  private readonly sheetText: HTMLDivElement;
  private sheetCount = 0;
  private sheetSeen: string | null = null;
  private dropPending = false;
  private dropStart: number | null = null;

  constructor(office: THREE.Object3D) {
    this.tray.add(box(0.66, 0.04, 0.48, "#475569"));
    this.tray.add(box(0.66, 0.12, 0.03, "#475569", 0, 0, -0.23));
    for (let i = 0; i < MAX_SHEETS; i++) {
      const sheet = box(0.54, SHEET_THICKNESS * 0.8, 0.38, "#f8fafc");
      sheet.position.y = 0.05 + i * SHEET_THICKNESS;
      sheet.rotation.y = ((i * 37) % 7) * 0.03 - 0.09;
      sheet.visible = false;
      this.sheets.push(sheet);
      this.tray.add(sheet);
    }
    this.dropping = box(0.54, SHEET_THICKNESS * 0.8, 0.38, "#f8fafc");
    this.dropping.visible = false;
    this.tray.add(this.dropping);
    this.sheetText = document.createElement("div");
    this.sheetText.className =
      "line-clamp-2 max-w-[220px] rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium leading-snug text-slate-800 shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
    this.sheetNote = new CSS2DObject(this.sheetText);
    this.sheetNote.position.set(0, 1.1, 0);
    this.sheetNote.visible = false;
    this.tray.add(this.sheetNote);

    const piece = new THREE.PlaneGeometry(0.32, 0.2);
    for (let i = 0; i < CONFETTI_PIECES; i++) {
      const mesh = new THREE.Mesh(
        piece,
        new THREE.MeshBasicMaterial({
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          side: THREE.DoubleSide,
        }),
      );
      this.confetti.add(mesh);
    }
    this.confetti.visible = false;
    office.add(this.confetti);

    const found: { whiteboard?: THREE.Object3D } = {};
    office.traverse((object) => {
      if (typeof object.userData.ledPhase === "number") {
        this.leds.push({ mesh: object, phase: object.userData.ledPhase });
      }
      if (typeof object.userData.elevatorDoor === "number") {
        this.doors.push({ mesh: object, side: object.userData.elevatorDoor });
      }
      if (
        typeof object.userData.todoNote === "number" &&
        object instanceof THREE.Mesh
      ) {
        this.notes[object.userData.todoNote] = object;
      }
      if (object.userData.globeSpin) this.globes.push(object);
      if (object.userData.elevatorLamp && object instanceof THREE.Mesh) {
        this.lamp = { mesh: object, off: object.material };
      }
      if (
        object.userData.elevatorArrow &&
        object instanceof THREE.Mesh &&
        object.material instanceof THREE.MeshBasicMaterial
      ) {
        this.arrow = object.material;
      }
      if (object.userData.tvScreen && object instanceof THREE.Mesh) {
        this.tv = { mesh: object, off: object.material };
      }
      const item = object.userData.furniture as Furniture | undefined;
      if (item?.kind === "whiteboard") found.whiteboard = object;
      if (item?.kind === "imac") {
        // Claude's iMac has the commit tray beside it.
        if (
          placeKey(item.x, item.z) ===
          placeKey(CLAUDE_SEAT.x, CLAUDE_SEAT.z - SEAT_TO_SCREEN)
        ) {
          this.tray.position.set(item.x + 0.85, item.y ?? 0, item.z + 0.05);
        }
        const screen = object.children.find((c) => c.userData.imacScreen);
        if (screen instanceof THREE.Mesh) {
          this.screens.set(placeKey(item.x, item.z), {
            mesh: screen,
            idle: screen.material,
          });
        }
      }
    });
    if (found.whiteboard) this.board = makeBoard(found.whiteboard);
    office.add(this.tray);
    this.setNotes(null);
  }

  /**
   * Stick a note on the whiteboard per to-do, coloured by its status. With
   * no list yet the board keeps three plain notes, as it always had.
   */
  setNotes(statuses: readonly NoteStatus[] | null): void {
    const shown = statuses ?? DEFAULT_NOTES;
    this.notes.forEach((note, i) => {
      const status = shown[i];
      note.visible = status !== undefined;
      if (status) note.material = material(NOTE_COLORS[status]);
    });
  }

  /**
   * Fill the tray with a sheet per commit. A new commit made just now drops
   * its sheet in and shows its message's first line over the tray.
   */
  setCommits(commits: {
    count: number;
    last: { id: string; title: string; at: number } | null;
  }): void {
    const { last } = commits;
    const fresh =
      last !== null &&
      last.id !== this.sheetSeen &&
      Date.now() - last.at < FRESH_MS;
    this.sheetSeen = last?.id ?? null;
    this.sheetCount = Math.min(commits.count, MAX_SHEETS);
    this.sheets.forEach((sheet, i) => {
      // The falling one joins the pile when it lands.
      sheet.visible = i < this.sheetCount - (fresh ? 1 : 0);
    });
    if (!fresh) return;
    this.sheetText.textContent = `📄 ${last.title}`.trim();
    this.dropPending = true;
  }

  /** The newest sheet falling into the tray, its line shown a while after. */
  private drop(seconds: number): void {
    if (this.dropPending) {
      this.dropPending = false;
      this.dropStart = seconds;
    }
    if (this.dropStart === null) return;
    const t = seconds - this.dropStart;
    const top = Math.max(0, this.sheetCount - 1);
    const landed = t >= SHEET_DROP_SECONDS;
    this.dropping.visible = !landed;
    this.dropping.position.y =
      0.05 + top * SHEET_THICKNESS + (landed ? 0 : 1 - t / SHEET_DROP_SECONDS);
    if (landed && this.sheets[top]) this.sheets[top].visible = true;
    this.sheetNote.visible = t < SHEET_NOTE_SECONDS;
    if (!this.sheetNote.visible) this.dropStart = null;
  }

  /** Work just shipped: let paper confetti fall over the office. */
  burst(): void {
    this.confettiPending = true;
  }

  /** Scatter the pieces over the floor high up, then let them flutter down. */
  private fall(seconds: number): void {
    if (this.confettiPending) {
      this.confettiPending = false;
      this.confettiStart = seconds;
      const random = seeded(Math.floor(seconds * 1000) % 233280);
      for (const mesh of this.confetti.children) {
        mesh.userData.from = {
          x: 1 + random() * (FLOOR_WIDTH - 2),
          y: CONFETTI_TOP + random() * 3,
          z: 1 + random() * (FLOOR_DEPTH - 2),
          sway: random() * Math.PI * 2,
          spin: 3 + random() * 5,
        };
      }
    }
    if (this.confettiStart === null) return;
    const t = seconds - this.confettiStart;
    if (t > CONFETTI_SECONDS) {
      this.confettiStart = null;
      this.confetti.visible = false;
      return;
    }
    this.confetti.visible = true;
    for (const mesh of this.confetti.children) {
      const from = mesh.userData.from as {
        x: number;
        y: number;
        z: number;
        sway: number;
        spin: number;
      };
      mesh.position.set(
        from.x + 0.4 * Math.sin(t * 3 + from.sway),
        from.y - CONFETTI_FALL * t,
        from.z + 0.4 * Math.cos(t * 2.5 + from.sway),
      );
      mesh.rotation.set(t * from.spin, t * from.spin * 0.7, from.sway);
    }
  }

  /** Bring the rooms up to date for this frame; ``seconds`` is the clock. */
  update(seconds: number, dt: number, inUse: RoomsInUse): void {
    this.fall(seconds);
    this.drop(seconds);
    const speed = inUse.serverBusy ? LED_BUSY_SPEED : LED_IDLE_SPEED;
    for (const led of this.leds) {
      led.mesh.visible = Math.sin(seconds * speed + led.phase) > -0.35;
    }

    const typing = new Set(
      inUse.editingSeats.map((seat: IsoSpot) =>
        placeKey(seat.x, seat.z - SEAT_TO_SCREEN),
      ),
    );
    const alarmed = new Set(
      inUse.alarmSeats.map((seat: IsoSpot) =>
        placeKey(seat.x, seat.z - SEAT_TO_SCREEN),
      ),
    );
    this.alarmMaterial.color.set(
      ALARM_COLORS[Math.floor(seconds * ALARM_FLASHES * 2) % 2],
    );
    for (const [key, screen] of this.screens) {
      screen.mesh.material = alarmed.has(key)
        ? this.alarmMaterial
        : typing.has(key)
          ? this.codeMaterial
          : screen.idle;
    }
    this.code.offset.y -= dt * CODE_SCROLL_SPEED;

    if (this.board) {
      // A new round of planning on a full board starts on a clean one.
      if (inUse.planning && !this.wasPlanning && this.board.progress >= 1) {
        this.board.progress = 0;
      }
      if (inUse.planning) {
        this.board.progress = Math.min(
          1,
          this.board.progress + dt / BOARD_FILL_SECONDS,
        );
      }
      const percent = Math.floor(this.board.progress * 100);
      if (percent !== this.board.drawnPercent) {
        this.board.drawnPercent = percent;
        drawBoard(this.board);
      }
    }
    this.wasPlanning = inUse.planning;

    // A show on the TV: colours drifting, with the odd cut to a new scene.
    if (this.tv) {
      this.tv.mesh.material = inUse.tvOn ? this.tvOn : this.tv.off;
      if (inUse.tvOn) {
        const scene = Math.floor(seconds / TV_SCENE_SECONDS);
        const hue = (scene * 0.37 + seconds * 0.02) % 1;
        const flicker = 0.55 + 0.08 * Math.sin(seconds * 9);
        this.tvOn.color.setHSL(hue, 0.55, flicker);
      }
    }

    // The lamp over the elevator: dark until someone steps out.
    if (inUse.arriving) this.lastArrival = seconds;
    const lit = lampLit(this.lastArrival, seconds);
    if (this.lamp) this.lamp.mesh.material = lit ? this.lampOn : this.lamp.off;
    if (this.arrow) this.arrow.opacity = lit ? 1 : ARROW_DIM;

    this.globeTurn = globeSpeed(this.globeTurn, inUse.browsing, dt);
    for (const globe of this.globes) globe.rotation.y += this.globeTurn * dt;

    const target = inUse.elevatorOpen ? 1 : 0;
    const step = DOOR_SPEED * dt;
    this.doorsOpen += Math.max(-step, Math.min(step, target - this.doorsOpen));
    for (const door of this.doors) {
      door.mesh.position.x =
        door.side * (DOOR_CLOSED_X + DOOR_SLIDE * this.doorsOpen);
      door.mesh.scale.x = 1 - (1 - DOOR_OPEN_WIDTH) * this.doorsOpen;
    }
  }

  dispose(): void {
    this.code.dispose();
    this.codeMaterial.dispose();
    this.alarmMaterial.dispose();
    this.tvOn.dispose();
    this.lampOn.dispose();
    if (this.board) {
      this.board.texture.dispose();
      this.board.mesh.geometry.dispose();
      (this.board.mesh.material as THREE.Material).dispose();
    }
  }
}
