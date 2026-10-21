/**
 * Who is in the isometric office and what their name chips say
 * (docs/plan/spec.md 「캐릭터」): Claude, me, and each subagent still at work.
 * A subagent's chip reads 「범용 · 작업 제목」 — its type, then its task.
 *
 * Waiting for a permission is asking (spec 「방 ↔ 도구」: 내 자리 —
 * AskUserQuestion, 권한 대기), so the person comes to my desk; a failed
 * tool keeps it where it is (R3).
 *
 * A subagent the backend has just made comes by elevator; one whose work
 * is done stays listed as leaving, so it can report and go home. Explore
 * wears green and Plan purple (작성자 댓글).
 */

import type { Activity, BubbleContent, StuckReason } from "@/types";
import type {
  AgentAnimationState,
  AgentPhase,
  BubbleState,
} from "@/stores/slices/types";

export type PersonKind = "claude" | "me" | "subagent";

/** What a subagent wears, by its type. */
export type Outfit = "general" | "explore" | "plan";

export interface IsoPerson {
  id: string;
  kind: PersonKind;
  /** Text on the name chip. */
  label: string;
  /** What to call it in lists: its task (or name), and its kind (「범용」, 「Claude」). */
  title: string;
  typeLabel: string;
  activity: Activity | null;
  /** A failed tool: it ponders where it is. */
  stuck: boolean;
  /** Its latest bubble from the backend, and when it arrived (Date.now ms). */
  bubble: BubbleContent | null;
  bubbleAt: number | null;
  /** Working with no tool running: it is thinking. */
  thinking: boolean;
  /** A subagent the backend has just made, not yet at work: it comes by elevator. */
  arriving: boolean;
  /** A subagent whose work is done: it reports to Claude and goes home. */
  leaving: boolean;
  outfit: Outfit;
}

/** Words the chips need, already translated. */
export interface PeopleWords {
  /** The lead agent's name, e.g. "Claude". */
  agentName: string;
  me: string;
  /** Shown for the "general-purpose" subagent type. */
  generalType: string;
}

/** Backend states of a subagent still at its task (it has not reported back). */
const AT_WORK_STATES: ReadonlySet<AgentAnimationState["backendState"]> =
  new Set(["arriving", "walking_to_desk", "working", "thinking"]);

/** Subagents in these phases are on their way out (the 2D office walks them out). */
const LEFT_PHASES: ReadonlySet<AgentPhase> = new Set([
  "departing",
  "in_departure_queue",
  "walking_to_elevator",
  "in_elevator",
]);

/**
 * Backend states of a subagent on its way in: SUBAGENT_START makes it
 * arriving and at once walking to its desk, until its first tool.
 */
const ARRIVING_STATES: ReadonlySet<AgentAnimationState["backendState"]> =
  new Set(["arriving", "walking_to_desk"]);

/** Backend states of a subagent whose work is done (SUBAGENT_STOP sets waiting). */
const DONE_STATES: ReadonlySet<AgentAnimationState["backendState"]> = new Set([
  "waiting",
  "reporting_done",
  "completed",
  "leaving",
  "in_elevator",
]);

/** Explore wears green and a cap, Plan purple and glasses, the rest blue. */
export function outfitOf(agentType: string | null | undefined): Outfit {
  const type = agentType?.toLowerCase() ?? "";
  if (type.includes("explore")) return "explore";
  if (type.includes("plan")) return "plan";
  return "general";
}

function subagentNames(
  agent: AgentAnimationState,
  words: PeopleWords,
): Pick<IsoPerson, "label" | "title" | "typeLabel"> {
  const type =
    agent.agentType === "general-purpose" ? words.generalType : agent.agentType;
  const task = agent.currentTask || agent.name || "";
  const title = task || type || agent.id.slice(0, 8);
  return {
    label: type && task ? `${type} · ${task}` : title,
    title,
    typeLabel: type ?? "",
  };
}

/** What a person is doing, with a permission wait counted as asking. */
function doing(
  activity: Activity | null,
  stuck: StuckReason | null,
): Pick<IsoPerson, "activity" | "stuck"> {
  return {
    activity: stuck === "waiting_permission" ? "asking" : activity,
    stuck: stuck === "tool_failed",
  };
}

const said = (bubble: BubbleState): Pick<IsoPerson, "bubble" | "bubbleAt"> => ({
  bubble: bubble.content,
  bubbleAt: bubble.displayStartTime,
});

/** Everyone to show, Claude and me first. */
export function officePeople(
  state: {
    boss: {
      activity: Activity | null;
      stuck: StuckReason | null;
      bubble: BubbleState;
      /** Set while the boss is quiet mid-turn (see stateReconciler). */
      quietSince: number | null;
    };
    agents: Map<string, AgentAnimationState>;
  },
  words: PeopleWords,
): IsoPerson[] {
  const people: IsoPerson[] = [
    {
      id: "claude",
      kind: "claude",
      label: words.agentName,
      title: words.agentName,
      typeLabel: words.agentName,
      ...doing(state.boss.activity, state.boss.stuck),
      ...said(state.boss.bubble),
      thinking: state.boss.quietSince !== null,
      arriving: false,
      leaving: false,
      outfit: "general",
    },
    {
      id: "me",
      kind: "me",
      label: words.me,
      title: words.me,
      typeLabel: "",
      activity: null,
      stuck: false,
      bubble: null,
      bubbleAt: null,
      thinking: false,
      arriving: false,
      leaving: false,
      outfit: "general",
    },
  ];
  for (const agent of state.agents.values()) {
    const leaving =
      LEFT_PHASES.has(agent.phase) || DONE_STATES.has(agent.backendState);
    people.push({
      id: agent.id,
      kind: "subagent",
      ...subagentNames(agent, words),
      ...doing(agent.activity, agent.stuck),
      ...said(agent.bubble),
      thinking:
        !leaving &&
        AT_WORK_STATES.has(agent.backendState) &&
        !agent.activity &&
        !agent.stuck,
      arriving: ARRIVING_STATES.has(agent.backendState),
      leaving,
      outfit: outfitOf(agent.agentType),
    });
  }
  return people;
}
