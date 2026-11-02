/**
 * The warning light on the back wall (systems/officeAlarm.ts): a red dome on
 * top of the dev room's window wall. When Claude runs a risky command it
 * lights up, two beams sweep round it and the room flushes red for a few
 * seconds; everyone turns to look (isoPeople.ts).
 */

import * as THREE from "three";
import { WALL_HEIGHT } from "@/constants/isoFloorPlan";
import { ALARM_MS } from "@/systems/officeAlarm";
import { cylinder, material } from "./isoFurniture";
import { ISO_COLORS as C } from "./isoPalette";

/** Where it stands: on top of the back wall, over the middle of the dev room. */
export const ALARM_SPOT = { x: 19.2, z: 0.25 };
/** How fast the beams go round (turns a second). */
const TURNS = 1.6;
/** How bright the red flush on the room is at its brightest. */
const FLUSH = 16;
/** How far each beam reaches (m). */
const BEAM_LENGTH = 3;

/** A beam: a long open cone of red light lying on its side, pointing out. */
function beam(): THREE.Mesh {
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, BEAM_LENGTH, 20, 1, true),
    // Plain (not additive) blending: over the white walls an added red
    // washes out to white.
    new THREE.MeshBasicMaterial({
      color: C.alarmBeam,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  cone.rotation.z = Math.PI / 2;
  cone.position.x = BEAM_LENGTH / 2;
  return cone;
}

export class IsoAlarm {
  private readonly root = new THREE.Group();
  private readonly dome: THREE.Mesh;
  private readonly domeOff: THREE.Material;
  private readonly domeOn = new THREE.MeshBasicMaterial({
    color: C.alarmDomeOn,
  });
  private readonly rotor = new THREE.Group();
  private readonly flush = new THREE.PointLight(C.alarmDomeOn, 0, 26, 1.2);
  private pending = false;
  private from: number | null = null;

  constructor(office: THREE.Object3D) {
    this.root.position.set(ALARM_SPOT.x, WALL_HEIGHT, ALARM_SPOT.z);
    this.root.add(cylinder(0.26, 0.3, 0.14, C.alarmBase, 0, 0, 0, 20));
    this.domeOff = material(C.alarmDomeOff);
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      this.domeOff,
    );
    this.dome.position.y = 0.14;
    this.dome.scale.y = 1.3;
    this.root.add(this.dome);
    this.rotor.position.y = 0.26;
    const back = beam();
    back.position.x = -BEAM_LENGTH / 2;
    back.rotation.z = -Math.PI / 2;
    this.rotor.add(beam(), back);
    this.rotor.visible = false;
    this.root.add(this.rotor);
    this.flush.position.set(0, -0.6, 2.5);
    this.root.add(this.flush);
    office.add(this.root);
  }

  /** Claude just started a risky command: light up on the next frame. */
  ring(): void {
    this.pending = true;
  }

  /** Spin and flush while ringing; ``now`` is the frame clock (ms). */
  update(now: number): void {
    if (this.pending) {
      this.pending = false;
      this.from = now;
    }
    const on = this.from !== null && now - this.from < ALARM_MS;
    if (!on) this.from = null;
    this.dome.material = on ? this.domeOn : this.domeOff;
    this.rotor.visible = on;
    if (!on) {
      this.flush.intensity = 0;
      return;
    }
    const turn = ((now - (this.from ?? now)) / 1000) * TURNS * Math.PI * 2;
    this.rotor.rotation.y = turn;
    // The room flushes each time a beam sweeps towards it.
    this.flush.intensity = FLUSH * Math.abs(Math.cos(turn));
  }

  dispose(): void {
    this.domeOn.dispose();
  }
}
