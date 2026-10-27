// @vitest-environment happy-dom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { petSnore } from "../src/components/iso/isoBubbles";

describe("petSnore", () => {
  it("shows 💤 over the pet only while it sleeps", () => {
    const pet = new THREE.Group();
    const snore = petSnore(pet, 0.5);
    const label = pet.children.find(
      (c) => c instanceof CSS2DObject,
    ) as CSS2DObject;
    expect(label.position.y).toBe(0.5);
    expect(label.element.textContent).toBe("");
    snore(true);
    expect(label.element.textContent).toBe("💤");
    snore(true);
    expect(label.element.childElementCount).toBe(2);
    snore(false);
    expect(label.element.textContent).toBe("");
  });

  it("leaves no room for a name chip under it", () => {
    const pet = new THREE.Group();
    petSnore(pet, 0.5);
    const label = pet.children[0] as CSS2DObject;
    expect(label.element.className).not.toContain("pb-");
  });
});
