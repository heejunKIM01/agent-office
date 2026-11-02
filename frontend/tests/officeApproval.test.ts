import { describe, expect, it } from "vitest";
import {
  HANDOVER_MS,
  NO_APPROVAL,
  VISIT_MAX_MS,
  isPrCreateCommand,
  isPrMergeCommand,
  latestApproval,
  prTitle,
  stepVisit,
} from "../src/systems/officeApproval";

describe("prTitle", () => {
  it("reads the title a gh pr create gives", () => {
    expect(
      prTitle('gh pr create --title "feat(office): add the board" --body x'),
    ).toBe("feat(office): add the board");
    expect(prTitle("gh pr create -t 'fix: keep the tray'")).toBe(
      "fix: keep the tray",
    );
    expect(prTitle('gh pr create --title="docs: notes"')).toBe("docs: notes");
    expect(prTitle("gh pr create --title Hotfix --fill")).toBe("Hotfix");
  });

  it("reads only the first line of a long title", () => {
    expect(prTitle('gh pr create --title "one\ntwo"')).toBe("one");
  });

  it("falls back to the command when no title is given", () => {
    expect(prTitle("gh pr create --fill")).toBe("gh pr create");
  });

  it("reads the title of the pr create, not of an earlier command", () => {
    expect(
      prTitle('git commit -m "wip" && gh pr create --title "feat: real"'),
    ).toBe("feat: real");
  });
});

describe("pull request commands", () => {
  it("tells opening from merging", () => {
    expect(isPrCreateCommand("gh pr create --fill")).toBe(true);
    expect(isPrCreateCommand("gh pr view 12")).toBe(false);
    expect(isPrMergeCommand("gh pr merge 12 --merge")).toBe(true);
    expect(isPrMergeCommand("git merge main")).toBe(false);
  });
});

describe("latestApproval", () => {
  const post = (command: string, id: number, errorType?: string) => ({
    id: String(id),
    type: "post_tool_use",
    timestamp: new Date(id * 1000),
    detail: { toolInput: { command }, ...(errorType ? { errorType } : {}) },
  });

  it("has the latest pull request and the merge after it", () => {
    const log = [
      post("gh pr merge 7 --merge", 5),
      post("npm test", 4),
      post('gh pr create --title "feat: b"', 3),
      post('gh pr create --title "feat: a"', 1),
    ];
    expect(latestApproval(log)).toEqual({
      created: { id: "3", title: "feat: b", at: 3000 },
      merged: { id: "5", at: 5000 },
    });
  });

  it("does not count a merge before the pull request was opened", () => {
    const log = [
      post('gh pr create --title "feat: b"', 3),
      post("gh pr merge 6", 2),
    ];
    expect(latestApproval(log).merged).toBeNull();
  });

  it("skips commands that failed", () => {
    const log = [
      post("gh pr merge 7", 5, "tool_error"),
      post('gh pr create --title "feat: b"', 3, "tool_error"),
      post('gh pr create --title "feat: a"', 1),
    ];
    expect(latestApproval(log)).toEqual({
      created: { id: "1", title: "feat: a", at: 1000 },
      merged: null,
    });
  });

  it("has nothing without a pull request", () => {
    expect(latestApproval([post("gh pr merge 3", 1)])).toEqual(NO_APPROVAL);
  });
});

describe("stepVisit", () => {
  it("hands the board over on reaching my desk and leaves a while after", () => {
    const set = { since: 0, until: null };
    expect(stepVisit(set, 1000, false)).toEqual({
      visit: set,
      handedOver: false,
    });
    const there = stepVisit(set, 4000, true);
    expect(there).toEqual({
      visit: { since: 0, until: 4000 + HANDOVER_MS },
      handedOver: true,
    });
    const staying = stepVisit(there.visit!, 5000, true);
    expect(staying.handedOver).toBe(false);
    expect(staying.visit).not.toBeNull();
    expect(stepVisit(there.visit!, 4000 + HANDOVER_MS, true).visit).toBeNull();
  });

  it("gives up an errand that never gets there", () => {
    expect(
      stepVisit({ since: 0, until: null }, VISIT_MAX_MS + 1, false).visit,
    ).toBeNull();
  });
});
