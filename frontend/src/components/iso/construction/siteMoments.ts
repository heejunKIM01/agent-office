/**
 * The construction site's moments, drawn from systems/siteMoments.ts: a
 * warning beacon on the site office that flashes when tests fail, with a
 * warning sign by whoever's tests they were; an inspection stamp on the
 * building when tests pass; when work ships, a topping-out flag (상량)
 * in the five colours on the roof and a ribbon across the gate that is cut;
 * and at night, work-light towers with pools of light, glowing windows and
 * the crane's red aviation light.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  BUILDING,
  CRANE,
  GATE,
  SITE_CENTER,
  SITE_DEPTH,
  SITE_OFFICE,
} from "@/constants/sitePlan";
import {
  beaconOn,
  flagRaised,
  SIGN_MS,
  stampLook,
  tapeDropped,
} from "@/systems/siteMoments";
import { SITE } from "./sitePalette";
import { box, cylinder, lamp, material, sphere } from "./siteSolids";

/** The top of the two stacked site office containers. */
const OFFICE_ROOF = 5;
/** The work-light towers, in corners clear of the paths. */
const LIGHT_TOWERS = [
  { x: 2.5, z: 46 },
  { x: 61.5, z: 27 },
  { x: 21, z: 3.5 },
];
const FLAG_COLORS = [
  SITE.flagBlue,
  SITE.flagRed,
  SITE.flagYellow,
  SITE.flagWhite,
  SITE.flagBlack,
];
const TAPE_HALF = 3.3;

let signTexture: THREE.CanvasTexture | null = null;

/** A yellow warning triangle with an exclamation mark, drawn once. */
function warningTexture(): THREE.CanvasTexture {
  if (signTexture) return signTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.beginPath();
    ctx.moveTo(64, 8);
    ctx.lineTo(122, 116);
    ctx.lineTo(6, 116);
    ctx.closePath();
    ctx.fillStyle = SITE.warning;
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#1d2433";
    ctx.stroke();
    ctx.fillStyle = "#1d2433";
    ctx.font = "900 64px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", 64, 80);
  }
  signTexture = new THREE.CanvasTexture(canvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  return signTexture;
}

/** An A-frame warning sign, facing the camera. */
function warningSign(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.06, 1.0, 0.06, SITE.steel, -0.3, 0, 0.12));
  g.add(box(0.06, 1.0, 0.06, SITE.steel, 0.3, 0, 0.12));
  g.add(box(0.06, 1.0, 0.06, SITE.steel, 0, 0, -0.25));
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    new THREE.MeshBasicMaterial({ map: warningTexture(), transparent: true }),
  );
  face.material.userData.glow = true;
  face.position.set(0, 1.05, 0.16);
  face.rotation.x = -0.12;
  g.add(face);
  g.rotation.y = Math.PI / 4;
  return g;
}

interface Tower {
  lamps: THREE.MeshLambertMaterial;
  pool: THREE.Mesh;
}

function lightTower(x: number, z: number): { group: THREE.Group } & Tower {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(box(1.3, 0.3, 1.3, SITE.dark, 0, 0, 0));
  g.add(box(0.9, 0.6, 0.6, SITE.yellow, 0, 0.3, 0.2));
  g.add(box(0.18, 7, 0.18, SITE.steel, 0, 0.3, -0.3));
  const head = new THREE.Group();
  head.position.set(0, 7.3, -0.3);
  head.rotation.y = Math.atan2(SITE_CENTER.x - x, SITE_CENTER.z - z);
  head.add(box(1.8, 0.12, 0.12, SITE.steel, 0, 0, 0));
  const lamps = lamp(SITE.workLightOff);
  lamps.emissive.set("#000000");
  for (const dx of [-0.65, -0.22, 0.22, 0.65]) {
    const head1 = box(0.36, 0.3, 0.16, lamps, dx, 0.1, 0.12, { shadow: false });
    head1.rotation.x = -0.5;
    head.add(head1);
  }
  g.add(head);
  // A pool of light on the ground, towards the middle of the site.
  const toward = Math.hypot(SITE_CENTER.x - x, SITE_CENTER.z - z);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(7.5, 36),
    new THREE.MeshBasicMaterial({
      color: SITE.workLight,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  pool.material.userData.glow = true;
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(
    ((SITE_CENTER.x - x) / toward) * 6.5,
    0.04,
    ((SITE_CENTER.z - z) / toward) * 6.5,
  );
  pool.visible = false;
  g.add(pool);
  return { group: g, lamps, pool };
}

export class SiteMoments {
  readonly root = new THREE.Group();
  private readonly beaconLamp: THREE.MeshLambertMaterial;
  private readonly beam = new THREE.Group();
  private alarmAt: number | null = null;
  private readonly signs = new Map<
    string,
    { group: THREE.Group; at: number }
  >();
  private readonly stampLabel: CSS2DObject;
  private readonly stampInner: HTMLDivElement;
  private stampAt: number | null = null;
  private readonly flag = new THREE.Group();
  private readonly streamers: THREE.Mesh[] = [];
  private readonly tape = new THREE.Group();
  private readonly tapeHalves: THREE.Group[] = [];
  private shipAt: number | null = null;
  private readonly towers: Tower[] = [];
  private readonly aviation: THREE.MeshLambertMaterial;
  private night = false;

  constructor() {
    // The beacon on the site office's roof, with a turning beam.
    const beacon = new THREE.Group();
    beacon.position.set(SITE_OFFICE.x + 1.4, OFFICE_ROOF, SITE_OFFICE.z + 1.5);
    beacon.add(cylinder(0.32, 0.36, 0.22, SITE.dark, 0, 0, 0, 16));
    this.beaconLamp = lamp(SITE.beaconOff);
    this.beaconLamp.emissive.set("#000000");
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      this.beaconLamp,
    );
    dome.position.y = 0.22;
    beacon.add(dome);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: SITE.beacon,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    beamMaterial.userData.glow = true;
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.5),
      beamMaterial,
    );
    beam.position.set(1.7, 0, 0);
    this.beam.add(beam);
    this.beam.position.y = 0.36;
    this.beam.visible = false;
    beacon.add(this.beam);
    this.root.add(beacon);

    // The inspection stamp, laid over the building's front.
    const wrap = document.createElement("div");
    wrap.className = "pointer-events-none";
    const stamp = document.createElement("div");
    stamp.className =
      "flex flex-col items-center rounded-full border-[5px] border-red-600 bg-white/85 px-4 py-2 font-black leading-none text-red-600 shadow-lg";
    const big = document.createElement("span");
    big.className = "text-[22px] tracking-tight";
    big.textContent = "검측 통과";
    const small = document.createElement("span");
    small.className = "mt-1 font-mono text-[11px] tracking-[0.3em]";
    small.textContent = "PASSED";
    stamp.append(big, small);
    stamp.style.opacity = "0";
    wrap.append(stamp);
    this.stampInner = stamp;
    this.stampLabel = new CSS2DObject(wrap);
    this.stampLabel.visible = false;
    this.root.add(this.stampLabel);

    // The topping-out flag: a pole on the roof with five-colour streamers.
    this.flag.add(cylinder(0.09, 0.09, 5.2, SITE.flagWhite, 0, 0, 0, 10));
    this.flag.add(sphere(0.18, SITE.flagYellow, 0, 5.3, 0, [10, 8]));
    FLAG_COLORS.forEach((color, i) => {
      const hang = new THREE.Group();
      hang.position.set(0, 5.05, 0);
      const streamer = box(0.3, 3, 0.04, color, 0.2 + i * 0.32, -3, 0, {
        shadow: false,
      });
      hang.add(streamer);
      this.flag.add(hang);
      this.streamers.push(streamer);
    });
    this.flag.visible = false;
    this.root.add(this.flag);

    // The ribbon across the gate, on two stands.
    for (const side of [-1, 1] as const) {
      const x = GATE.x + side * TAPE_HALF;
      this.tape.add(box(0.5, 0.08, 0.5, SITE.dark, x, 0, 0));
      this.tape.add(box(0.08, 1.05, 0.08, SITE.steel, x, 0, 0));
      const half = new THREE.Group();
      half.position.set(x, 1.0, 0);
      half.add(
        box(
          TAPE_HALF,
          0.12,
          0.03,
          SITE.ribbon,
          (-side * TAPE_HALF) / 2,
          -0.06,
          0,
          {
            shadow: false,
          },
        ),
      );
      this.tapeHalves.push(half);
      this.tape.add(half);
    }
    this.tape.position.z = SITE_DEPTH - 1.2;
    this.tape.visible = false;
    this.root.add(this.tape);

    for (const { x, z } of LIGHT_TOWERS) {
      const tower = lightTower(x, z);
      this.towers.push(tower);
      this.root.add(tower.group);
    }
    // The crane's red light on its top, blinking at night.
    this.aviation = lamp(SITE.aviation);
    this.aviation.emissive.set("#000000");
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 8),
      this.aviation,
    );
    light.position.set(CRANE.x, CRANE.mast + 4, CRANE.z);
    this.root.add(light);
  }

  /** Tests failed: flash the beacon. */
  alarm(now: number): void {
    this.alarmAt = now;
  }

  /** Stand a warning sign by ``id`` at ``x``, ``z`` for a while. */
  warn(id: string, x: number, z: number, now: number): void {
    let sign = this.signs.get(id);
    if (!sign) {
      sign = { group: warningSign(), at: now };
      this.signs.set(id, sign);
      this.root.add(sign.group);
    }
    sign.at = now;
    sign.group.position.set(x + 0.9, 0, z + 0.9);
  }

  /** Tests passed: stamp the building. */
  stamp(now: number): void {
    this.stampAt = now;
  }

  /** Work shipped: raise the flag and cut the ribbon. */
  ship(now: number): void {
    this.shipAt = now;
  }

  /** Light the site for the night, or put the lights out for the day. */
  setNight(night: boolean): void {
    this.night = night;
    for (const { lamps, pool } of this.towers) {
      lamps.color.set(night ? SITE.workLight : SITE.workLightOff);
      lamps.emissive.set(night ? SITE.workLight : "#000000");
      pool.visible = night;
    }
    // The building's finished windows glow from inside.
    const windows = material(SITE.window, { opacity: 0.8 });
    windows.userData.glow = true;
    windows.emissive.set(night ? SITE.windowGlow : "#000000");
    windows.emissiveIntensity = night ? 0.6 : 1;
  }

  update(now: number, roofY: number): void {
    const on = this.alarmAt === null ? null : beaconOn(now - this.alarmAt);
    if (on === null) this.alarmAt = null;
    this.beaconLamp.color.set(on ? SITE.beacon : SITE.beaconOff);
    this.beaconLamp.emissive.set(on ? SITE.beacon : "#000000");
    this.beam.visible = on !== null;
    this.beam.rotation.y = now / 120;
    for (const [id, sign] of this.signs) {
      if (now - sign.at < SIGN_MS) continue;
      sign.group.removeFromParent();
      this.signs.delete(id);
    }
    const look = this.stampAt === null ? null : stampLook(now - this.stampAt);
    if (look === null) this.stampAt = null;
    this.stampLabel.visible = look !== null;
    this.stampInner.style.opacity = String(look?.opacity ?? 0);
    this.stampInner.style.transform = `rotate(-12deg) scale(${look?.scale ?? 1})`;
    this.stampLabel.position.set(
      BUILDING.x + BUILDING.w / 2,
      Math.max(1.5, roofY * 0.55),
      BUILDING.z + BUILDING.d + 0.6,
    );
    const since = this.shipAt === null ? null : now - this.shipAt;
    const raised = since === null ? null : flagRaised(since);
    this.flag.visible = raised !== null && raised > 0.01;
    this.flag.scale.y = Math.max(0.01, raised ?? 0);
    // At the back of the roof, clear of the workers along its front edge.
    this.flag.position.set(BUILDING.x + 5, roofY, BUILDING.z + 3);
    this.streamers.forEach((streamer, i) => {
      streamer.parent!.rotation.z = 0.18 * Math.sin(now / 320 + i * 0.9);
    });
    const dropped = since === null ? null : tapeDropped(since);
    this.tape.visible = dropped !== null;
    this.tapeHalves.forEach((half, i) => {
      half.rotation.z = (i === 0 ? -1 : 1) * 1.35 * (dropped ?? 0);
    });
    if (raised === null && dropped === null) this.shipAt = null;
    this.aviation.emissive.set(
      this.night && now % 1000 < 250 ? SITE.aviation : "#000000",
    );
  }

  dispose(): void {
    this.stampLabel.removeFromParent();
    for (const sign of this.signs.values()) sign.group.removeFromParent();
    this.signs.clear();
  }
}
