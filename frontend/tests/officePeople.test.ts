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
    agentType: null,
    phase: "idle",
    ...fields,
  } as AgentAnimationState;
}

describe("officePeople", () => {
  it("puts Claude and me first, Claude with the boss's activity", () => {
    const people = officePeople(
      { boss: { activity: "reading" }, agents: new Map() },
      WORDS,
    );
    expect(people).toEqual([
      { id: "claude", kind: "claude", label: "Claude", activity: "reading" },
      { id: "me", kind: "me", label: "나", activity: null },
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
    const people = officePeople({ boss: { activity: null }, agents }, WORDS);
    expect(people.slice(2)).toEqual([
      {
        id: "a1",
        kind: "subagent",
        label: "범용 · T-013 부속 작성",
        activity: "running",
      },
      {
        id: "a2",
        kind: "subagent",
        label: "Explore · Find the login code",
        activity: null,
      },
      { id: "a3", kind: "subagent", label: "Scout", activity: null },
    ]);
  });

  it("leaves out subagents that have left the floor", () => {
    const agents = new Map([
      ["a1", agent("a1", { currentTask: "stays" })],
      ["a2", agent("a2", { currentTask: "leaves", phase: "departing" })],
      ["a3", agent("a3", { currentTask: "gone", phase: "in_elevator" })],
    ]);
    const ids = officePeople({ boss: { activity: null }, agents }, WORDS).map(
      (p) => p.id,
    );
    expect(ids).toEqual(["claude", "me", "a1"]);
  });
});
