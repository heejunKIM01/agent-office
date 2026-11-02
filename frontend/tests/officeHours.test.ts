import { describe, expect, it } from "vitest";
import {
  clockAngles,
  dayPart,
  lastWorkAt,
  nightStart,
  workedTonight,
} from "../src/systems/officeHours";

const at = (h: number, m = 0, s = 0, day = 2) =>
  new Date(2026, 10, day, h, m, s);

describe("dayPart", () => {
  it("is lunch from noon to one", () => {
    expect(dayPart(at(11, 59))).toBe("day");
    expect(dayPart(at(12, 0))).toBe("lunch");
    expect(dayPart(at(12, 59))).toBe("lunch");
    expect(dayPart(at(13, 0))).toBe("day");
  });

  it("is night from seven in the evening to six in the morning", () => {
    expect(dayPart(at(18, 59))).toBe("day");
    expect(dayPart(at(19, 0))).toBe("night");
    expect(dayPart(at(23, 30))).toBe("night");
    expect(dayPart(at(2, 0))).toBe("night");
    expect(dayPart(at(5, 59))).toBe("night");
    expect(dayPart(at(6, 0))).toBe("day");
  });
});

describe("clockAngles", () => {
  const turn = Math.PI * 2;

  it("points both hands up at twelve", () => {
    expect(clockAngles(at(12, 0))).toEqual({ hour: 0, minute: 0, second: 0 });
    expect(clockAngles(at(0, 0)).hour).toBe(0);
  });

  it("moves the hour hand on with the minutes", () => {
    const angles = clockAngles(at(3, 30));
    expect(angles.minute).toBeCloseTo(turn / 2);
    expect(angles.hour).toBeCloseTo((3.5 / 12) * turn);
    expect(clockAngles(at(15, 30)).hour).toBeCloseTo(angles.hour);
  });

  it("ticks the second hand", () => {
    expect(clockAngles(at(9, 0, 15)).second).toBeCloseTo(turn / 4);
  });
});

describe("workedTonight", () => {
  it("counts work since seven this evening", () => {
    expect(nightStart(at(21))).toBe(at(19).getTime());
    expect(workedTonight(at(19, 30).getTime(), at(21))).toBe(true);
    expect(workedTonight(at(18, 30).getTime(), at(21))).toBe(false);
  });

  it("counts last evening's work before dawn", () => {
    expect(nightStart(at(2, 0, 0, 3))).toBe(at(19).getTime());
    expect(workedTonight(at(23).getTime(), at(2, 0, 0, 3))).toBe(true);
  });

  it("is never true in the daytime or without work", () => {
    expect(workedTonight(at(10).getTime(), at(10, 30))).toBe(false);
    expect(workedTonight(null, at(21))).toBe(false);
  });
});

describe("lastWorkAt", () => {
  it("is the newest prompt or tool event", () => {
    const log = [
      { type: "notification", timestamp: new Date(5000) },
      { type: "post_tool_use", timestamp: new Date(4000) },
      { type: "user_prompt_submit", timestamp: new Date(1000) },
    ];
    expect(lastWorkAt(log)).toBe(4000);
    expect(lastWorkAt([{ type: "stop", timestamp: new Date(1) }])).toBeNull();
  });
});
