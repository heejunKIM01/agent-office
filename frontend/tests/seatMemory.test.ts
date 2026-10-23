import { afterEach, describe, expect, it } from "vitest";
import {
  chooseSeat,
  rememberSeat,
  rememberedSeats,
} from "@/systems/seatMemory";

describe("seat memory", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "sessionStorage");
  });

  it("gives back the chair one sat in while it is free", () => {
    expect(chooseSeat(5, new Set([0, 1]), 3)).toBe(3);
  });

  it("takes the first free chair when its own is taken or unknown", () => {
    expect(chooseSeat(5, new Set([0, 3]), 3)).toBe(1);
    expect(chooseSeat(5, new Set([0]), undefined)).toBe(1);
    expect(chooseSeat(5, new Set(), 9)).toBe(0);
  });

  it("shares the last chair when all are taken", () => {
    expect(chooseSeat(2, new Set([0, 1]), undefined)).toBe(1);
  });

  it("keeps the chairs for the tab, across a reload", () => {
    const store = new Map<string, string>();
    Object.assign(globalThis, {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    });
    const seats = rememberedSeats();
    rememberSeat(seats, "subagent_a", 2);
    rememberSeat(seats, "colleague:s2", 0);

    expect([...rememberedSeats()]).toEqual([
      ["subagent_a", 2],
      ["colleague:s2", 0],
    ]);
  });

  it("forgets the oldest past 64 and works without storage", () => {
    const seats = new Map<string, number>();
    for (let i = 0; i < 70; i++) rememberSeat(seats, `p${i}`, i % 11);
    expect(seats.size).toBe(64);
    expect(seats.has("p0")).toBe(false);
    expect(rememberedSeats().size).toBe(0);
  });
});
