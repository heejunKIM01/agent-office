/**
 * Office slice (ARC-005).
 *
 * Session/scalar office state: desks, elevator, phone, compaction animation
 * phase, todos, git status, event log, conversation. Self-contained apart
 * from the @/types shapes it carries.
 */
import type { StateCreator } from "zustand";
import type { GameStore } from "../gameStore";
import type {
  ElevatorState,
  EventDetail,
  EventType,
  PhoneState,
  TodoItem,
  GitStatus,
  HistoryEntry,
  WebSocketMessage,
  ConversationEntry,
} from "@/types";
import type { EventLogEntry, CompactionAnimationPhase } from "./types";
import { MIN_DESK_COUNT } from "@/constants/positions";

const MAX_EVENT_LOG = 500;

/**
 * Identity of an event log entry. The backend sends each event twice, inside
 * the state snapshot's `history` and as its own `event` message, with the
 * same id (its timestamp), type, agent and summary.
 */
function eventLogKey(event: {
  id: string;
  type: string;
  agentId: string;
  summary: string;
}): string {
  return `${event.id}|${event.type}|${event.agentId}|${event.summary}`;
}

export type OfficeSlice = {
  sessionId: string;
  deskCount: number;
  elevatorState: ElevatorState;
  phoneState: PhoneState;
  contextUtilization: number;
  toolUsesSinceCompaction: number;
  isCompacting: boolean;
  compactionPhase: CompactionAnimationPhase;
  printReport: boolean;
  todos: TodoItem[];
  gitStatus: GitStatus | null;
  eventLog: EventLogEntry[];
  conversation: ConversationEntry[];

  setSessionId: (id: string) => void;
  setElevatorState: (state: ElevatorState) => void;
  setPhoneState: (state: PhoneState) => void;
  setDeskCount: (count: number) => void;
  setContextUtilization: (utilization: number) => void;
  setToolUsesSinceCompaction: (count: number) => void;
  triggerCompaction: () => void;
  setCompactionPhase: (phase: CompactionAnimationPhase) => void;
  setIsCompacting: (isCompacting: boolean) => void;
  setTodos: (todos: TodoItem[]) => void;
  setPrintReport: (printReport: boolean) => void;
  setGitStatus: (status: GitStatus | null) => void;
  addEventLog: (event: NonNullable<WebSocketMessage["event"]>) => void;
  mergeEventHistory: (history: HistoryEntry[]) => void;
  setConversation: (conversation: ConversationEntry[]) => void;
};

export const initialOfficeState = {
  sessionId: "None",
  deskCount: MIN_DESK_COUNT,
  elevatorState: "closed" as ElevatorState,
  phoneState: "idle" as PhoneState,
  contextUtilization: 0.0,
  toolUsesSinceCompaction: 0,
  isCompacting: false,
  compactionPhase: "idle" as CompactionAnimationPhase,
  printReport: false,
  todos: [] as TodoItem[],
  gitStatus: null as GitStatus | null,
  eventLog: [] as EventLogEntry[],
  conversation: [] as ConversationEntry[],
};

export const createOfficeSlice: StateCreator<GameStore, [], [], OfficeSlice> = (
  set,
) => ({
  ...initialOfficeState,

  setSessionId: (id) => set({ sessionId: id }),
  setElevatorState: (elevatorState) => set({ elevatorState }),
  setPhoneState: (phoneState) => set({ phoneState }),
  setDeskCount: (deskCount) => set({ deskCount }),
  setContextUtilization: (contextUtilization) =>
    // Only update context utilization - don't reset compaction state
    // The compaction animation system controls when compaction ends via setCompactionPhase
    set({ contextUtilization }),
  setToolUsesSinceCompaction: (toolUsesSinceCompaction) =>
    set({ toolUsesSinceCompaction }),
  triggerCompaction: () => {
    // Start compaction animation - boss will walk to trash can and jump on it
    set({
      isCompacting: true,
      toolUsesSinceCompaction: 0,
      compactionPhase: "walking_to_trash",
    });
  },
  setCompactionPhase: (compactionPhase) => set({ compactionPhase }),
  setIsCompacting: (isCompacting) => set({ isCompacting }),
  setTodos: (todos) => set({ todos }),
  setPrintReport: (printReport) => set({ printReport }),
  setGitStatus: (gitStatus) => set({ gitStatus }),

  addEventLog: (event) =>
    set((state) => {
      const key = eventLogKey(event);
      if (state.eventLog.some((logged) => eventLogKey(logged) === key)) {
        return state;
      }
      const timestamp = event.timestamp
        ? new Date(event.timestamp)
        : new Date();
      const entry: EventLogEntry = { ...event, timestamp };
      return {
        eventLog: [entry, ...state.eventLog.slice(0, MAX_EVENT_LOG - 1)],
      };
    }),

  // Adds history entries the log does not have yet (a reopened or finished
  // session has no live events), keeping the log newest-first.
  mergeEventHistory: (history) =>
    set((state) => {
      const logged = new Set(state.eventLog.map(eventLogKey));
      const missing: EventLogEntry[] = history
        .filter((entry) => !logged.has(eventLogKey(entry)))
        .map((entry) => ({
          id: entry.id,
          type: entry.type as EventType,
          agentId: entry.agentId,
          summary: entry.summary,
          timestamp: new Date(entry.timestamp),
          detail: entry.detail as EventDetail,
        }));
      if (missing.length === 0) return state;
      return {
        eventLog: [...state.eventLog, ...missing]
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, MAX_EVENT_LOG),
      };
    }),

  setConversation: (conversation) => set({ conversation }),
});
