import { describe, expect, it } from "vitest";
import {
  MAX_NOTES,
  WATCH_AFTER_MS,
  latestTodoNotes,
  todoNotes,
  watchesTheClock,
} from "../src/systems/roomGimmicks";

describe("watchesTheClock", () => {
  it("checks the watch only once a command has run for a while", () => {
    expect(watchesTheClock(0)).toBe(false);
    expect(watchesTheClock(WATCH_AFTER_MS - 1)).toBe(false);
    expect(watchesTheClock(WATCH_AFTER_MS)).toBe(true);
  });
});

describe("todoNotes", () => {
  it("reads the to-do list of TodoWrite and the plan of update_plan", () => {
    expect(
      todoNotes({
        todos: [
          { content: "a", status: "completed" },
          { content: "b", status: "in_progress" },
          { content: "c", status: "pending" },
        ],
      }),
    ).toEqual(["completed", "in_progress", "pending"]);
    expect(
      todoNotes({ plan: [{ step: "a", status: "completed" }, { step: "b" }] }),
    ).toEqual(["completed", "pending"]);
  });

  it("is not a list for other tools, and holds at most MAX_NOTES", () => {
    expect(todoNotes({ file_path: "a.ts" })).toBeNull();
    expect(todoNotes(undefined)).toBeNull();
    const many = Array.from({ length: 20 }, () => ({ status: "pending" }));
    expect(todoNotes({ todos: many })).toHaveLength(MAX_NOTES);
  });

  it("takes the newest list in the log", () => {
    const log = [
      { detail: { toolInput: { command: "ls" } } },
      { detail: { toolInput: { todos: [{ status: "completed" }] } } },
      { detail: { toolInput: { todos: [{}, {}] } } },
    ];
    expect(latestTodoNotes(log)).toEqual(["completed"]);
    expect(latestTodoNotes([])).toBeNull();
  });
});
