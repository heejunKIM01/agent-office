/**
 * The isometric construction site (설정 「장소」 · 건설 현장): the site from
 * buildSite.ts and everyone on it, apart from the office and the airport.
 * Claude is the site manager and I am the owner; every subagent, and the
 * lead agent of every other session at work, is a worker. Each wears a
 * hard-hat tag: its code and name, and what it is doing put the site's
 * way (systems/siteTalk.ts).
 *
 * People walk to the spot their tool calls for (systems/siteWalk.ts):
 * the plan table to read, the building's scaffold to edit, the excavator
 * to run commands, the yard for the web and outside tools, the schedule
 * board for plans, and me for a question. Workers who edit ride the
 * hoist up and work on the roof. Between turns the manager sits
 * in the rest tent, with a coffee while the conversation is compacted,
 * and nods off after a long rest. A new worker comes in through the gate
 * and a finished one walks out through it. Each commit has the crane lift
 * a slab onto the roof, one more floor, and a concrete mixer comes to
 * pour; the excavator digs while someone runs a command, and a dump truck
 * comes for the earth. The schedule board shows the to-do list.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  BUILDING,
  GATE,
  HOIST,
  HOIST_FOOT,
  HOIST_TOP,
  ROOF_SPOTS,
  MAX_FLOORS,
  FLOOR_HEIGHT,
  FOUNDATION_HEIGHT,
  OUTSIDE,
  OWNER_SPOT,
  SITE_CENTER,
  SITE_DEPTH,
  SITE_WIDTH,
  WORK_SPOTS,
  CRANE,
  type SiteSpot,
  type WorkSpot,
} from "@/constants/sitePlan";
import { myQuestion, secondsBetween, type TalkLine } from "@/systems/placeTalk";
import type { NoteStatus } from "@/systems/roomGimmicks";
import { rideSeconds } from "@/systems/siteMachines";
import { siteLine, type SiteWords } from "@/systems/siteTalk";
import {
  floorsFor,
  routeTo,
  SPOT_FOR_ACTIVITY,
  stepWalk,
  type Point,
  type Walker,
} from "@/systems/siteWalk";
import type { IsoPerson, IsoWorld, PlaceWords } from "../isoWorld";
import { buildSite, PLATE_THICKNESS, type SiteScene } from "./buildSite";
import {
  buildSiteFigure,
  poseSiteFigure,
  type SiteFigure,
  type SitePose,
} from "./siteFigures";
import {
  drawSiteLine,
  floorSign,
  nameSiteTag,
  siteTag,
  type SiteTag,
} from "./siteLabels";
import { SITE } from "./sitePalette";

/** How long I pass on my question after sending it (ms). */
const REQUEST_MS = 4000;
/** Resting this long since the last event, the manager nods off (ms). */
const DOZE_AFTER_MS = 5 * 60_000;
/** How long everyone cheers when work ships (ms). */
const SHIP_MS = 3000;
/**
 * Workers who turn up this soon after a snapshot are part of it: other
 * sessions' lead agents come on a socket of their own, a moment later.
 */
const SNAPSHOT_MS = 3000;
/** Just inside the gate, on the way in or out. */
const GATE_INSIDE: Point = { x: GATE.x, z: SITE_DEPTH - 2.5 };

/** Where someone is headed: a work spot and its place there, or out of the gate. */
type Goal =
  | { kind: "spot"; spot: WorkSpot; slot: number }
  | { kind: "exit" }
  | { kind: "none" };

interface Placed {
  person: IsoPerson;
  figure: SiteFigure;
  tag: SiteTag;
  label: CSS2DObject;
  walker: Walker;
  goal: Goal;
  thinkingSince: number | null;
  /** Gone from the session's list: it walks out before it goes. */
  ghost: boolean;
  /** What it says on its way out, read as it leaves. */
  report: string | null;
  /** On the ground or up on the roof. */
  level: "ground" | "roof";
  /** The hoist ride to take once the walk ends, up or down. */
  board: "up" | "down" | null;
  /** In the hoist's cage: from what height, which way, since when (ms). */
  ride: { from: number; up: boolean; start: number } | null;
}

/** A worker's hard-hat colour and the letter of its crew. */
function crew(person: IsoPerson): { hat: string; letter: string } {
  if (person.kind === "colleague")
    return { hat: SITE.hatColleague, letter: "C" };
  if (person.outfit === "explore") return { hat: SITE.hatExplore, letter: "E" };
  if (person.outfit === "plan") return { hat: SITE.hatPlan, letter: "P" };
  return { hat: SITE.hatGeneral, letter: "B" };
}

function workerCode(person: IsoPerson): string {
  let hash = 0;
  for (const ch of person.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `${crew(person).letter}-${100 + (hash % 900)}`;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const STUB_WORDS: SiteWords = {
  reading: "",
  editing: "",
  running: "",
  browsing: "",
  planning: "",
  asking: "",
  thinking: () => "",
  trouble: "",
  done: "",
  handover: "",
  called: "",
  request: "",
  manager: "",
  owner: "",
};

const BOARD_COLORS: Record<NoteStatus, string> = {
  pending: "#9cc3f5",
  in_progress: "#f7d774",
  completed: "#9ee0a8",
};

class Site implements IsoWorld {
  readonly width = SITE_WIDTH;
  readonly depth = SITE_DEPTH;
  readonly center = SITE_CENTER;
  private readonly field: SiteScene;
  private readonly placed = new Map<string, Placed>();
  /** Subagents that walked out, kept out until the session lets them go. */
  private readonly departed = new Set<string>();
  /** Which place at each work spot each person holds. */
  private readonly held = new Map<WorkSpot, Map<string, number>>();
  private fresh = true;
  private snapshotUntil = 0;
  private words: SiteWords = STUB_WORDS;
  private shipPending = false;
  private shippedAt: number | null = null;
  /** The next commit count is a snapshot: the building just stands at it. */
  private commitsFresh = true;
  private targetFloors = 1;
  /** The hoist's cage: where its last rider left it. */
  private cageY = 0;
  private readonly sign: CSS2DObject;
  private readonly signText: HTMLSpanElement;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly onLeft: (id: string) => void,
  ) {
    this.field = buildSite();
    scene.add(this.field.root);
    const sign = floorSign();
    this.signText = sign.text;
    this.sign = new CSS2DObject(sign.element);
    this.sign.center.set(0.5, 1);
    scene.add(this.sign);
    this.showFloors();
    this.setNotes(null);
  }

  outline(): THREE.Vector3[] {
    const corners: [number, number][] = [
      [0, 0],
      [SITE_WIDTH, 0],
      [0, SITE_DEPTH],
      [SITE_WIDTH, SITE_DEPTH],
    ];
    const top = FOUNDATION_HEIGHT + MAX_FLOORS * FLOOR_HEIGHT;
    return [
      ...corners.map(([x, z]) => new THREE.Vector3(x, -PLATE_THICKNESS, z)),
      new THREE.Vector3(BUILDING.x, top, BUILDING.z),
      new THREE.Vector3(CRANE.x, CRANE.mast + 4, CRANE.z),
    ];
  }

  setWords(words: PlaceWords): void {
    this.words = words.site;
    for (const placed of this.placed.values()) {
      placed.tag.lineKey = "redraw";
      this.name(placed);
    }
  }

  sync(people: IsoPerson[]): void {
    const ids = new Set(people.map((person) => person.id));
    for (const [id, placed] of this.placed) {
      if (ids.has(id)) continue;
      // A worker gone from the list walks out first; the rest leave at once.
      if (
        placed.person.kind === "subagent" ||
        placed.person.kind === "colleague"
      ) {
        placed.ghost = true;
      } else {
        this.remove(id, placed);
      }
    }
    for (const id of this.departed) {
      if (!ids.has(id)) this.departed.delete(id);
    }
    for (const person of people) {
      const placed = this.placed.get(person.id);
      if (placed) {
        placed.person = person;
        placed.ghost = false;
        this.name(placed);
        continue;
      }
      if (this.departed.has(person.id)) {
        if (person.leaving) continue;
        this.departed.delete(person.id);
      }
      this.add(person);
    }
    if (this.fresh) this.snapshotUntil = performance.now() + SNAPSHOT_MS;
    this.fresh = false;
  }

  private add(person: IsoPerson): void {
    const works = person.kind === "subagent" || person.kind === "colleague";
    const role =
      person.kind === "claude"
        ? "manager"
        : person.kind === "me"
          ? "owner"
          : "worker";
    const figure = buildSiteFigure(role, crew(person).hat);
    const tag = siteTag(
      works
        ? crew(person).hat
        : person.kind === "claude"
          ? SITE.manager
          : SITE.owner,
    );
    const label = new CSS2DObject(tag.element);
    label.center.set(0.5, 1);
    figure.tagAnchor.add(label);
    this.scene.add(figure.root);
    const placed: Placed = {
      person,
      figure,
      tag,
      label,
      walker: {
        x: OWNER_SPOT.x,
        z: OWNER_SPOT.z,
        facing: OWNER_SPOT.facing,
        path: [],
      },
      goal: { kind: "none" },
      thinkingSince: null,
      ghost: false,
      report: null,
      level: "ground",
      board: null,
      ride: null,
    };
    this.placed.set(person.id, placed);
    this.name(placed);
    if (person.kind === "me") return;
    // A snapshot finds everyone at work already (editing workers up on the
    // roof); a worker made while the site is watched comes in through the gate.
    const inSnapshot = this.fresh || performance.now() < this.snapshotUntil;
    const goal = this.goalFor(placed);
    placed.goal = goal;
    if (inSnapshot || !works) {
      const target = this.targetOf(placed, goal);
      placed.walker = {
        x: target.x,
        z: target.z,
        facing: target.facing,
        path: [],
      };
      if (this.onRoof(placed, goal)) placed.level = "roof";
    } else {
      placed.walker = {
        x: OUTSIDE.x,
        z: OUTSIDE.z,
        facing: OUTSIDE.facing,
        path: [],
      };
      this.plan(placed);
    }
  }

  /** The code and title on a tag: 소장, 건축주 or a worker's number. */
  private name(placed: Placed): void {
    const { person } = placed;
    if (person.kind === "claude")
      nameSiteTag(placed.tag, this.words.manager, person.label);
    else if (person.kind === "me")
      nameSiteTag(placed.tag, this.words.owner, person.label);
    else
      nameSiteTag(
        placed.tag,
        workerCode(person),
        clip(person.title || person.label, 22),
      );
  }

  /** Where a person's work sends it now. */
  private goalFor(placed: Placed): Goal {
    const { person } = placed;
    const leaving = placed.ghost || person.leaving;
    if (person.kind !== "claude" && leaving) return { kind: "exit" };
    // A tool at work outweighs a break, as in the office: a session seen
    // mid-turn (no prompt of its own yet) still works where its tool is.
    let spot: WorkSpot;
    if (person.activity) spot = SPOT_FOR_ACTIVITY[person.activity];
    else if (person.kind === "claude" && person.breakRoom !== null)
      spot = "rest";
    else spot = person.kind === "claude" ? "plans" : "build";
    return { kind: "spot", spot, slot: this.claim(spot, person.id) };
  }

  /** Hold a place at ``spot`` for ``id``: its own if it has one, else the first free. */
  private claim(spot: WorkSpot, id: string): number {
    for (const [other, places] of this.held) {
      if (other !== spot) places.delete(id);
    }
    const places = this.held.get(spot) ?? new Map<string, number>();
    this.held.set(spot, places);
    const mine = places.get(id);
    if (mine !== undefined) return mine;
    const taken = new Set(places.values());
    const count = WORK_SPOTS[spot].length;
    let slot = 0;
    while (slot < count && taken.has(slot)) slot++;
    if (slot === count) slot = places.size % count;
    places.set(id, slot);
    return slot;
  }

  /** Workers who edit code work up on the roof; the manager points from below. */
  private onRoof(placed: Placed, goal: Goal): boolean {
    return (
      goal.kind === "spot" &&
      goal.spot === "build" &&
      placed.person.kind !== "claude"
    );
  }

  private targetOf(placed: Placed, goal: Goal): SiteSpot {
    if (this.onRoof(placed, goal) && goal.kind === "spot")
      return ROOF_SPOTS[goal.slot];
    if (goal.kind === "spot") return WORK_SPOTS[goal.spot][goal.slot];
    if (goal.kind === "exit") return OUTSIDE;
    const { walker } = placed;
    return { x: walker.x, z: walker.z, facing: walker.facing };
  }

  /**
   * Lay out the walk to the goal from where the person is: on the ground
   * by way of the gate when outside, round the building, and by the hoist
   * to get on or off the roof.
   */
  private plan(placed: Placed): void {
    const { goal, walker } = placed;
    const roofWork = this.onRoof(placed, goal);
    placed.board = null;
    if (placed.level === "roof") {
      if (roofWork) {
        walker.path = [this.targetOf(placed, goal)];
      } else {
        walker.path = [HOIST_TOP, HOIST];
        placed.board = "down";
      }
      return;
    }
    const here = { x: walker.x, z: walker.z };
    // Coming in from outside, or stepping out of the hoist's cage.
    const lead: Point[] =
      here.z > SITE_DEPTH
        ? [GATE_INSIDE]
        : Math.hypot(here.x - HOIST.x, here.z - HOIST.z) < 0.5
          ? [HOIST_FOOT]
          : [];
    const from = lead[0] ?? here;
    if (roofWork) {
      walker.path = [...lead, ...routeTo(from, HOIST_FOOT), HOIST];
      placed.board = "up";
    } else if (goal.kind === "exit") {
      walker.path = [...lead, ...routeTo(from, GATE_INSIDE), OUTSIDE];
    } else {
      walker.path = [...lead, ...routeTo(from, this.targetOf(placed, goal))];
    }
  }

  update(now: number, dt: number): void {
    if (this.shipPending) {
      this.shipPending = false;
      this.shippedAt = now;
    }
    const manager = [...this.placed.values()].find(
      (p) => p.person.kind === "claude",
    );
    const busy =
      manager !== undefined &&
      (manager.person.activity !== null || manager.person.thinking);
    const { crane, building, excavator, hoist, traffic } = this.field;
    crane.update(now, busy, building.roofY);
    // The excavator digs while someone runs a command at it.
    const digging = [...this.placed.values()].some(
      (p) =>
        p.person.activity === "running" &&
        p.goal.kind === "spot" &&
        p.goal.spot === "machines" &&
        p.walker.path.length === 0,
    );
    const dumps = excavator.update(dt, digging, traffic.loading);
    if (traffic.loading) traffic.loaded(dumps);
    traffic.update(now, dt, digging);
    const gone: string[] = [];
    for (const [id, placed] of this.placed) {
      if (placed.person.kind === "me") {
        this.tendOwner(placed, now, manager?.person ?? null);
        continue;
      }
      if (this.move(placed, dt, now)) {
        gone.push(id);
        continue;
      }
      this.work(placed, now);
    }
    hoist.update(building.roofY, this.cageY);
    for (const id of gone) {
      const placed = this.placed.get(id);
      if (!placed) continue;
      this.remove(id, placed);
      if (placed.person.kind === "subagent" && !placed.ghost) {
        this.departed.add(id);
        this.onLeft(id);
      }
    }
  }

  /** Walk a person towards its goal; true when it has walked out of the gate. */
  private move(placed: Placed, dt: number, now: number): boolean {
    const goal = this.goalFor(placed);
    const changed =
      goal.kind !== placed.goal.kind ||
      (goal.kind === "spot" &&
        placed.goal.kind === "spot" &&
        (goal.spot !== placed.goal.spot || goal.slot !== placed.goal.slot));
    if (changed) {
      placed.goal = goal;
      // A rider finishes the ride first and plans from where it gets off.
      if (!placed.ride) this.plan(placed);
    }
    const { figure } = placed;
    const roofY = this.field.building.roofY;
    if (placed.ride) {
      const { from, up, start } = placed.ride;
      const to = up ? roofY : 0;
      const k = Math.min(1, (now - start) / (rideSeconds(to - from) * 1000));
      const y = from + (to - from) * k;
      this.cageY = y;
      figure.root.position.set(HOIST.x, y, HOIST.z);
      if (k >= 1) {
        placed.ride = null;
        placed.level = up ? "roof" : "ground";
        placed.walker = { ...placed.walker, x: HOIST.x, z: HOIST.z, path: [] };
        this.plan(placed);
      }
      return false;
    }
    placed.walker = stepWalk(placed.walker, dt);
    const { walker } = placed;
    if (walker.path.length === 0 && placed.board) {
      // At the cage: ride it up to the roof or down to the ground.
      placed.ride = {
        from: placed.level === "roof" ? roofY : 0,
        up: placed.board === "up",
        start: now,
      };
      placed.board = null;
      walker.facing = 0;
    }
    figure.root.position.set(
      walker.x,
      placed.level === "roof" ? roofY : 0,
      walker.z,
    );
    if (walker.path.length === 0 && !placed.ride) {
      if (goal.kind === "exit") return placed.level === "ground";
      walker.facing = this.targetOf(placed, goal).facing;
    }
    figure.root.rotation.y = walker.facing;
    return false;
  }

  /** Pose a person at work (or on the way) and write its tag. */
  private work(placed: Placed, now: number): void {
    const { person, walker, goal } = placed;
    const manager = person.kind === "claude";
    let pose: SitePose = "walk";
    let line: TalkLine | null = this.talk(placed, now);
    if (goal.kind === "exit") {
      const { bubble } = person;
      placed.report ??= bubble?.type === "speech" ? bubble.text : null;
      line = {
        icon: "👷",
        text: placed.report ?? this.words.done,
        detail: null,
        tone: "say",
      };
      pose = placed.ride
        ? "stand"
        : walker.path.length > 0 || placed.board
          ? "walk"
          : "wave";
    } else if (placed.ride) {
      pose = "stand";
    } else if (walker.path.length === 0 && goal.kind === "spot") {
      pose = this.poseAt(goal.spot, manager);
      if (goal.spot === "rest" && manager) {
        const restedMs = Date.now() - (person.idleSince ?? Date.now());
        if (person.breakRoom === "cafe") {
          pose = "coffee";
          line = {
            icon: "📝",
            text: this.words.handover,
            detail: null,
            tone: "think",
          };
        } else if (restedMs >= DOZE_AFTER_MS) {
          pose = "doze";
          line = { icon: "💤", text: "", detail: null, tone: "think" };
        }
      }
      if (this.shippedAt !== null && now - this.shippedAt < SHIP_MS)
        pose = "cheer";
    }
    poseSiteFigure(placed.figure, pose, now / 1000);
    drawSiteLine(placed.tag, line);
  }

  private poseAt(spot: WorkSpot, manager: boolean): SitePose {
    switch (spot) {
      case "plans":
        return "plans";
      case "build":
        return manager ? "point" : "build";
      case "machines":
        return manager ? "point" : "operate";
      case "yard":
        return "check";
      case "board":
        return manager ? "point" : "check";
      case "owner":
        return "talk";
      case "rest":
        return "sit";
    }
  }

  /** Me, the owner: the phone when the manager calls, passing on my question. */
  private tendOwner(
    placed: Placed,
    now: number,
    manager: IsoPerson | null,
  ): void {
    const { person, figure } = placed;
    figure.root.position.set(OWNER_SPOT.x, 0, OWNER_SPOT.z);
    figure.root.rotation.y = OWNER_SPOT.facing;
    let pose: SitePose = "stand";
    let line: TalkLine | null = null;
    if (this.shippedAt !== null && now - this.shippedAt < SHIP_MS) {
      pose = "cheer";
    } else if (manager?.activity === "asking") {
      pose = "phone";
      line = {
        icon: "☎️",
        text: this.words.called,
        detail: null,
        tone: "alert",
      };
    } else if (
      person.typedAt !== null &&
      Date.now() - person.typedAt < REQUEST_MS
    ) {
      pose = "talk";
      const question = manager ? myQuestion(manager.bubble) : null;
      line = {
        icon: "📢",
        text: question ?? this.words.request,
        detail: null,
        tone: "say",
      };
    }
    poseSiteFigure(figure, pose, now / 1000);
    drawSiteLine(placed.tag, line);
  }

  /** What a person's tag says from the session, the site's way. */
  private talk(placed: Placed, now: number): TalkLine | null {
    const { person } = placed;
    if (person.thinking)
      placed.thinkingSince =
        person.since === null
          ? (placed.thinkingSince ?? now)
          : now - (Date.now() - person.since);
    else placed.thinkingSince = null;
    return siteLine(
      {
        activity: person.activity,
        bubble: person.bubble,
        bubbleAgeMs:
          person.bubbleAt === null ? null : Date.now() - person.bubbleAt,
        stuck: person.stuck,
        thinkingSeconds:
          placed.thinkingSince === null
            ? null
            : secondsBetween(placed.thinkingSince, now),
      },
      this.words,
    );
  }

  /** Put the floor count over the roof. */
  private showFloors(): void {
    const { building } = this.field;
    this.signText.textContent = `${building.floorCount}F`;
    this.sign.position.set(
      BUILDING.x + BUILDING.w / 2,
      building.roofY + 1.6,
      BUILDING.z + BUILDING.d / 2,
    );
  }

  setCommits(commits: { count: number }): void {
    const target = floorsFor(commits.count);
    const { building, crane } = this.field;
    if (this.commitsFresh) {
      this.commitsFresh = false;
      this.targetFloors = target;
      building.setFloors(target);
      this.showFloors();
      return;
    }
    const before = this.targetFloors;
    this.targetFloors = target;
    if (target < building.floorCount) {
      building.setFloors(target);
      this.showFloors();
      return;
    }
    // A slab a commit: the crane sets each one on the roof in turn, and a
    // mixer comes in to pour.
    if (target > before) this.field.traffic.pour();
    for (let floor = before; floor < target; floor++) {
      crane.lift(() => {
        building.setFloors(
          Math.min(this.targetFloors, building.floorCount + 1),
        );
        this.showFloors();
      });
    }
  }

  /** The schedule board: a bar a to-do, coloured by how far it got. */
  setNotes(statuses: readonly NoteStatus[] | null): void {
    const { canvas, texture } = this.field.board;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#1d2433";
    ctx.font =
      '800 34px "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif';
    ctx.textBaseline = "middle";
    ctx.fillText("공정표 · SCHEDULE", 22, 34);
    const rows = (statuses ?? ["completed", "in_progress", "pending"]).slice(
      0,
      6,
    );
    rows.forEach((status, i) => {
      const y = 78 + i * 38;
      const done =
        status === "completed" ? 1 : status === "in_progress" ? 0.55 : 0.12;
      ctx.fillStyle = "#e5e9ef";
      ctx.fillRect(70, y, width - 100, 22);
      ctx.fillStyle = BOARD_COLORS[status];
      ctx.fillRect(70, y, (width - 100) * done, 22);
      ctx.fillStyle = "#5b6779";
      ctx.font = '700 22px "Pretendard", system-ui, sans-serif';
      ctx.fillText(String(i + 1).padStart(2, "0"), 22, y + 12);
    });
    texture.needsUpdate = true;
  }

  setTurn(): void {}

  hearts(): void {}

  ship(): void {
    this.shipPending = true;
  }

  clear(): void {
    for (const [id, placed] of this.placed) this.remove(id, placed);
    this.departed.clear();
    this.held.clear();
    this.fresh = true;
    this.commitsFresh = true;
  }

  dispose(): void {
    this.clear();
    this.field.traffic.dispose();
    this.sign.removeFromParent();
  }

  private remove(id: string, placed: Placed): void {
    // Removing the label itself takes its element off the page.
    placed.label.removeFromParent();
    this.scene.remove(placed.figure.root);
    placed.figure.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    for (const places of this.held.values()) places.delete(id);
    this.placed.delete(id);
  }
}

/** The construction site, built into ``scene``; ``onLeft`` hears of each subagent that walked out. */
export function createSite(
  scene: THREE.Scene,
  onLeft: (id: string) => void,
): IsoWorld {
  return new Site(scene, onLeft);
}
