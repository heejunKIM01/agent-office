import { describe, expect, it } from "vitest";
import {
  DROP_MS,
  WAVE_MS,
  carrying,
  courierAtDoor,
  isFreshParcel,
  parcelLabel,
  parcelsDelivered,
  startCourier,
  stepCourier,
  type Courier,
  type CourierWay,
} from "../src/systems/officeParcels";
import { FRESH_MS } from "../src/systems/roomGimmicks";

describe("parcelLabel", () => {
  it("labels a box with the packages a command installs", () => {
    expect(parcelLabel("bun add zod three")).toBe("zod, three");
    expect(parcelLabel("npm install -D vitest @types/node")).toBe(
      "vitest, @types/node",
    );
    expect(parcelLabel("npm i lodash")).toBe("lodash");
    expect(parcelLabel("pnpm add react@18.3.1")).toBe("react@18.3.1");
    expect(parcelLabel("uv add httpx")).toBe("httpx");
    expect(parcelLabel("uv pip install 'rich>=13'")).toBe("rich>=13");
    expect(parcelLabel("pip3 install requests")).toBe("requests");
    expect(parcelLabel("cargo add serde")).toBe("serde");
    expect(parcelLabel("brew install jq")).toBe("jq");
  });

  it("reads only the install's own part of a chained command", () => {
    expect(parcelLabel("cd frontend && bun add zod && bun run build")).toBe(
      "zod",
    );
    expect(parcelLabel("yarn add dayjs; yarn test")).toBe("dayjs");
  });

  it("labels an install that names no package with the install itself", () => {
    expect(parcelLabel("npm install")).toBe("npm install");
    expect(parcelLabel("cd frontend && bun install --frozen-lockfile")).toBe(
      "bun install",
    );
  });

  it("is null for commands that install nothing", () => {
    expect(parcelLabel("npm run build")).toBeNull();
    expect(parcelLabel("git commit -m 'add zod'")).toBeNull();
    expect(parcelLabel("npx vitest")).toBeNull();
    expect(parcelLabel(undefined)).toBeNull();
  });
});

describe("parcelsDelivered", () => {
  const post = (command: string, id: number, errorType?: string) => ({
    id: String(id),
    type: "post_tool_use",
    timestamp: new Date(id * 1000),
    detail: { toolInput: { command }, ...(errorType ? { errorType } : {}) },
  });

  it("counts the installs that went through, the newest first", () => {
    const log = [
      post("bun add zod", 4),
      post("npm install left-pad", 3, "tool_error"),
      post("npm run build", 2),
      post("uv add httpx", 1),
    ];
    expect(parcelsDelivered(log)).toEqual({
      count: 2,
      last: { id: "4", label: "zod", at: 4000 },
    });
  });

  it("has no parcel without an install", () => {
    expect(parcelsDelivered([post("ls", 1)])).toEqual({
      count: 0,
      last: null,
    });
  });
});

describe("isFreshParcel", () => {
  const parcel = { id: "7", label: "zod", at: 10_000 };

  it("brings a new parcel installed just now", () => {
    expect(isFreshParcel(parcel, null, 10_500)).toBe(true);
  });

  it("does not bring one already seen or installed long ago", () => {
    expect(isFreshParcel(parcel, "7", 10_500)).toBe(false);
    expect(isFreshParcel(parcel, null, 10_000 + FRESH_MS)).toBe(false);
    expect(isFreshParcel(null, null, 0)).toBe(false);
  });
});

describe("stepCourier", () => {
  const way: CourierWay = {
    cab: { x: 0, z: -2 },
    door: { x: 0, z: 0 },
    drop: { x: 4, z: 0 },
    dropFacing: Math.PI,
    findPath: (from, to) => [from, to],
  };
  const parcel = { id: "1", label: "zod", at: 0 };

  /** Step until the leg changes (or the courier is gone); the step it changed on. */
  function walkLeg(
    courier: Courier,
    now: number,
  ): {
    courier: Courier | null;
    now: number;
    dropped: boolean;
  } {
    let at = now;
    let current: Courier | null = courier;
    for (let i = 0; i < 1000 && current; i++) {
      at += 100;
      const step = stepCourier(current, way, at, 0.1);
      if (!step.courier || step.courier.leg !== current.leg || step.dropped) {
        return { courier: step.courier, now: at, dropped: step.dropped };
      }
      current = step.courier;
    }
    throw new Error("the courier never moved on");
  }

  it("steps out, brings the box, sets it down, waves and rides back down", () => {
    let courier: Courier | null = startCourier(parcel, way);
    expect(courier.leg).toBe("out");
    expect(courierAtDoor(courier, way.door)).toBe(true);
    let now = 0;
    const legs: string[] = [courier.leg];
    let drops = 0;
    while (courier) {
      const step = walkLeg(courier, now);
      if (step.dropped) drops += 1;
      courier = step.courier;
      now = step.now;
      if (courier) legs.push(courier.leg);
    }
    expect(legs).toEqual(["out", "deliver", "drop", "wave", "back", "in"]);
    expect(drops).toBe(1);
  });

  it("holds the box until it sets it down, facing the stack", () => {
    let courier = startCourier(parcel, way);
    expect(carrying(courier)).toBe(true);
    courier = walkLeg(courier, 0).courier as Courier; // deliver
    const atStack = walkLeg(courier, 0);
    courier = atStack.courier as Courier; // drop
    expect(courier.walker.facing).toBe(Math.PI);
    expect(courier.until).toBe(atStack.now + DROP_MS);
    expect(carrying(courier)).toBe(true);
    const down = walkLeg(courier, atStack.now);
    expect(down.dropped).toBe(true);
    expect(down.courier?.leg).toBe("wave");
    expect(down.courier?.until).toBe(down.now + WAVE_MS);
    expect(carrying(down.courier as Courier)).toBe(false);
  });

  it("keeps the elevator shut while the courier is away from it", () => {
    let courier = startCourier(parcel, way);
    courier = walkLeg(courier, 0).courier as Courier;
    courier = walkLeg(courier, 0).courier as Courier; // at the stack, 4 m off
    expect(courierAtDoor(courier, way.door)).toBe(false);
    expect(courierAtDoor(null, way.door)).toBe(false);
  });
});
