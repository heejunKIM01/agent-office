import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  buildCharacter,
  poseCharacter,
  type CharacterRig,
} from "../src/components/iso/isoCharacters";

/** How high the name chip (and the bubble over it) is drawn. */
const chipHeight = (rig: CharacterRig): number =>
  rig.chipAnchor.getWorldPosition(new THREE.Vector3()).y;

describe("name chip", () => {
  it("stays still through a stride, a hop and a rocking head-clutch", () => {
    const rig = buildCharacter("subagent");
    const heights = [0, 0.1, 0.17, 0.33].flatMap((seconds) => {
      poseCharacter(rig, "walk", null, seconds);
      const walking = chipHeight(rig);
      poseCharacter(rig, "work", "library", seconds, false, "cheer");
      const cheering = chipHeight(rig);
      poseCharacter(rig, "work", "library", seconds, false, "dismay");
      return [walking, cheering, chipHeight(rig)];
    });
    expect(new Set(heights).size).toBe(1);
  });

  it("goes down with the person sitting and back up standing", () => {
    const rig = buildCharacter("claude");
    poseCharacter(rig, "work", "library", 0);
    const standing = chipHeight(rig);
    poseCharacter(rig, "type", null, 0);
    const seated = chipHeight(rig);
    expect(seated).toBeLessThan(standing);
    poseCharacter(rig, "walk", null, 0.2);
    expect(chipHeight(rig)).toBe(standing);
  });
});
