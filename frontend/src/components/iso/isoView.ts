/**
 * The three.js side of the isometric office: renderer, orthographic camera,
 * lights, pan/zoom controls and the render loop.
 */

import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import {
  FLOOR_CENTER,
  FLOOR_DEPTH,
  FLOOR_WIDTH,
} from "@/constants/isoFloorPlan";
import { buildIsoOffice } from "./buildIsoOffice";

/** Camera angles matched to the reference video (a slightly turned isometric view). */
const CAMERA_AZIMUTH = THREE.MathUtils.degToRad(41);
const CAMERA_ELEVATION = THREE.MathUtils.degToRad(33);
const CAMERA_DISTANCE = 120;
/** World units visible from top to bottom of the view at zoom 1. */
const VIEW_HEIGHT = 30;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const RESET_MS = 350;

export interface IsoView {
  zoomBy(factor: number): void;
  resetView(): void;
  dispose(): void;
}

function cameraOffset(): THREE.Vector3 {
  const horizontal = CAMERA_DISTANCE * Math.cos(CAMERA_ELEVATION);
  return new THREE.Vector3(
    horizontal * Math.sin(CAMERA_AZIMUTH),
    CAMERA_DISTANCE * Math.sin(CAMERA_ELEVATION),
    horizontal * Math.cos(CAMERA_AZIMUTH),
  );
}

function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight("#ffffff", "#d9e0ea", 1.6));
  const sun = new THREE.DirectionalLight("#ffffff", 1.5);
  sun.position.set(FLOOR_CENTER.x - 14, 40, FLOOR_CENTER.z + 26);
  sun.target.position.set(FLOOR_CENTER.x, 0, FLOOR_CENTER.z);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const half = Math.max(FLOOR_WIDTH, FLOOR_DEPTH) * 0.8;
  sun.shadow.camera.left = -half;
  sun.shadow.camera.right = half;
  sun.shadow.camera.top = half;
  sun.shadow.camera.bottom = -half;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
}

export function createIsoView(container: HTMLElement): IsoView {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = "block";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(buildIsoOffice());
  addLights(scene);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const home = new THREE.Vector3(FLOOR_CENTER.x, 0, FLOOR_CENTER.z);
  camera.position.copy(home).add(cameraOffset());
  camera.lookAt(home);

  const controls = new MapControls(camera, renderer.domElement);
  controls.target.copy(home);
  controls.enableRotate = false;
  controls.screenSpacePanning = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minZoom = MIN_ZOOM;
  controls.maxZoom = MAX_ZOOM;
  controls.zoomToCursor = true;
  controls.update();

  const resize = (): void => {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    const aspect = width / height;
    camera.left = (-VIEW_HEIGHT * aspect) / 2;
    camera.right = (VIEW_HEIGHT * aspect) / 2;
    camera.top = VIEW_HEIGHT / 2;
    camera.bottom = -VIEW_HEIGHT / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  // Reset eases the camera back to where it started.
  let reset: { start: number; from: THREE.Vector3; fromZoom: number } | null =
    null;
  const resetView = (): void => {
    reset = {
      start: performance.now(),
      from: controls.target.clone(),
      fromZoom: camera.zoom,
    };
  };
  const stepReset = (now: number): void => {
    if (!reset) return;
    const t = Math.min(1, (now - reset.start) / RESET_MS);
    const eased = 1 - Math.pow(1 - t, 3);
    controls.target.lerpVectors(reset.from, home, eased);
    camera.position.copy(controls.target).add(cameraOffset());
    camera.zoom = reset.fromZoom + (1 - reset.fromZoom) * eased;
    camera.updateProjectionMatrix();
    if (t >= 1) reset = null;
  };
  renderer.domElement.addEventListener("dblclick", resetView);

  let frame = 0;
  const loop = (now: number): void => {
    stepReset(now);
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);

  return {
    zoomBy(factor: number): void {
      camera.zoom = THREE.MathUtils.clamp(
        camera.zoom * factor,
        MIN_ZOOM,
        MAX_ZOOM,
      );
      camera.updateProjectionMatrix();
    },
    resetView,
    dispose(): void {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("dblclick", resetView);
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          for (const m of materials) {
            if ("map" in m && m.map instanceof THREE.Texture) m.map.dispose();
            m.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
