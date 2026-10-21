import { describe, expect, it } from "vitest";
import type { AgentAnimationState } from "@/stores/slices/types";
import { officePeople, type PeopleWords } from "@/systems/officePeople";

const WORDS: PeopleWords = {
  agentName: "Claude",
  me: "나",
  generalType: "범용",
};

function agent(
  id: string,
  fields: Partial<AgentAnimationState>,
): AgentAnimationState {
  return {
    id,
    name: null,
    currentTask: null,
    activity: null,
    stuck: null,
    agentType: null,
    phase: "idle",
    ...fields,
  } as AgentAnimationState;
}

describe("officePeople", () => {
  it("puts Claude and me first, Claude with the boss's activity", () => {
    const people = officePeople(
      { boss: { activity: "reading", stuck: null }, agents: new Map() },
      WORDS,
    );
    expect(people).toEqual([
      {
        id: "claude",
        kind: "claude",
        label: "Claude",
        activity: "reading",
        stuck: false,
      },
      { id: "me", kind: "me", label: "나", activity: null, stuck: false },
    ]);
  });

  it("labels a subagent with its type and task", () => {
    const agents = new Map([
      [
        "a1",
        agent("a1", {
          agentType: "general-purpose",
          currentTask: "T-013 부속 작성",
          activity: "running",
        }),
      ],
      [
        "a2",
        agent("a2", {
          agentType: "Explore",
          currentTask: "Find the login code",
        }),
      ],
      ["a3", agent("a3", { name: "Scout" })],
    ]);
    const people = officePeople(
      { boss: { activity: null, stuck: null }, agents },
      WORDS,
    );
    expect(people.slice(2)).toEqual([
      {
        id: "a1",
        kind: "subagent",
        label: "범용 · T-013 부속 작성",
        activity: "running",
        stuck: false,
      },
      {
        id: "a2",
        kind: "subagent",
        label: "Explore · Find the login code",
        activity: null,
        stuck: false,
      },
      {
        id: "a3",
        kind: "subagent",
        label: "Scout",
        activity: null,
        stuck: false,
      },
    ]);
  });

  it("leaves out subagents that have left the floor", () => {
    const agents = new Map([
      ["a1", agent("a1", { currentTask: "stays" })],
      ["a2", agent("a2", { currentTask: "leaves", phase: "departing" })],
      ["a3", agent("a3", { currentTask: "gone", phase: "in_elevator" })],
    ]);
    const ids = officePeople(
      { boss: { activity: null, stuck: null }, agents },
      WORDS,
    ).map((p) => p.id);
    expect(ids).toEqual(["claude", "me", "a1"]);
  });

  it("sends a person waiting for a permission to my desk, and keeps a failed one in place", () => {
    const agents = new Map([
      ["a1", agent("a1", { activity: "running", stuck: "tool_failed" })],
    ]);
    const [claude, , a1] = officePeople(
      { boss: { activity: "running", stuck: "waiting_permission" }, agents },
      WORDS,
    );
    expect(claude).toMatchObject({ activity: "asking", stuck: false });
    expect(a1).toMatchObject({ activity: "running", stuck: true });
  });
});
