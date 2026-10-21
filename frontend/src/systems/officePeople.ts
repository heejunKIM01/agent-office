/**
 * Who is in the isometric office and what their name chips say
 * (docs/plan/spec.md 「캐릭터」): Claude, me, and each subagent still at work.
 * A subagent's chip reads 「범용 · 작업 제목」 — its type, then its task.
 */

import type { Activity } from "@/types";
import type { AgentAnimationState, AgentPhase } from "@/stores/slices/types";

export type PersonKind = "claude" | "me" | "subagent";

export interface IsoPerson {
  id: string;
  kind: PersonKind;
  /** Text on the name chip. */
  label: string;
  activity: Activity | null;
}

/** Words the chips need, already translated. */
export interface PeopleWords {
  /** The lead agent's name, e.g. "Claude". */
  agentName: string;
  me: string;
  /** Shown for the "general-purpose" subagent type. */
  generalType: string;
}

/** Subagents in these phases have left the floor (the 2D office walks them out). */
const LEFT_PHASES: ReadonlySet<AgentPhase> = new Set([
  "departing",
  "in_departure_queue",
  "walking_to_elevator",
  "in_elevator",
]);

function subagentLabel(agent: AgentAnimationState, words: PeopleWords): string {
  const type =
    agent.agentType === "general-purpose" ? words.generalType : agent.agentType;
  const task = agent.currentTask || agent.name || "";
  if (type && task) return `${type} · ${task}`;
  return type || task || agent.id.slice(0, 8);
}

/** Everyone to show, Claude and me first. */
export function officePeople(
  state: {
    boss: { activity: Activity | null };
    agents: Map<string, AgentAnimationState>;
  },
  words: PeopleWords,
): IsoPerson[] {
  const people: IsoPerson[] = [
    {
      id: "claude",
      kind: "claude",
      label: words.agentName,
      activity: state.boss.activity,
    },
    { id: "me", kind: "me", label: words.me, activity: null },
  ];
  for (const agent of state.agents.values()) {
    if (LEFT_PHASES.has(agent.phase)) continue;
    people.push({
      id: agent.id,
      kind: "subagent",
      label: subagentLabel(agent, words),
      activity: agent.activity,
    });
  }
  return people;
}
