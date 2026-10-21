/**
 * The people on the isometric floor: a figure and a name chip per person,
 * kept in step with the session by `sync` and moved every frame by the
 * errand rules in `update`. Claude sits at the front dev desk nearest my
 * desk, subagents take the next free dev chairs, and I sit behind the
 * reception desk. `update` also reports what the rooms should show: racks
 * busy while a command runs, code on the screens of people editing,
 * someone writing at the whiteboard, and the elevator doors open while
 * someone steps in or out.
 *
 * A subagent the backend has just made steps out of the elevator while
 * Claude holds the phone; one whose work is done reports beside Claude,
 * says 「👋 퇴근합니다!」 and rides the elevator away (작성자 댓글).
 */

import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  CLAUDE_SEAT,
  ELEVATOR_CAB,
  ELEVATOR_DOOR,
  ERRAND_SPOTS,
  MY_SEAT,
  REPORT_SPOTS,
  SUBAGENT_SEATS,
  type ErrandRoomId,
  type IsoSpot,
} from "@/constants/isoFloorPlan";
import {
  arrivingWalker,
  seatedWalker,
  stepIsoWalker,
  type IsoElevator,
  type IsoGoal,
  type IsoWalker,
} from "@/systems/isoErrands";
import { findFloorPath } from "@/systems/isoNavGrid";
import { pickBubble, type IsoBubble } from "@/systems/officeBubbles";
import type { IsoPerson, PersonKind } from "@/systems/officePeople";
import {
  bubbleHolder,
  bubbleKey,
  drawBubble,
  type BubbleWords,
} from "./isoBubbles";
import {
  buildCharacter,
  poseCharacter,
  type CharacterRig,
} from "./isoCharacters";
import { OUTFIT_COLORS } from "./isoPalette";

/** Colour of the dot in front of each name, as in the video. */
const DOT_COLORS: Record<Exclude<PersonKind, "subagent">, string> = {
  claude: "#e8735a",
  me: "#4f6fe8",
};
const dotColor = (person: IsoPerson): string =>
  person.kind === "subagent"
    ? OUTFIT_COLORS[person.outfit]
    : DOT_COLORS[person.kind];

const ROOMS = Object.keys(ERRAND_SPOTS) as ErrandRoomId[];
const isRoom = (goal: IsoGoal): goal is ErrandRoomId =>
  (ROOMS as string[]).includes(goal);

const ELEVATOR: IsoElevator = { door: ELEVATOR_DOOR, cab: ELEVATOR_CAB };
/** Someone this close to the door on the way out has the doors opened (m). */
const DOOR_OPEN_RANGE = 2.2;
/** Deeper in than this behind the door, a person is in the cab: chip and bubble hide (m). */
const IN_CAB_DEPTH = 0.45;
/** How long Claude holds the phone when it calls a subagent in (ms). */
const CALL_MS = 3000;

/** What the rooms should show this frame. */
export interface RoomsInUse {
  /** Someone is running a command. */
  serverBusy: boolean;
  /** Seats of people typing at their desks. */
  editingSeats: IsoSpot[];
  /** Someone is planning at the whiteboard. */
  planning: boolean;
  /** Someone is stepping into or out of the elevator. */
  elevatorOpen: boolean;
}

interface Placed {
  person: IsoPerson;
  rig: CharacterRig;
  chip: CSS2DObject;
  chipText: HTMLSpanElement;
  bubble: CSS2DObject;
  bubbleHolder: HTMLDivElement;
  /** What the bubble shows now, to redraw it only when that changes. */
  bubbleKey: string;
  /** When it started thinking (performance.now ms), while it thinks. */
  thinkingSince: number | null;
  walker: IsoWalker;
  seat: IsoSpot;
  /** What it tells Claude when its work is done, read when it gets there. */
  report: string | null;
}

function nameChip(color: string): {
  element: HTMLDivElement;
  text: HTMLSpanElement;
} {
  const element = document.createElement("div");
  element.className =
    "flex max-w-[150px] items-center gap-1 whitespace-nowrap rounded-full border border-slate-200/90 bg-white/95 px-2 py-0.5 text-[11px] font-semibold leading-4 text-slate-700 shadow-sm";
  const dot = document.createElement("span");
  dot.className = "h-1.5 w-1.5 shrink-0 rounded-full";
  dot.style.backgroundColor = color;
  const text = document.createElement("span");
  text.className = "truncate";
  element.append(dot, text);
  return { element, text };
}

export class IsoPeople {
  private readonly placed = new Map<string, Placed>();
  /** Which spot each walker holds in a room, by index into ERRAND_SPOTS. */
  private readonly held = Object.fromEntries(
    ROOMS.map((room) => [room, new Map<string, number>()]),
  ) as Record<ErrandRoomId, Map<string, number>>;
  /** Which spot beside Claude each reporting subagent holds. */
  private readonly reporting = new Map<string, number>();
  /** Subagents that rode away, kept out until the session lets them go. */
  private readonly departed = new Set<string>();
  /** A newcomer arrived: Claude picks up the phone on the next frame. */
  private callPending = false;
  private callUntil = 0;

  private words: BubbleWords = {
    thinking: "",
    thinkingFor: () => "",
    looking: "",
    bye: "",
  };

  /** ``onLeft`` hears of each subagent that rode the elevator away. */
  constructor(
    private readonly scene: THREE.Scene,
    private readonly onLeft: (id: string) => void = () => undefined,
  ) {}

  /** Use these words in bubbles from now on. */
  setWords(words: BubbleWords): void {
    this.words = words;
    for (const placed of this.placed.values()) placed.bubbleKey = "redraw";
  }

  /** Add, relabel and remove people to match the session. */
  sync(people: IsoPerson[]): void {
    const ids = new Set(people.map((person) => person.id));
    for (const [id, placed] of this.placed) {
      if (!ids.has(id)) this.remove(id, placed);
    }
    for (const id of this.departed) {
      if (!ids.has(id)) this.departed.delete(id);
    }
    for (const person of people) {
      const placed = this.placed.get(person.id);
      if (placed) {
        placed.person = person;
        placed.chipText.textContent = person.label;
        continue;
      }
      // Gone home already; it only comes back with new work.
      if (this.departed.has(person.id)) {
        if (person.leaving) continue;
        this.departed.delete(person.id);
      }
      const seat = this.freeSeat(person.kind);
      const arriving =
        person.kind === "subagent" && person.arriving && !person.leaving;
      if (arriving) this.callPending = true;
      const rig = buildCharacter(person.kind, person.outfit);
      const chip = nameChip(dotColor(person));
      chip.text.textContent = person.label;
      const label = new CSS2DObject(chip.element);
      label.center.set(0.5, 1);
      rig.chipAnchor.add(label);
      const holder = bubbleHolder();
      const bubble = new CSS2DObject(holder);
      bubble.center.set(0.5, 1);
      rig.chipAnchor.add(bubble);
      this.scene.add(rig.root);
      this.placed.set(person.id, {
        person,
        rig,
        chip: label,
        chipText: chip.text,
        bubble,
        bubbleHolder: holder,
        bubbleKey: "",
        thinkingSince: null,
        walker: arriving ? arrivingWalker(ELEVATOR) : seatedWalker(seat),
        seat,
        report: null,
      });
    }
  }

  /** Move and pose everyone for this frame; ``dt`` in seconds. */
  update(now: number, dt: number): RoomsInUse {
    const inUse: RoomsInUse = {
      serverBusy: false,
      editingSeats: [],
      planning: false,
      elevatorOpen: false,
    };
    if (this.callPending) {
      this.callPending = false;
      this.callUntil = now + CALL_MS;
    }
    const gone: string[] = [];
    // Claude keeps quiet while a subagent reports to it.
    const listening = [...this.placed.values()].some(({ walker }) =>
      isTelling(walker),
    );
    for (const [id, placed] of this.placed) {
      const { activity, stuck, leaving } = placed.person;
      const walker = stepIsoWalker(placed.walker, {
        activity,
        stuck,
        seat: placed.seat,
        spotIn: (room) => this.spotIn(id, room),
        findPath: findFloorPath,
        now,
        dt,
        leaving,
        reportSpot: () => this.reportSpot(id),
        elevator: ELEVATOR,
      });
      for (const room of ROOMS) {
        if (walker.goal !== room) this.held[room].delete(id);
      }
      if (walker.goal !== "report") this.reporting.delete(id);
      placed.walker = walker;
      if (walker.trip?.kind === "gone") {
        gone.push(id);
        continue;
      }
      placed.rig.root.position.set(walker.x, 0, walker.z);
      placed.rig.root.rotation.y = walker.facing;
      const calling =
        placed.person.kind === "claude" &&
        now < this.callUntil &&
        walker.pose === "sit";
      poseCharacter(
        placed.rig,
        calling ? "phone" : walker.pose,
        isRoom(walker.goal) ? walker.goal : null,
        now / 1000,
        stuck && !leaving,
      );
      // In the cab, behind its doors: no chip or bubble either.
      const inCab = walker.z < ELEVATOR_DOOR.z - IN_CAB_DEPTH;
      placed.chip.visible = !inCab;
      placed.bubble.visible = !inCab;
      this.showBubble(
        placed,
        activity,
        stuck,
        now,
        listening && placed.person.kind === "claude",
      );
      if (activity === "running") inUse.serverBusy = true;
      if (walker.pose === "type") inUse.editingSeats.push(placed.seat);
      if (walker.goal === "meeting" && walker.pose === "work") {
        inUse.planning = true;
      }
      if (usesElevator(walker)) inUse.elevatorOpen = true;
    }
    for (const id of gone) {
      const placed = this.placed.get(id);
      if (placed) this.remove(id, placed);
      this.departed.add(id);
      this.onLeft(id);
    }
    return inUse;
  }

  /**
   * What a subagent on its way home says: its result beside Claude (or
   * 「👋 퇴근합니다!」 when it has none), then 「👋 퇴근합니다!」 all the way to
   * the cab. Nothing on the way to Claude; undefined when it is not leaving.
   */
  private tripBubble(placed: Placed): IsoBubble | null | undefined {
    const trip = placed.walker.trip;
    if (!trip || trip.kind === "arrive" || trip.kind === "gone") {
      placed.report = null;
      return undefined;
    }
    if (trip.kind === "report") {
      if (trip.until === null) return null;
      const { bubble } = placed.person;
      placed.report ??= bubble?.type === "speech" ? bubble.text : null;
      return { kind: "speech", text: placed.report ?? this.words.bye };
    }
    return { kind: "speech", text: this.words.bye };
  }

  /** Redraw a person's bubble when what it should show has changed. */
  private showBubble(
    placed: Placed,
    activity: IsoPerson["activity"],
    stuck: boolean,
    now: number,
    quiet: boolean,
  ): void {
    const { person } = placed;
    if (person.thinking) placed.thinkingSince ??= now;
    else placed.thinkingSince = null;
    const onTrip = quiet ? null : this.tripBubble(placed);
    const bubble =
      onTrip !== undefined
        ? onTrip
        : pickBubble({
            bubble: person.bubble,
            bubbleAgeMs:
              person.bubbleAt === null ? null : Date.now() - person.bubbleAt,
            activity,
            stuck,
            thinkingSeconds:
              placed.thinkingSince === null
                ? null
                : Math.floor((now - placed.thinkingSince) / 1000),
          });
    const key = bubbleKey(bubble);
    if (key === placed.bubbleKey) return;
    placed.bubbleKey = key;
    drawBubble(placed.bubbleHolder, bubble, this.words);
  }

  dispose(): void {
    for (const [id, placed] of this.placed) this.remove(id, placed);
  }

  private freeSeat(kind: PersonKind): IsoSpot {
    if (kind === "me") return MY_SEAT;
    if (kind === "claude") return CLAUDE_SEAT;
    const taken = new Set([...this.placed.values()].map((p) => p.seat));
    return (
      SUBAGENT_SEATS.find((seat) => !taken.has(seat)) ??
      SUBAGENT_SEATS[SUBAGENT_SEATS.length - 1]
    );
  }

  /** The spot beside Claude a reporting subagent holds, taking the first free one. */
  private reportSpot(id: string): IsoSpot {
    let index = this.reporting.get(id);
    if (index === undefined) {
      const taken = new Set(this.reporting.values());
      const free = REPORT_SPOTS.findIndex((_, i) => !taken.has(i));
      index = free >= 0 ? free : this.reporting.size % REPORT_SPOTS.length;
      this.reporting.set(id, index);
    }
    return REPORT_SPOTS[index];
  }

  /** The spot a walker holds in a room, taking the first free one. */
  private spotIn(id: string, room: ErrandRoomId): IsoSpot {
    const spots = ERRAND_SPOTS[room];
    const held = this.held[room];
    let index = held.get(id);
    if (index === undefined) {
      const taken = new Set(held.values());
      const free = spots.findIndex((_, i) => !taken.has(i));
      index = free >= 0 ? free : held.size % spots.length;
      held.set(id, index);
    }
    return spots[index];
  }

  private remove(id: string, placed: Placed): void {
    // Removing the chip itself takes its element off the page; removing
    // only the figure would leave the chip behind.
    placed.chip.removeFromParent();
    placed.bubble.removeFromParent();
    this.scene.remove(placed.rig.root);
    placed.rig.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    for (const room of ROOMS) this.held[room].delete(id);
    this.reporting.delete(id);
    this.placed.delete(id);
  }
}

/** Beside Claude, telling it the result or saying goodbye. */
function isTelling(walker: IsoWalker): boolean {
  const trip = walker.trip;
  return (
    (trip?.kind === "report" && trip.until !== null) || trip?.kind === "bye"
  );
}

/** Stepping out of or into the cab, or at the door on the way to it. */
function usesElevator(walker: IsoWalker): boolean {
  const kind = walker.trip?.kind;
  if (kind === "arrive" || kind === "board") return true;
  if (kind !== "leave") return false;
  const toDoor = Math.hypot(
    walker.x - ELEVATOR_DOOR.x,
    walker.z - ELEVATOR_DOOR.z,
  );
  return toDoor < DOOR_OPEN_RANGE;
}
