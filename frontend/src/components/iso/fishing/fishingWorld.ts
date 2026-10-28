/**
 * The isometric reservoir fishing spot (설정 「장소」 · 낚시터): the spot from
 * buildFishing.ts and everyone in it, apart from the other places. Claude
 * is the boss who runs the spot and I am the guest fishing from my hut;
 * every subagent, and the lead agent of every other session at work, is an
 * angler. Each wears a tag painted like a float: its code and name, and
 * what it is doing put the angler's way (systems/fishingTalk.ts).
 *
 * People walk to the spot their tool calls for (systems/fishingWalk.ts),
 * on the banks, the deck, the pontoon and the huts only: the pontoon to
 * read, a rigged seat on the deck or the west hut to edit (sitting behind
 * three rods, eyes on the floats), the shrimp net off the pontoon's end to
 * run commands, the office counter for the web and outside tools, the
 * chalkboard for plans, and my hut for a question. The boss's own place is
 * at the office door. Between turns it sits on the rest platform with cup
 * noodles, writes the fishing log while the conversation is compacted, and
 * dozes with its cap over its face after a long rest. A new angler comes in
 * through the entrance and a finished one walks out through it. Each commit
 * lands a fish (systems/fishingCatch.ts): someone at work stands to show it
 * off, it goes into the tank by the office, and the catch board counts it
 * under the commit's title. The chalkboard shows the to-do list as fish to
 * catch. The floats bob, two ducks paddle round and a heron waits in the
 * shallows. The dark theme brings a moonlit night: the floats' chemical
 * lights pulse green, lamps, windows and the tent glow warm, the campfire
 * flickers, the moon's glade shimmers on the water, fireflies drift over
 * the shallows and mist creeps over the water.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  ENTRANCE_INSIDE,
  FISHING_CENTER,
  FISHING_DEPTH,
  FISHING_WIDTH,
  GUEST_SPOT,
  WATER_Y,
  OUTSIDE,
  TANK,
  WORK_SPOTS,
  type FishingSpot,
  type FishingWorkSpot,
} from "@/constants/fishingPlan";
import {
  CATCH_MS,
  SPECIES,
  speciesFor,
  tally,
  tankFor,
  type Species,
} from "@/systems/fishingCatch";
import { fishingLine, type FishingWords } from "@/systems/fishingTalk";
import { routeTo, SPOT_FOR_ACTIVITY } from "@/systems/fishingWalk";
import { stepWalk, type Walker } from "@/systems/placeWalk";
import { myQuestion, secondsBetween, type TalkLine } from "@/systems/placeTalk";
import { CHEER_MS, DISMAY_MS, type NoteStatus } from "@/systems/roomGimmicks";
import type { IsoPerson, IsoWorld, PlaceWords } from "../isoWorld";
import {
  buildFishing,
  PLATE_THICKNESS,
  type FishingScene,
} from "./buildFishing";
import {
  buildFishingFigure,
  holdFish,
  poseFishingFigure,
  type FishingFigure,
  type FishingPose,
} from "./fishingFigures";
import {
  catchSign,
  drawFishingLine,
  fishingTag,
  nameFishingTag,
  type FishingTag,
} from "./fishingLabels";
import { FISH } from "./fishingPalette";
import { lightForNight, shadeForNight } from "./fishingSolids";

/** How long I pass on my question after sending it (ms). */
const REQUEST_MS = 4000;
/** Resting this long since the last event, the boss nods off (ms). */
const DOZE_AFTER_MS = 5 * 60_000;
/** How long everyone cheers when work ships (ms). */
const SHIP_MS = 3000;
/**
 * Anglers who turn up this soon after a snapshot are part of it: other
 * sessions' lead agents come on a socket of their own, a moment later.
 */
const SNAPSHOT_MS = 3000;
/** A caught fish goes into the tank this far into its catch (ms). */
const INTO_TANK_MS = 1200;
/** Turned this way a person faces the camera, to show off a catch. */
const TO_CAMERA = Math.PI / 4;

/** Where someone is headed: a spot and its place there, or out of the entrance. */
type Goal =
  | { kind: "spot"; spot: FishingWorkSpot; slot: number }
  | { kind: "exit" }
  | { kind: "none" };

interface Placed {
  person: IsoPerson;
  figure: FishingFigure;
  tag: FishingTag;
  label: CSS2DObject;
  walker: Walker;
  goal: Goal;
  thinkingSince: number | null;
  /** Gone from the session's list: it walks out before it goes. */
  ghost: boolean;
  /** What it says on its way out, read as it leaves. */
  report: string | null;
  /** The test runs already acted out, and how long it cheers or despairs. */
  seenPass: string | null;
  seenFail: string | null;
  cheerUntil: number;
  dismayUntil: number;
  /** Holding up a catch until then (ms). */
  catchUntil: number;
}

/** An angler's hat colour and the letter of its crew. */
function crew(person: IsoPerson): { hat: string; letter: string } {
  if (person.kind === "colleague")
    return { hat: FISH.hatColleague, letter: "C" };
  if (person.outfit === "explore") return { hat: FISH.hatExplore, letter: "E" };
  if (person.outfit === "plan") return { hat: FISH.hatPlan, letter: "P" };
  return { hat: FISH.hatGeneral, letter: "B" };
}

function anglerCode(person: IsoPerson): string {
  let hash = 0;
  for (const ch of person.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `${crew(person).letter}-${100 + (hash % 900)}`;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const STUB_WORDS: FishingWords = {
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
  boss: "",
  guest: "",
};

/** Each species' colour on the boards, and its name there. */
const SPECIES_BOARD: Record<Species, { color: string; name: string }> = {
  crucian: { color: FISH.crucian, name: "붕어" },
  carp: { color: FISH.carp, name: "잉어" },
  mirror: { color: FISH.mirror, name: "향어" },
  trophy: { color: FISH.trophy, name: "월척" },
};

const CHALK_FILL: Record<NoteStatus, number> = {
  pending: 0,
  in_progress: 0.5,
  completed: 1,
};

const BOARD_FONT = '"Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif';

/** A fish's outline on a board, filled ``fill`` of the way from its tail. */
function drawFishShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  stroke: string,
  fillColor: string,
  fill: number,
): void {
  const outline = (): void => {
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.45, 0, 0, Math.PI * 2);
    ctx.moveTo(x - size * 0.9, y);
    ctx.lineTo(x - size * 1.5, y - size * 0.4);
    ctx.lineTo(x - size * 1.5, y + size * 0.4);
    ctx.closePath();
  };
  if (fill > 0) {
    ctx.save();
    ctx.beginPath();
    const left = x - size * 1.55;
    ctx.rect(left, y - size, size * 2.6 * fill, size * 2);
    ctx.clip();
    outline();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.restore();
  }
  outline();
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.fillStyle = stroke;
  ctx.beginPath();
  ctx.arc(x + size * 0.55, y - size * 0.08, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

class Reservoir implements IsoWorld {
  readonly width = FISHING_WIDTH;
  readonly depth = FISHING_DEPTH;
  readonly center = FISHING_CENTER;
  private readonly field: FishingScene;
  private readonly placed = new Map<string, Placed>();
  /** Subagents that walked out, kept out until the session lets them go. */
  private readonly departed = new Set<string>();
  /** Which place at each spot each person holds. */
  private readonly held = new Map<FishingWorkSpot, Map<string, number>>();
  private fresh = true;
  private snapshotUntil = 0;
  private words: FishingWords = STUB_WORDS;
  private shipPending = false;
  private shippedAt: number | null = null;
  /** The next commit count is a snapshot: the tank just holds it. */
  private commitsFresh = true;
  /** Commits the tank shows, and the latest commit's title. */
  private landed = 0;
  private lastTitle = "";
  /** Fish still to be caught, one after another (the nth of the session). */
  private readonly toCatch: number[] = [];
  private nextCatchAt = 0;
  /** Caught fish on their way into the tank: when, and the count then. */
  private readonly intoTank: { at: number; count: number }[] = [];
  private readonly sign: CSS2DObject;
  private readonly signText: HTMLSpanElement;
  private night = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly onLeft: (id: string) => void,
  ) {
    this.field = buildFishing();
    scene.add(this.field.root);
    const sign = catchSign();
    this.signText = sign.text;
    this.sign = new CSS2DObject(sign.element);
    this.sign.center.set(0.5, 1);
    this.sign.position.set(
      TANK.x + TANK.w / 2,
      this.field.tank.waterTop + 1.4,
      TANK.z + TANK.d / 2,
    );
    scene.add(this.sign);
    this.showCatch(0);
    this.setNotes(null);
  }

  outline(): THREE.Vector3[] {
    const corners: [number, number][] = [
      [0, 0],
      [FISHING_WIDTH, 0],
      [0, FISHING_DEPTH],
      [FISHING_WIDTH, FISHING_DEPTH],
    ];
    return [
      ...corners.map(([x, z]) => new THREE.Vector3(x, -PLATE_THICKNESS, z)),
      new THREE.Vector3(0, 6, 0),
      new THREE.Vector3(FISHING_WIDTH, 6, 0),
    ];
  }

  setWords(words: PlaceWords): void {
    this.words = words.fishing;
    for (const placed of this.placed.values()) {
      placed.tag.lineKey = "redraw";
      this.name(placed);
    }
  }

  sync(people: IsoPerson[]): void {
    const ids = new Set(people.map((person) => person.id));
    for (const [id, placed] of this.placed) {
      if (ids.has(id)) continue;
      // An angler gone from the list walks out first; the rest leave at once.
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
    const fishes = person.kind === "subagent" || person.kind === "colleague";
    const role =
      person.kind === "claude"
        ? "boss"
        : person.kind === "me"
          ? "guest"
          : "angler";
    const figure = buildFishingFigure(role, crew(person).hat);
    const tag = fishingTag(
      fishes
        ? crew(person).hat
        : person.kind === "claude"
          ? FISH.boss
          : FISH.guest,
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
        x: GUEST_SPOT.x,
        z: GUEST_SPOT.z,
        facing: GUEST_SPOT.facing,
        path: [],
      },
      goal: { kind: "none" },
      thinkingSince: null,
      ghost: false,
      report: null,
      seenPass: person.passedTest,
      seenFail: person.failedTest,
      cheerUntil: 0,
      dismayUntil: 0,
      catchUntil: 0,
    };
    this.placed.set(person.id, placed);
    this.name(placed);
    if (person.kind === "me") return;
    // A snapshot finds everyone at work already; an angler made while the
    // spot is watched comes in through the entrance.
    const inSnapshot = this.fresh || performance.now() < this.snapshotUntil;
    const goal = this.goalFor(placed);
    placed.goal = goal;
    const start = inSnapshot || !fishes ? this.targetOf(placed, goal) : OUTSIDE;
    placed.walker = {
      x: start.x,
      z: start.z,
      facing: start.facing,
      path: [],
    };
    if (!inSnapshot && fishes) this.plan(placed);
  }

  /** The code and title on a tag: 선장, 손님 or an angler's number. */
  private name(placed: Placed): void {
    const { person } = placed;
    if (person.kind === "claude")
      nameFishingTag(placed.tag, this.words.boss, person.label);
    else if (person.kind === "me")
      nameFishingTag(placed.tag, this.words.guest, person.label);
    else
      nameFishingTag(
        placed.tag,
        anglerCode(person),
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
    let spot: FishingWorkSpot;
    if (person.activity) spot = SPOT_FOR_ACTIVITY[person.activity];
    else if (person.kind === "claude" && person.breakRoom !== null)
      spot = "rest";
    else spot = person.kind === "claude" ? "office" : "seats";
    return { kind: "spot", spot, slot: this.claim(spot, person.id) };
  }

  /** Hold a place at ``spot`` for ``id``: its own if it has one, else the first free. */
  private claim(spot: FishingWorkSpot, id: string): number {
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

  private targetOf(placed: Placed, goal: Goal): FishingSpot {
    if (goal.kind === "spot") return WORK_SPOTS[goal.spot][goal.slot];
    if (goal.kind === "exit") return OUTSIDE;
    const { walker } = placed;
    return { x: walker.x, z: walker.z, facing: walker.facing };
  }

  /** Lay out the walk to the goal from where the person is, by the entrance when outside. */
  private plan(placed: Placed): void {
    const { goal, walker } = placed;
    const here = { x: walker.x, z: walker.z };
    const lead = here.z > FISHING_DEPTH ? [ENTRANCE_INSIDE] : [];
    const from = lead[0] ?? here;
    walker.path =
      goal.kind === "exit"
        ? [...lead, ...routeTo(from, ENTRANCE_INSIDE), OUTSIDE]
        : [...lead, ...routeTo(from, this.targetOf(placed, goal))];
  }

  update(now: number, dt: number): void {
    if (this.shipPending) {
      this.shipPending = false;
      this.shippedAt = now;
    }
    this.land(now);
    const boss = [...this.placed.values()].find(
      (p) => p.person.kind === "claude",
    );
    const gone: string[] = [];
    for (const [id, placed] of this.placed) {
      if (placed.person.kind === "me") {
        this.tendGuest(placed, now, boss?.person ?? null);
        continue;
      }
      this.react(placed, now);
      if (this.move(placed, dt, now)) {
        gone.push(id);
        continue;
      }
      this.work(placed, now);
    }
    this.field.tank.update(now);
    this.stir(now);
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

  /**
   * Land the fish still to be caught, one at a time: someone standing at
   * work holds it up (an angler in a seat first, else anyone, else the
   * boss), and a moment later it is in the tank.
   */
  private land(now: number): void {
    while (this.intoTank.length > 0 && this.intoTank[0].at <= now) {
      const { count } = this.intoTank.shift()!;
      this.field.tank.setFish(tankFor(count));
      this.field.tank.splash(now);
      this.showCatch(count);
    }
    if (this.toCatch.length === 0 || now < this.nextCatchAt) return;
    const nth = this.toCatch.shift()!;
    this.nextCatchAt = now + CATCH_MS;
    this.intoTank.push({ at: now + INTO_TANK_MS, count: nth });
    const settled = [...this.placed.values()].filter(
      (p) =>
        p.person.kind !== "me" &&
        p.goal.kind === "spot" &&
        p.walker.path.length === 0,
    );
    const catcher =
      settled.find((p) => p.goal.kind === "spot" && p.goal.spot === "seats") ??
      settled.find((p) => p.person.kind !== "claude") ??
      settled[0];
    if (!catcher) return;
    catcher.catchUntil = now + CATCH_MS;
    holdFish(catcher.figure, speciesFor(nth));
  }

  /** React to a test run that just finished: cheer when it passed, despair when it failed. */
  private react(placed: Placed, now: number): void {
    const { person } = placed;
    if (person.passedTest !== placed.seenPass) {
      placed.seenPass = person.passedTest;
      if (person.passedTest !== null) placed.cheerUntil = now + CHEER_MS;
    }
    if (person.failedTest !== placed.seenFail) {
      placed.seenFail = person.failedTest;
      if (person.failedTest !== null) placed.dismayUntil = now + DISMAY_MS;
    }
  }

  /** Walk a person towards its goal; true when it has walked out of the entrance. */
  private move(placed: Placed, dt: number, now: number): boolean {
    // Cheering, despairing or holding up a catch, it finishes that first.
    const busy =
      placed.walker.path.length === 0 &&
      (now < placed.cheerUntil ||
        now < placed.dismayUntil ||
        now < placed.catchUntil);
    const goal = busy ? placed.goal : this.goalFor(placed);
    const changed =
      goal.kind !== placed.goal.kind ||
      (goal.kind === "spot" &&
        placed.goal.kind === "spot" &&
        (goal.spot !== placed.goal.spot || goal.slot !== placed.goal.slot));
    if (changed) {
      placed.goal = goal;
      this.plan(placed);
    }
    placed.walker = stepWalk(placed.walker, dt);
    const { walker, figure } = placed;
    figure.root.position.set(walker.x, 0, walker.z);
    if (walker.path.length === 0) {
      if (goal.kind === "exit") return true;
      walker.facing = this.targetOf(placed, goal).facing;
    }
    figure.root.rotation.y = walker.facing;
    return false;
  }

  /** Pose a person at work (or on the way) and write its tag. */
  private work(placed: Placed, now: number): void {
    const { person, walker, goal, figure } = placed;
    let pose: FishingPose = "walk";
    let line: TalkLine | null = this.talk(placed, now);
    if (now >= placed.catchUntil && figure.held) holdFish(figure, null);
    if (goal.kind === "exit") {
      const { bubble } = person;
      placed.report ??= bubble?.type === "speech" ? bubble.text : null;
      line = {
        icon: "🐟",
        text: placed.report ?? this.words.done,
        detail: null,
        tone: "say",
      };
      pose = walker.path.length > 0 ? "walk" : "wave";
    } else if (walker.path.length === 0 && goal.kind === "spot") {
      pose = this.poseAt(goal.spot);
      if (goal.spot === "rest" && person.kind === "claude") {
        const restedMs = Date.now() - (person.idleSince ?? Date.now());
        if (person.breakRoom === "cafe") {
          pose = "log";
          line = {
            icon: "📒",
            text: this.words.handover,
            detail: null,
            tone: "think",
          };
        } else if (restedMs >= DOZE_AFTER_MS) {
          pose = "doze";
          line = { icon: "💤", text: "", detail: null, tone: "think" };
        }
      }
      if (
        (this.shippedAt !== null && now - this.shippedAt < SHIP_MS) ||
        now < placed.cheerUntil
      )
        pose = "cheer";
      if (now < placed.catchUntil) pose = "catch";
      if (now < placed.dismayUntil) pose = "dismay";
    }
    if (pose === "catch") figure.root.rotation.y = TO_CAMERA;
    poseFishingFigure(figure, pose, now / 1000);
    drawFishingLine(placed.tag, line);
  }

  private poseAt(spot: FishingWorkSpot): FishingPose {
    switch (spot) {
      case "pontoon":
        return "peer";
      case "seats":
        return "fish";
      case "net":
        return "rope";
      case "shop":
        return "bait";
      case "board":
        return "point";
      case "guest":
        return "talk";
      case "rest":
        return "noodles";
      case "office":
        return "stand";
    }
  }

  /** Me, the guest, in my seat on my hut: the radio when the boss calls, passing on my question. */
  private tendGuest(placed: Placed, now: number, boss: IsoPerson | null): void {
    const { person, figure } = placed;
    figure.root.position.set(GUEST_SPOT.x, 0, GUEST_SPOT.z);
    figure.root.rotation.y = GUEST_SPOT.facing;
    let pose: FishingPose = "fish";
    let line: TalkLine | null = null;
    if (this.shippedAt !== null && now - this.shippedAt < SHIP_MS) {
      pose = "cheer";
    } else if (boss?.activity === "asking") {
      pose = "radio";
      line = {
        icon: "📻",
        text: this.words.called,
        detail: null,
        tone: "alert",
      };
    } else if (
      person.typedAt !== null &&
      Date.now() - person.typedAt < REQUEST_MS
    ) {
      pose = "talk";
      const question = boss ? myQuestion(boss.bubble) : null;
      line = {
        icon: "📢",
        text: question ?? this.words.request,
        detail: null,
        tone: "say",
      };
    }
    poseFishingFigure(figure, pose, now / 1000, true);
    drawFishingLine(placed.tag, line);
  }

  /** What a person's tag says from the session, the angler's way. */
  private talk(placed: Placed, now: number): TalkLine | null {
    const { person } = placed;
    if (person.thinking)
      placed.thinkingSince =
        person.since === null
          ? (placed.thinkingSince ?? now)
          : now - (Date.now() - person.since);
    else placed.thinkingSince = null;
    return fishingLine(
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

  /** The water's life: the floats bob, the ducks paddle round, the heron nods. */
  private stir(now: number): void {
    const seconds = now / 1000;
    this.field.floats.forEach((bob, i) => {
      bob.position.y = WATER_Y + 0.04 * Math.sin(seconds * 1.6 + i * 1.3);
    });
    for (const d of this.field.ducks) {
      const angle = d.phase + seconds * d.speed;
      d.model.position.set(
        d.x + Math.cos(angle) * d.rx,
        WATER_Y,
        d.z + Math.sin(angle) * d.rz,
      );
      // Beak along the way it paddles: the tangent of its loop.
      const dir = Math.sign(d.speed);
      d.model.rotation.y = Math.atan2(
        -Math.cos(angle) * d.rz * dir,
        -Math.sin(angle) * d.rx * dir,
      );
    }
    const peck = Math.max(0, Math.sin(seconds * 0.5)) ** 8;
    this.field.heronHead.rotation.z = -0.9 * peck;
    if (this.night) this.glimmer(seconds);
  }

  /**
   * The night's motion: the chemical lights pulse, the fire flickers, the
   * glade shimmers, the stars twinkle, the fireflies drift and blink, the
   * mist creeps.
   */
  private glimmer(seconds: number): void {
    const { night, floats } = this.field;
    floats.forEach((bob, i) => {
      const glow = bob.userData.glow as THREE.Sprite;
      glow.material.opacity = 0.65 + 0.3 * Math.sin(seconds * 2.2 + i * 0.9);
    });
    const flicker =
      0.5 * Math.sin(seconds * 13) + 0.3 * Math.sin(seconds * 7.3 + 1);
    night.flames.forEach((flame, i) => {
      flame.scale.set(1, 1 + 0.18 * Math.sin(seconds * (11 + i * 3) + i), 1);
    });
    night.fireGlow.material.opacity = 0.7 + 0.12 * flicker;
    (night.firePool.material as THREE.MeshBasicMaterial).opacity =
      0.28 + 0.05 * flicker;
    night.glade.forEach((streak, i) => {
      (streak.material as THREE.MeshBasicMaterial).opacity =
        0.3 + 0.35 * Math.max(0, Math.sin(seconds * 1.7 + i * 1.9));
    });
    night.stars.forEach((star, i) => {
      star.material.opacity = 0.45 + 0.35 * Math.sin(seconds * 0.9 + i * 2.3);
    });
    for (const fly of night.fireflies) {
      const t = seconds * 0.6 + fly.phase;
      fly.light.position.set(
        fly.x + 0.8 * Math.sin(t * 0.9),
        fly.y + 0.25 * Math.sin(t * 1.7),
        fly.z + 0.8 * Math.cos(t * 0.7),
      );
      fly.glow.material.opacity =
        0.15 + 0.85 * Math.max(0, Math.sin(seconds * 1.8 + fly.phase)) ** 2;
    }
    night.mist.forEach((sheet, i) => {
      sheet.position.x += Math.sin(seconds * 0.05 + i) * 0.004;
    });
  }

  /** The count over the tank and the catch board, for ``count`` fish. */
  private showCatch(count: number): void {
    this.landed = count;
    this.signText.textContent = String(count);
    const { canvas, texture } = this.field.catchBoard;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = FISH.signBlue;
    ctx.fillRect(0, 0, width, 52);
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 30px ${BOARD_FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText("오늘의 조황 · CATCH", 20, 27);
    ctx.fillStyle = "#1d2433";
    ctx.font = `900 64px ${BOARD_FONT}`;
    ctx.fillText(String(count), 24, 102);
    const countWidth = ctx.measureText(String(count)).width;
    ctx.font = `700 26px ${BOARD_FONT}`;
    ctx.fillText("마리", 32 + countWidth, 112);
    const counts = tally(count);
    SPECIES.forEach((species, i) => {
      const x = 250 + (i % 2) * 130;
      const y = 82 + Math.floor(i / 2) * 40;
      const { color, name } = SPECIES_BOARD[species];
      drawFishShape(ctx, x, y, 14, "#1d2433", color, 1);
      ctx.fillStyle = "#1d2433";
      ctx.font = `700 20px ${BOARD_FONT}`;
      ctx.fillText(`${name} ${counts[species]}`, x + 24, y + 1);
    });
    ctx.fillStyle = "#5b6779";
    ctx.font = `700 20px ${BOARD_FONT}`;
    ctx.fillText(count > 0 ? "최근 · LATEST" : "아직 없음 · NONE YET", 24, 170);
    if (count > 0 && this.lastTitle) {
      ctx.fillStyle = "#1d2433";
      ctx.font = `600 22px ${BOARD_FONT}`;
      let title = this.lastTitle;
      while (title.length > 1 && ctx.measureText(title).width > width - 48)
        title = title.slice(0, -1);
      if (title !== this.lastTitle) title = `${title.slice(0, -1)}…`;
      ctx.fillText(title, 24, 202);
    }
    texture.needsUpdate = true;
  }

  setCommits(commits: {
    count: number;
    last: { id: string; title: string; at: number } | null;
  }): void {
    const { count } = commits;
    const title = commits.last?.title ?? "";
    if (this.commitsFresh || count < this.landed) {
      // A snapshot (or another session): the tank just holds what it caught.
      this.commitsFresh = false;
      this.toCatch.length = 0;
      this.intoTank.length = 0;
      this.lastTitle = title;
      this.field.tank.setFish(tankFor(count));
      this.showCatch(count);
      return;
    }
    const queued =
      this.toCatch.at(-1) ?? this.intoTank.at(-1)?.count ?? this.landed;
    this.lastTitle = title;
    for (let nth = queued + 1; nth <= count; nth++) this.toCatch.push(nth);
    if (count === this.landed) this.showCatch(count);
  }

  /** The chalkboard: a fish to catch a to-do, filled in as it gets done. */
  setNotes(statuses: readonly NoteStatus[] | null): void {
    const { canvas, texture } = this.field.chalkboard;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.fillStyle = FISH.chalk;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#f3f0e6";
    ctx.font = `800 30px ${BOARD_FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText("오늘 잡을 고기 · TODAY", 22, 32);
    const rows = (statuses ?? ["completed", "in_progress", "pending"]).slice(
      0,
      8,
    );
    rows.forEach((status, i) => {
      const x = 90 + (i % 4) * 112;
      const y = 108 + Math.floor(i / 4) * 78;
      drawFishShape(ctx, x, y, 26, "#f3f0e6", "#f7d774", CHALK_FILL[status]);
    });
    texture.needsUpdate = true;
  }

  setTurn(): void {}

  hearts(): void {}

  /** Night falls with the dark theme: moonlight over the spot, its lights lit. */
  setNight(night: boolean): void {
    this.night = night;
    shadeForNight(this.field.root, night);
    lightForNight(this.field.root, night);
    for (const placed of this.placed.values()) {
      shadeForNight(placed.figure.root, night);
    }
  }

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
    this.field.tank.dispose();
    this.sign.removeFromParent();
  }

  private remove(id: string, placed: Placed): void {
    // Removing the label itself takes its element off the page.
    placed.label.removeFromParent();
    holdFish(placed.figure, null);
    this.scene.remove(placed.figure.root);
    placed.figure.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    for (const places of this.held.values()) places.delete(id);
    this.placed.delete(id);
  }
}

/** The fishing spot, built into ``scene``; ``onLeft`` hears of each subagent that walked out. */
export function createFishing(
  scene: THREE.Scene,
  onLeft: (id: string) => void,
): IsoWorld {
  return new Reservoir(scene, onLeft);
}
