import { describe, expect, it } from "vitest";
import {
  CAT_AFTER_MS,
  CUP_EVERY_MS,
  cupsFor,
  latestTurn,
  LAMP_HOLD_SECONDS,
  catOnKeyboard,
  lampLit,
  SCRATCH_EVERY_MS,
  SCRATCH_MS,
  commitTitle,
  commitsMade,
  isCommitCommand,
  isShipCommand,
  isTestCommand,
  lastShipped,
  lastFailedTestId,
  lastPassedTestId,
  scratchesHead,
  GLOBE_SPIN_SPEED,
  MAX_PILE,
  NO_PILE,
  bookPile,
  MAX_NOTES,
  WATCH_AFTER_MS,
  globeSpeed,
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

describe("globeSpeed", () => {
  it("winds up to full speed while searching and down to still after", () => {
    let speed = 0;
    for (let i = 0; i < 30; i++) speed = globeSpeed(speed, true, 0.1);
    expect(speed).toBe(GLOBE_SPIN_SPEED);
    const easing = globeSpeed(speed, false, 0.1);
    expect(easing).toBeGreaterThan(0);
    expect(easing).toBeLessThan(GLOBE_SPIN_SPEED);
    for (let i = 0; i < 30; i++) speed = globeSpeed(speed, false, 0.1);
    expect(speed).toBe(0);
  });
});

describe("bookPile", () => {
  it("adds a book for each new reading tool while in the library", () => {
    let pile = bookPile(NO_PILE, true, true, 100);
    expect(pile.count).toBe(1);
    pile = bookPile(pile, true, true, 100);
    expect(pile.count).toBe(1);
    pile = bookPile(pile, true, true, 200);
    expect(pile.count).toBe(2);
    pile = bookPile(pile, true, false, 300);
    expect(pile.count).toBe(2);
  });

  it("stops at MAX_PILE and is cleared on leaving the library", () => {
    let pile = NO_PILE;
    for (let at = 1; at <= 10; at++) pile = bookPile(pile, true, true, at);
    expect(pile.count).toBe(MAX_PILE);
    expect(bookPile(pile, false, true, 11)).toEqual(NO_PILE);
  });
});

describe("scratchesHead", () => {
  it("scratches for a moment at the end of each round of typing", () => {
    expect(scratchesHead(0)).toBe(false);
    expect(scratchesHead(SCRATCH_EVERY_MS - SCRATCH_MS - 1)).toBe(false);
    expect(scratchesHead(SCRATCH_EVERY_MS - SCRATCH_MS)).toBe(true);
    expect(scratchesHead(SCRATCH_EVERY_MS)).toBe(false);
    expect(scratchesHead(2 * SCRATCH_EVERY_MS - 1)).toBe(true);
  });
});

describe("test passes", () => {
  const post = (
    agentId: string,
    command: string,
    id: number,
    errorType?: string,
  ) => ({
    id: String(id),
    type: "post_tool_use",
    agentId,
    detail: { toolInput: { command }, ...(errorType ? { errorType } : {}) },
  });

  it("knows a test command when it sees one", () => {
    for (const command of [
      "npm test",
      "pytest -q",
      "bun run test:unit",
      "go test ./...",
    ]) {
      expect(isTestCommand(command)).toBe(true);
    }
    for (const command of ["npm run build", "git status", undefined]) {
      expect(isTestCommand(command)).toBe(false);
    }
  });

  it("names the agent's latest test run when it passed", () => {
    const log = [
      post("main", "git status", 30),
      post("sub", "npm test", 20, "tool_error"),
      post("main", "npm test", 10),
    ];
    expect(lastPassedTestId(log, "main")).toBe("10");
    expect(lastPassedTestId(log, "sub")).toBeNull();
    expect(lastPassedTestId(log, "other")).toBeNull();
  });

  it("does not cheer when the latest run failed after a pass", () => {
    const log = [
      post("main", "npm test", 20, "tool_error"),
      post("main", "npm test", 10),
    ];
    expect(lastPassedTestId(log, "main")).toBeNull();
  });

  it("names the agent's latest test run when it failed", () => {
    const log = [
      post("main", "git status", 30, "tool_error"),
      post("main", "npm test", 20, "tool_error"),
      post("sub", "npm test", 10),
    ];
    expect(lastFailedTestId(log, "main")).toBe("20");
    expect(lastFailedTestId(log, "sub")).toBeNull();
    expect(lastFailedTestId(log, "other")).toBeNull();
  });
});

describe("lampLit", () => {
  it("lights while someone steps out and a moment after", () => {
    expect(lampLit(null, 10)).toBe(false);
    expect(lampLit(10, 10)).toBe(true);
    expect(lampLit(10, 10 + LAMP_HOLD_SECONDS - 0.01)).toBe(true);
    expect(lampLit(10, 10 + LAMP_HOLD_SECONDS)).toBe(false);
  });
});

describe("lastShipped", () => {
  const post = (command: string, id: number, errorType?: string) => ({
    id: String(id),
    type: "post_tool_use",
    timestamp: new Date(id * 1000),
    detail: { toolInput: { command }, ...(errorType ? { errorType } : {}) },
  });

  it("knows a push or a merge when it sees one", () => {
    for (const command of [
      "git push -u origin feat/x",
      "gh pr merge 74 --merge --delete-branch",
      "cd web && git push",
    ]) {
      expect(isShipCommand(command)).toBe(true);
    }
    for (const command of ["git pull", "gh pr view 74", "git status", null]) {
      expect(isShipCommand(command)).toBe(false);
    }
  });

  it("names the latest push or merge that went through, and when", () => {
    expect(
      lastShipped([
        post("git status", 30),
        post("git push", 20),
        post("gh pr merge 1", 10),
      ]),
    ).toEqual({ id: "20", at: 20_000 });
    expect(
      lastShipped([post("git push", 20, "tool_error"), post("git push", 10)]),
    ).toBeNull();
    expect(lastShipped([post("npm test", 10)])).toBeNull();
  });
});

describe("commitsMade", () => {
  const post = (command: string, id: number, errorType?: string) => ({
    id: String(id),
    type: "post_tool_use",
    timestamp: new Date(id * 1000),
    detail: { toolInput: { command }, ...(errorType ? { errorType } : {}) },
  });

  it("reads a commit message's first line", () => {
    expect(commitTitle('git commit -m "fix: keep the tray"')).toBe(
      "fix: keep the tray",
    );
    expect(commitTitle("git commit -m 'docs: notes'")).toBe("docs: notes");
    expect(
      commitTitle(
        "git commit -m \"$(cat <<'EOF'\nfeat(office): file commits\n\nCo-Authored-By: x\nEOF\n)\"",
      ),
    ).toBe("feat(office): file commits");
    expect(commitTitle("git commit --amend --no-edit")).toBe("");
    expect(isCommitCommand("git add a && git commit -m x")).toBe(true);
    expect(isCommitCommand("git log --oneline")).toBe(false);
  });

  it("counts the commits that went through and names the latest", () => {
    expect(
      commitsMade([
        post('git commit -m "two"', 30),
        post('git commit -m "nope"', 20, "tool_error"),
        post("git status", 15),
        post('git commit -m "one"', 10),
      ]),
    ).toEqual({ count: 2, last: { id: "30", title: "two", at: 30_000 } });
    expect(commitsMade([])).toEqual({ count: 0, last: null });
  });
});

describe("catOnKeyboard", () => {
  it("curls up on my keyboard once Claude has waited a few minutes", () => {
    expect(catOnKeyboard(null)).toBe(false);
    expect(catOnKeyboard(CAT_AFTER_MS - 1)).toBe(false);
    expect(catOnKeyboard(CAT_AFTER_MS)).toBe(true);
  });
});

describe("cupsFor", () => {
  const at = (minutes: number) => new Date(minutes * 60_000);
  const entry = (type: string, minutes: number, agentId = "main") => ({
    type,
    agentId,
    timestamp: at(minutes),
  });

  it("finds the latest turn and when Claude first stopped after it", () => {
    expect(
      latestTurn([
        entry("stop", 90),
        entry("pre_tool_use", 80),
        entry("stop", 70),
        entry("stop", 65, "sub"),
        entry("user_prompt_submit", 10),
        entry("user_prompt_submit", 1),
      ]),
    ).toEqual({ start: 600_000, end: 4_200_000 });
    expect(
      latestTurn([entry("pre_tool_use", 5), entry("user_prompt_submit", 1)]),
    ).toEqual({ start: 60_000, end: null });
    expect(latestTurn([entry("session_start", 0)])).toBeNull();
  });

  it("leaves a cup per half hour the turn ran, up to three", () => {
    expect(cupsFor(null, 0)).toBe(0);
    expect(cupsFor({ start: 0, end: null }, CUP_EVERY_MS - 1)).toBe(0);
    expect(cupsFor({ start: 0, end: null }, 2 * CUP_EVERY_MS)).toBe(2);
    expect(cupsFor({ start: 0, end: CUP_EVERY_MS }, 9 * CUP_EVERY_MS)).toBe(1);
    expect(cupsFor({ start: 0, end: null }, 9 * CUP_EVERY_MS)).toBe(3);
  });
});
