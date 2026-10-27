/**
 * The isometric airport (설정 「장소」 · 공항): the field from buildAirport.ts
 * and everyone on it, apart from the office. Claude is the controller in
 * the tower, I am the gate agent at the podium, and every subagent, and
 * the lead agent of every other session at work, is a plane flown by
 * systems/airTraffic.ts. Each wears a radar-style data tag: its code and
 * name, and what it is doing put the airport's way (systems/airportTalk.ts).
 *
 * The controller works the console while a tool runs, raises the
 * binoculars while a plane takes off or lands, keys the radio to clear one
 * (the words show on the radio strip under the cab), leans back between
 * turns and nods off after a long rest. I type at the podium while the
 * tower works, announce my question over the PA, and pick up the desk
 * phone when the tower calls the gate. Planes blink their beacons while
 * the engines run, flash their strobes on the runway and in the air, and
 * light their landing lights to take off and land. The ground crew works
 * each gate (airportGround.ts); touchdowns, approach lights, the water
 * salute and the hearts are airportEffects.ts.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  AIRPORT_CENTER,
  AIRPORT_DEPTH,
  AIRPORT_WIDTH,
  CONTROLLER_SEAT,
  GATE_AGENT_SPOT,
  RUNWAYS,
  TERMINAL_HEIGHT,
  TOWER,
} from "@/constants/isoAirportPlan";
import { AirTraffic, type Clearance, type Flight } from "@/systems/airTraffic";
import {
  myQuestion,
  secondsBetween,
  talkLine,
  type AirportWords,
  type TalkLine,
} from "@/systems/airportTalk";
import type { IsoPerson, IsoWorld, PlaceWords } from "../isoWorld";
import { buildAirplane, type PlaneRig } from "./airplane";
import {
  buildCrew,
  poseCrew,
  type CrewPose,
  type CrewRig,
} from "./airportFigures";
import { AirportMoments } from "./airportEffects";
import { GateCrews } from "./airportGround";
import {
  dataTag,
  drawLine,
  nameTag,
  radioStrip,
  type DataTag,
} from "./airportLabels";
import { AIR } from "./airportPalette";
import {
  buildAirport,
  PLATE_THICKNESS,
  type AirportScene,
} from "./buildAirport";

/** How long the radio's words stay up, and the controller keys the radio (ms). */
const RADIO_MS = 4500;
const TALK_MS = 2500;
/** How long I announce my question at the podium after sending it (ms). */
const ANNOUNCE_MS = 4000;
/** Resting this long since the last event, the controller nods off (ms). */
const DOZE_AFTER_MS = 5 * 60_000;
/** How long everyone cheers, and planes roll, when work ships (ms). */
const SHIP_MS = 3000;
const ROLL_MS = 1600;
/** How long planes rock their wings when I say thanks (ms). */
const WAGGLE_MS = 2200;
/**
 * Planes that turn up this soon after a snapshot are part of it: other
 * sessions' lead agents come on a socket of their own, a moment later.
 */
const SNAPSHOT_MS = 3000;

const BOARD = {
  background: "#1d2433",
  header: "#f2c94c",
  text: "#e8edf5",
  dim: "#8e98a7",
  font: '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif',
} as const;

/** What the departures board says of a flight, and in which colour. */
function flightStatus(flight: Flight): { text: string; color: string } {
  const airborne = flight.y > 0.05;
  switch (flight.phase) {
    case "parked":
      return { text: "탑승 중 BOARDING", color: BOARD.text };
    case "taxiOut":
      return { text: "이동 TAXI", color: "#f2c94c" };
    case "holding":
      return { text: "대기 HOLDING", color: "#f2c94c" };
    case "takeoff":
      return airborne
        ? { text: "이륙 DEPARTED", color: "#f2c94c" }
        : { text: "이륙 중 ROLLING", color: "#f2c94c" };
    case "circling":
      return { text: "비행 중 IN FLIGHT", color: "#54d98c" };
    case "approach":
      return airborne
        ? { text: "착륙 중 LANDING", color: "#f2c94c" }
        : { text: "도착 LANDED", color: "#7cc4f2" };
    case "exited":
    case "taxiIn":
      return { text: "도착 LANDED", color: "#7cc4f2" };
    case "arrived":
      return { text: "도착 ARRIVED", color: "#7cc4f2" };
  }
}

/** Phases a plane on its way home is in, from the approach to its gate. */
const HOMEWARD: ReadonlySet<Flight["phase"]> = new Set([
  "approach",
  "exited",
  "taxiIn",
  "arrived",
]);

/** A flight number made from its id: EX 204 for an Explore, CO for a colleague. */
function flightCode(person: IsoPerson): string {
  let hash = 0;
  for (const ch of person.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const prefix =
    person.kind === "colleague"
      ? "CO"
      : person.outfit === "explore"
        ? "EX"
        : person.outfit === "plan"
          ? "PL"
          : "CL";
  return `${prefix} ${100 + (hash % 900)}`;
}

/** A plane's livery: a subagent's by its kind, another session's Claude coral. */
function livery(person: IsoPerson): string {
  if (person.kind === "colleague") return AIR.liveryColleague;
  if (person.outfit === "explore") return AIR.liveryExplore;
  if (person.outfit === "plan") return AIR.liveryPlan;
  return AIR.liveryGeneral;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

interface Placed {
  person: IsoPerson;
  crew: CrewRig | null;
  plane: PlaneRig | null;
  tag: DataTag;
  label: CSS2DObject;
  thinkingSince: number | null;
  /** Gone from the session's list while flying: it lands before it goes. */
  ghost: boolean;
  /** What it tells the tower when it lands, read on the way in. */
  report: string | null;
  /** Its height last frame, to see it touch down. */
  lastY: number;
  /** Where in a blink its lights start, so planes do not blink together. */
  blink: number;
}

const STUB_WORDS: AirportWords = {
  takeoff: "",
  landing: "",
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
  announce: "",
};

class Airport implements IsoWorld {
  readonly width = AIRPORT_WIDTH;
  readonly depth = AIRPORT_DEPTH;
  readonly center = AIRPORT_CENTER;
  private readonly field: AirportScene;
  private readonly traffic = new AirTraffic();
  private readonly ground: GateCrews;
  private readonly moments: AirportMoments;
  private readonly placed = new Map<string, Placed>();
  /** Subagents that landed and went, kept out until the session lets them go. */
  private readonly departed = new Set<string>();
  /** The next sync places a snapshot: planes at work start in the air. */
  private fresh = true;
  /** Until when (performance.now ms) newcomers still count as the snapshot. */
  private snapshotUntil = 0;
  private words: AirportWords = STUB_WORDS;
  private readonly radio: CSS2DObject;
  private readonly radioText: HTMLSpanElement;
  private radioUntil = 0;
  private talkUntil = 0;
  private thanksPending = false;
  private waggleFrom: number | null = null;
  private shipPending = false;
  private shippedAt: number | null = null;
  private boardKey: string | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly onLeft: (id: string) => void,
  ) {
    this.field = buildAirport();
    scene.add(this.field.root);
    this.ground = new GateCrews(scene);
    this.moments = new AirportMoments(scene);
    const strip = radioStrip();
    this.radioText = strip.text;
    this.radio = new CSS2DObject(strip.element);
    this.radio.center.set(0.5, 0);
    this.radio.position.set(TOWER.x + 2.4, TOWER.cabFloor - 1.6, TOWER.z + 2.4);
    this.radio.visible = false;
    scene.add(this.radio);
    this.drawBoard();
  }

  outline(): THREE.Vector3[] {
    const corners: [number, number][] = [
      [0, 0],
      [AIRPORT_WIDTH, 0],
      [0, AIRPORT_DEPTH],
      [AIRPORT_WIDTH, AIRPORT_DEPTH],
    ];
    return [
      ...corners.map(([x, z]) => new THREE.Vector3(x, -PLATE_THICKNESS, z)),
      ...corners
        .slice(0, 3)
        .map(([x, z]) => new THREE.Vector3(x, TERMINAL_HEIGHT, z)),
    ];
  }

  setWords(words: PlaceWords): void {
    this.words = words.airport;
    for (const placed of this.placed.values()) placed.tag.lineKey = "redraw";
  }

  sync(people: IsoPerson[]): void {
    const ids = new Set(people.map((person) => person.id));
    for (const [id, placed] of this.placed) {
      if (ids.has(id)) continue;
      // A plane gone from the list lands first; people leave at once.
      if (placed.plane) {
        placed.ghost = true;
        this.traffic.setLeaving(id, true);
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
        if (placed.plane) this.traffic.setLeaving(person.id, person.leaving);
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
    const flies = person.kind === "subagent" || person.kind === "colleague";
    const tag = dataTag(
      flies ? livery(person) : person.kind === "claude" ? AIR.tower : AIR.gate,
    );
    const label = new CSS2DObject(tag.element);
    label.center.set(0.5, 1);
    let crew: CrewRig | null = null;
    let plane: PlaneRig | null = null;
    if (flies) {
      plane = buildAirplane(livery(person));
      plane.tagAnchor.add(label);
      this.scene.add(plane.root);
      const inSnapshot = this.fresh || performance.now() < this.snapshotUntil;
      this.traffic.add(person.id, inSnapshot ? "air" : "gate");
      this.traffic.setLeaving(person.id, person.leaving);
    } else {
      const inTower = person.kind === "claude";
      crew = buildCrew(inTower ? "controller" : "agent");
      const spot = inTower ? CONTROLLER_SEAT : GATE_AGENT_SPOT;
      crew.root.position.set(spot.x, inTower ? TOWER.cabFloor : 0, spot.z);
      crew.root.rotation.y = spot.facing;
      crew.tagAnchor.add(label);
      this.scene.add(crew.root);
    }
    const placed: Placed = {
      person,
      crew,
      plane,
      tag,
      label,
      thinkingSince: null,
      ghost: false,
      report: null,
      lastY: 0,
      blink: Math.random(),
    };
    this.name(placed);
    this.placed.set(person.id, placed);
  }

  /** The code and title on a tag: a flight number, TWR or GATE. */
  private name(placed: Placed): void {
    const { person } = placed;
    if (placed.plane) {
      nameTag(
        placed.tag,
        flightCode(person),
        clip(person.title || person.label, 22),
      );
    } else {
      nameTag(
        placed.tag,
        person.kind === "claude" ? "TWR" : "GATE",
        person.label,
      );
    }
  }

  update(now: number, dt: number): void {
    if (this.shipPending) {
      this.shipPending = false;
      this.shippedAt = now;
      this.moments.salute(now);
    }
    if (this.thanksPending) {
      this.thanksPending = false;
      this.waggleFrom = now;
      this.moments.thank(
        [...this.placed.values()]
          .filter((p) => p.crew)
          .map((p) => (p.crew as CrewRig).tagAnchor),
        now,
      );
    }
    const { cleared, gone } = this.traffic.step(dt, now);
    for (const clearance of cleared) this.say(clearance, now);
    for (const id of gone) {
      const placed = this.placed.get(id);
      if (!placed) continue;
      this.remove(id, placed);
      if (placed.person.kind === "subagent" && !placed.ghost) {
        this.departed.add(id);
        this.onLeft(id);
      }
    }
    const flights = [...this.traffic.flights.values()];
    this.ground.update(flights, now, dt);
    const holders = this.traffic.runwayHolders;
    this.moments.update(
      now,
      RUNWAYS.map((_, k) =>
        flights.some(
          (f) =>
            f.runway === k &&
            (f.phase === "approach" ||
              (f.phase === "circling" && holders[k] === f.id)),
        ),
      ),
    );
    // A plane taking off or landing has the controller's eye.
    const watching = flights.some(
      (f) =>
        (f.phase === "takeoff" && f.y < 3) ||
        (f.phase === "approach" && f.y < 4),
    );
    const tower = [...this.placed.values()].find(
      (p) => p.person.kind === "claude",
    );
    for (const placed of this.placed.values()) {
      if (placed.plane) {
        const flight = this.traffic.flights.get(placed.person.id);
        if (flight) this.fly(placed, placed.plane, flight, now);
      } else if (placed.crew) {
        if (placed.person.kind === "claude") {
          this.control(placed, placed.crew, now, watching);
        } else {
          this.tendGate(placed, placed.crew, now, tower?.person ?? null);
        }
      }
    }
    this.radio.visible = now < this.radioUntil;
    this.animateField(now / 1000, dt);
    this.drawBoard();
  }

  /** Put a plane where its flight is, with its lights and its tag. */
  private fly(
    placed: Placed,
    plane: PlaneRig,
    flight: Flight,
    now: number,
  ): void {
    const seconds = now / 1000;
    plane.root.position.set(flight.x, flight.y, flight.z);
    let roll = flight.roll;
    if (this.shippedAt !== null && flight.y > 3) {
      const t = (now - this.shippedAt) / ROLL_MS;
      if (t < 1) roll += Math.PI * 2 * (t * t * (3 - 2 * t));
    }
    if (this.waggleFrom !== null && flight.y > 3) {
      const t = (now - this.waggleFrom) / WAGGLE_MS;
      if (t < 1) roll += 0.4 * Math.sin(t * Math.PI * 6) * (1 - t);
    }
    plane.root.rotation.set(-flight.pitch, flight.yaw, roll);
    plane.gear.visible = flight.y < 1.5;
    // Lights: beacons and navigation lights while the engines run, strobes
    // on the runway and in the air, landing lights to take off and land.
    const engines = flight.phase !== "parked" && flight.phase !== "arrived";
    const flying =
      flight.phase === "takeoff" ||
      flight.phase === "circling" ||
      flight.phase === "approach";
    const beat = (seconds + placed.blink) % 1.2;
    const flash = (seconds * 1.3 + placed.blink) % 1;
    for (const beacon of plane.lights.beacons)
      beacon.visible = engines && beat < 0.18;
    for (const nav of plane.lights.navs) nav.visible = engines;
    for (const strobe of plane.lights.strobes) {
      strobe.visible =
        flying && (flash < 0.05 || (flash > 0.12 && flash < 0.17));
    }
    const landingLights =
      flight.phase === "takeoff" || flight.phase === "approach";
    for (const light of plane.lights.landing) light.visible = landingLights;
    if (
      flight.phase === "approach" &&
      placed.lastY > 0.05 &&
      flight.y <= 0.05
    ) {
      this.moments.touchdown(flight.x, flight.z, flight.yaw, now);
    }
    placed.lastY = flight.y;
    const homeward =
      (placed.person.leaving || placed.ghost) && HOMEWARD.has(flight.phase);
    if (homeward) {
      const { bubble } = placed.person;
      placed.report ??= bubble?.type === "speech" ? bubble.text : null;
      drawLine(placed.tag, {
        icon: "🛬",
        text: placed.report ?? this.words.done,
        detail: null,
        tone: "say",
      });
    } else if (placed.ghost) {
      drawLine(placed.tag, null);
    } else {
      placed.report = null;
      drawLine(placed.tag, this.talk(placed, now));
    }
  }

  /** The controller: radio, binoculars, console, a rest or a doze. */
  private control(
    placed: Placed,
    crew: CrewRig,
    now: number,
    watching: boolean,
  ): void {
    const { person } = placed;
    let pose: CrewPose = "console";
    let line: TalkLine | null = this.talk(placed, now);
    const resting = person.breakRoom === "lounge";
    const restedMs = Date.now() - (person.idleSince ?? Date.now());
    if (this.shippedAt !== null && now - this.shippedAt < SHIP_MS) {
      pose = "cheer";
    } else if (now < this.talkUntil) {
      pose = "radio";
      line = {
        icon: "📻",
        text: this.radioText.textContent ?? "",
        detail: null,
        tone: "say",
      };
    } else if (watching) {
      pose = "binoculars";
    } else if (person.breakRoom === "cafe") {
      line = {
        icon: "📝",
        text: this.words.handover,
        detail: null,
        tone: "think",
      };
    } else if (resting) {
      pose = restedMs >= DOZE_AFTER_MS ? "doze" : "relax";
      if (pose === "doze")
        line = { icon: "💤", text: "", detail: null, tone: "think" };
    }
    poseCrew(crew, pose, now / 1000);
    drawLine(placed.tag, line);
  }

  /** Me at the gate: the phone when the tower calls, the PA, the keyboard. */
  private tendGate(
    placed: Placed,
    crew: CrewRig,
    now: number,
    tower: IsoPerson | null,
  ): void {
    const { person } = placed;
    let pose: CrewPose = "stand";
    let line: TalkLine | null = null;
    const working =
      tower !== null && (tower.activity !== null || tower.thinking);
    if (this.shippedAt !== null && now - this.shippedAt < SHIP_MS) {
      pose = "cheer";
    } else if (tower?.activity === "asking") {
      pose = "phone";
      line = {
        icon: "☎️",
        text: this.words.called,
        detail: null,
        tone: "alert",
      };
    } else if (
      person.typedAt !== null &&
      Date.now() - person.typedAt < ANNOUNCE_MS
    ) {
      pose = "announce";
      const question = tower ? myQuestion(tower.bubble) : null;
      line = {
        icon: "📢",
        text: question ?? this.words.announce,
        detail: null,
        tone: "say",
      };
    } else if (working) {
      pose = "podium";
    }
    poseCrew(crew, pose, now / 1000);
    drawLine(placed.tag, line);
  }

  /** What a person or plane's tag says from the session, the airport's way. */
  private talk(placed: Placed, now: number): TalkLine | null {
    const { person } = placed;
    if (person.thinking)
      placed.thinkingSince =
        person.since === null
          ? (placed.thinkingSince ?? now)
          : now - (Date.now() - person.since);
    else placed.thinkingSince = null;
    return talkLine(
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

  /** The tower clears a plane: its words on the radio, the radio keyed. */
  private say(clearance: Clearance, now: number): void {
    const placed = this.placed.get(clearance.id);
    if (!placed) return;
    const word =
      clearance.kind === "takeoff" ? this.words.takeoff : this.words.landing;
    this.radioText.textContent = `${flightCode(placed.person)} · ${clearance.runway} ${word}`;
    this.radioUntil = now + RADIO_MS;
    this.talkUntil = now + TALK_MS;
  }

  private animateField(seconds: number, dt: number): void {
    const { radar, scope, beacon, windsock, runwayLights } = this.field;
    radar.rotation.y += dt * 1.4;
    scope.rotation.y -= dt * 2.6;
    beacon.emissiveIntensity = Math.sin(seconds * 3.2) > 0.55 ? 1 : 0.08;
    windsock.rotation.y =
      0.25 * Math.sin(seconds * 0.7) + 0.08 * Math.sin(seconds * 2.3);
    windsock.rotation.z = 0.05 * Math.sin(seconds * 5.1);
    const busy = this.traffic.runwayHolders;
    runwayLights.forEach((lights, k) => {
      lights.emissiveIntensity =
        busy[k] === null ? 0.45 : 0.8 + 0.5 * Math.abs(Math.sin(seconds * 4));
    });
  }

  /** Redraw the departures board when its flights change. */
  private drawBoard(): void {
    const rows = [...this.placed.values()]
      .filter((placed) => placed.plane)
      .map((placed) => {
        const flight = this.traffic.flights.get(placed.person.id);
        return flight ? { person: placed.person, flight } : null;
      })
      .filter((row) => row !== null)
      .slice(0, 5)
      .map(({ person, flight }) => {
        const status = flightStatus(flight);
        const onStand =
          flight.phase === "parked" ||
          flight.phase === "taxiIn" ||
          flight.phase === "arrived";
        const runway =
          flight.runway === null ? null : RUNWAYS[flight.runway].names[0];
        return {
          code: flightCode(person),
          name: clip(person.title || person.label, 16),
          gate: onStand ? `G${flight.gate + 1}` : (runway ?? "—"),
          status,
        };
      });
    const key = JSON.stringify(rows);
    if (key === this.boardKey) return;
    this.boardKey = key;
    const { canvas, texture } = this.field.board;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width } = canvas;
    ctx.fillStyle = BOARD.background;
    ctx.fillRect(0, 0, width, canvas.height);
    ctx.textBaseline = "middle";
    ctx.fillStyle = BOARD.header;
    ctx.font = `800 34px ${BOARD.font}`;
    ctx.fillText("✈ 출발 · 도착  DEPARTURES · ARRIVALS", 24, 30);
    ctx.fillStyle = BOARD.dim;
    ctx.font = `600 20px ${BOARD.font}`;
    const columns = [24, 170, 560, 660];
    ["FLIGHT", "작업 TASK", "GATE · RWY", "STATUS"].forEach((text, i) =>
      ctx.fillText(text, columns[i], 68),
    );
    ctx.fillStyle = "#2b3447";
    ctx.fillRect(20, 84, width - 40, 2);
    if (rows.length === 0) {
      ctx.fillStyle = BOARD.dim;
      ctx.font = `600 26px ${BOARD.font}`;
      ctx.fillText("운항 없음 · NO FLIGHTS", 24, 120);
    }
    rows.forEach((row, i) => {
      const y = 112 + i * 36;
      ctx.font = `700 26px ${BOARD.font}`;
      ctx.fillStyle = BOARD.header;
      ctx.fillText(row.code, columns[0], y);
      ctx.fillStyle = BOARD.text;
      ctx.fillText(row.name, columns[1], y);
      ctx.fillText(row.gate, columns[2], y);
      ctx.fillStyle = row.status.color;
      ctx.fillText(row.status.text, columns[3], y);
    });
    texture.needsUpdate = true;
  }

  hearts(): void {
    this.thanksPending = true;
  }

  ship(): void {
    this.shipPending = true;
  }

  setNotes(): void {}

  setCommits(): void {}

  setTurn(): void {}

  setNight(): void {}

  clear(): void {
    for (const [id, placed] of this.placed) this.remove(id, placed);
    this.traffic.clear();
    this.departed.clear();
    this.fresh = true;
    this.radioUntil = 0;
    this.talkUntil = 0;
  }

  dispose(): void {
    this.clear();
    this.radio.removeFromParent();
    this.ground.dispose();
    this.moments.dispose();
  }

  private remove(id: string, placed: Placed): void {
    // Removing the label itself takes its element off the page; removing
    // only the figure would leave the label behind.
    placed.label.removeFromParent();
    const root = placed.plane?.root ?? placed.crew?.root;
    if (root) {
      this.scene.remove(root);
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
    }
    this.traffic.remove(id);
    this.placed.delete(id);
  }
}

/** The airport, built into ``scene``; ``onLeft`` hears of each subagent that landed and went. */
export function createAirport(
  scene: THREE.Scene,
  onLeft: (id: string) => void,
): IsoWorld {
  return new Airport(scene, onLeft);
}
