import { describe, expect, it } from "vitest";
import {
  ALARM_MS,
  beaconOn,
  FLAG_MS,
  flagRaised,
  STAMP_MS,
  stampLook,
  TAPE_CUT_MS,
  TAPE_MS,
  tapeDropped,
} from "@/systems/siteMoments";

describe("the site's moments", () => {
  it("flashes the beacon on and off, then stops", () => {
    expect(beaconOn(0)).toBe(true);
    expect(beaconOn(130)).toBe(false);
    expect(beaconOn(260)).toBe(true);
    expect(beaconOn(ALARM_MS)).toBeNull();
    expect(beaconOn(-1)).toBeNull();
  });

  it("lands the stamp big, settles it and fades it out", () => {
    expect(stampLook(0)?.scale).toBeCloseTo(1.8);
    expect(stampLook(400)?.scale).toBeCloseTo(1);
    expect(stampLook(1000)?.opacity).toBeCloseTo(1);
    expect(stampLook(STAMP_MS - 100)!.opacity).toBeLessThan(0.5);
    expect(stampLook(STAMP_MS)).toBeNull();
  });

  it("raises the flag, flies it and lowers it", () => {
    expect(flagRaised(0)).toBeCloseTo(0);
    expect(flagRaised(5000)).toBeCloseTo(1);
    expect(flagRaised(FLAG_MS - 100)!).toBeLessThan(0.1);
    expect(flagRaised(FLAG_MS)).toBeNull();
  });

  it("keeps the ribbon taut until it is cut, then drops both halves", () => {
    expect(tapeDropped(0)).toBe(0);
    expect(tapeDropped(TAPE_CUT_MS - 10)).toBe(0);
    expect(tapeDropped(TAPE_CUT_MS + 1000)).toBe(1);
    expect(tapeDropped(TAPE_MS)).toBeNull();
  });
});
