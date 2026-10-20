import { describe, expect, it } from "vitest";
import type { Session } from "@/hooks/useSessions";
import { buildFloors, floorOfSession } from "@/systems/floors";

function session(
  id: string,
  project: string,
  created: string,
  updated: string,
  status = "completed",
): Session {
  return {
    id,
    label: null,
    displayName: null,
    projectName: project,
    projectRoot: `/work/${project}`,
    createdAt: created,
    updatedAt: updated,
    status,
    eventCount: 1,
    floorId: null,
    roomId: null,
    codingAgent: null,
  };
}

describe("buildFloors", () => {
  const sessions = [
    session("b1", "api", "2026-10-02T00:00:00Z", "2026-10-02T01:00:00Z"),
    session("a1", "shop", "2026-10-01T00:00:00Z", "2026-10-01T01:00:00Z"),
    session(
      "a2",
      "shop",
      "2026-10-03T00:00:00Z",
      "2026-10-03T05:00:00Z",
      "active",
    ),
  ];

  it("numbers floors by the project seen first and lists the top floor first", () => {
    const floors = buildFloors(sessions);
    expect(floors.map((f) => [f.number, f.name])).toEqual([
      [2, "api"],
      [1, "shop"],
    ]);
  });

  it("puts each floor's newest session first and marks active floors", () => {
    const shop = buildFloors(sessions).find((f) => f.name === "shop");
    expect(shop?.sessions.map((s) => s.id)).toEqual(["a2", "a1"]);
    expect(shop?.active).toBe(true);
  });

  it("finds a session's floor", () => {
    expect(floorOfSession(buildFloors(sessions), "b1")?.number).toBe(2);
    expect(floorOfSession(buildFloors(sessions), "missing")).toBeUndefined();
  });
});
