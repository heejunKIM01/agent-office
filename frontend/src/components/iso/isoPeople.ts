/**
 * The people on the isometric floor: a figure and a name chip per person,
 * kept in step with the session by `sync` and moved every frame by the
 * errand rules in `update`. Claude sits at the front dev desk nearest my
 * desk, subagents take the next free dev chairs, and I sit behind the
 * reception desk.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  CLAUDE_SEAT,
  ERRAND_SPOTS,
  MY_SEAT,
  SUBAGENT_SEATS,
  type ErrandRoomId,
  type IsoSpot,
} from "@/constants/isoFloorPlan";
import {
  seatedWalker,
  stepIsoWalker,
  type IsoWalker,
} from "@/systems/isoErrands";
import { findFloorPath } from "@/systems/isoNavGrid";
import type { IsoPerson, PersonKind } from "@/systems/officePeople";
import {
  buildCharacter,
  poseCharacter,
  type CharacterRig,
} from "./isoCharacters";

/** Colour of the dot in front of each name, as in the video. */
const DOT_COLORS: Record<PersonKind, string> = {
  claude: "#e8735a",
  me: "#4f6fe8",
  subagent: "#3b82f6",
};

const ROOMS: ErrandRoomId[] = ["library", "server"];

interface Placed {
  person: IsoPerson;
  rig: CharacterRig;
  chip: CSS2DObject;
  chipText: HTMLSpanElement;
  walker: IsoWalker;
  seat: IsoSpot;
}

function nameChip(kind: PersonKind): {
  element: HTMLDivElement;
  text: HTMLSpanElement;
} {
  const element = document.createElement("div");
  element.className =
    "flex max-w-[150px] items-center gap-1 whitespace-nowrap rounded-full border border-slate-200/90 bg-white/95 px-2 py-0.5 text-[11px] font-semibold leading-4 text-slate-700 shadow-sm";
  const dot = document.createElement("span");
  dot.className = "h-1.5 w-1.5 shrink-0 rounded-full";
  dot.style.backgroundColor = DOT_COLORS[kind];
  const text = document.createElement("span");
  text.className = "truncate";
  element.append(dot, text);
  return { element, text };
}

export class IsoPeople {
  private readonly placed = new Map<string, Placed>();
  /** Which spot each walker holds in a room, by index into ERRAND_SPOTS. */
  private readonly held: Record<ErrandRoomId, Map<string, number>> = {
    library: new Map(),
    server: new Map(),
  };

  constructor(private readonly scene: THREE.Scene) {}

  /** Add, relabel and remove people to match the session. */
  sync(people: IsoPerson[]): void {
    const ids = new Set(people.map((person) => person.id));
    for (const [id, placed] of this.placed) {
      if (!ids.has(id)) this.remove(id, placed);
    }
    for (const person of people) {
      const placed = this.placed.get(person.id);
      if (placed) {
        placed.person = person;
        placed.chipText.textContent = person.label;
        continue;
      }
      const seat = this.freeSeat(person.kind);
      const rig = buildCharacter(person.kind);
      const chip = nameChip(person.kind);
      chip.text.textContent = person.label;
      const label = new CSS2DObject(chip.element);
      label.center.set(0.5, 1);
      rig.chipAnchor.add(label);
      this.scene.add(rig.root);
      this.placed.set(person.id, {
        person,
        rig,
        chip: label,
        chipText: chip.text,
        walker: seatedWalker(seat),
        seat,
      });
    }
  }

  /** Move and pose everyone for this frame; ``dt`` in seconds. */
  update(now: number, dt: number): void {
    for (const [id, placed] of this.placed) {
      const walker = stepIsoWalker(placed.walker, {
        activity: placed.person.activity,
        seat: placed.seat,
        spotIn: (room) => this.spotIn(id, room),
        findPath: findFloorPath,
        now,
        dt,
      });
      for (const room of ROOMS) {
        if (walker.goal !== room) this.held[room].delete(id);
      }
      placed.walker = walker;
      placed.rig.root.position.set(walker.x, 0, walker.z);
      placed.rig.root.rotation.y = walker.facing;
      poseCharacter(
        placed.rig,
        walker.pose,
        walker.goal === "seat" ? null : walker.goal,
        now / 1000,
      );
    }
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
    this.scene.remove(placed.rig.root);
    placed.rig.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    for (const room of ROOMS) this.held[room].delete(id);
    this.placed.delete(id);
  }
}
