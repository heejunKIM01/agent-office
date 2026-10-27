/**
 * A place the isometric view can show (설정 「장소」): the office, or the
 * airport. Each builds its own scene and moves its own people, and tells
 * the view how big it is so the camera frames it.
 */

import type * as THREE from "three";
import type { AirportWords } from "@/systems/airportTalk";
import type { IsoPerson } from "@/systems/officePeople";
import type { NoteStatus } from "@/systems/roomGimmicks";
import type { BubbleWords } from "./isoBubbles";

/** Who is in the session, as every place gets them. */
export type { IsoPerson };

/** Words each place needs, already translated; each takes its own. */
export interface PlaceWords {
  office: BubbleWords;
  airport: AirportWords;
}

export interface IsoWorld {
  /** Floor size along x and z, for the sun's shadows. */
  width: number;
  depth: number;
  /** Where the camera looks when the view is reset. */
  center: { x: number; z: number };
  /** Points that must stay in view at zoom 1. */
  outline(): THREE.Vector3[];
  sync(people: IsoPerson[]): void;
  setWords(words: PlaceWords): void;
  /** Take everyone off the floor, to place them afresh. */
  clear(): void;
  /** Move everyone and everything for this frame; ``now`` in ms, ``dt`` in s. */
  update(now: number, dt: number): void;
  /** I said thanks: hearts beside everyone's head. */
  hearts(): void;
  /** Work just shipped (a push or merge). */
  ship(): void;
  setNotes(statuses: readonly NoteStatus[] | null): void;
  setCommits(commits: {
    count: number;
    last: { id: string; title: string; at: number } | null;
  }): void;
  setTurn(turn: { start: number; end: number | null } | null): void;
  dispose(): void;
}
