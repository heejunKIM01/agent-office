import { describe, expect, it } from "vitest";
import {
  PRINT_MS,
  fileName,
  isFreshPrintout,
  printProgress,
  printouts,
} from "../src/systems/officePrinter";
import { FRESH_MS } from "../src/systems/roomGimmicks";

const write = (
  id: string,
  path: string,
  at: number,
  detail: { fileCreated?: boolean; errorType?: string } = { fileCreated: true },
) => ({
  id,
  type: "post_tool_use",
  timestamp: new Date(at),
  detail: { toolName: "Write", toolInput: { file_path: path }, ...detail },
});

describe("fileName", () => {
  it("keeps the last part of a path", () => {
    expect(fileName("/Users/me/app/src/officePrinter.ts")).toBe(
      "officePrinter.ts",
    );
    expect(fileName("README.md")).toBe("README.md");
    expect(fileName("C:\\work\\app\\main.py")).toBe("main.py");
    expect(fileName("docs/plan/")).toBe("plan");
  });

  it("has no name for an empty or missing path", () => {
    expect(fileName("")).toBeNull();
    expect(fileName("/")).toBeNull();
    expect(fileName(undefined)).toBeNull();
    expect(fileName(42)).toBeNull();
  });
});

describe("printouts", () => {
  it("counts only writes that made a new file, the newest first", () => {
    const log = [
      write("w4", "/app/src/b.ts", 4_000),
      write("w3", "/app/src/a.ts", 3_000, {}),
      write("w2", "/app/src/a.ts", 2_000),
      write("w1", "/app/notes.md", 1_000, {
        fileCreated: true,
        errorType: "tool_error",
      }),
    ];
    expect(printouts(log)).toEqual({
      count: 2,
      last: { id: "w4", name: "b.ts", at: 4_000 },
    });
  });

  it("skips other events and writes without a path", () => {
    const log = [
      {
        id: "p",
        type: "pre_tool_use",
        timestamp: new Date(5_000),
        detail: { fileCreated: true, toolInput: { file_path: "/x.ts" } },
      },
      write("w", "", 4_000),
    ];
    expect(printouts(log)).toEqual({ count: 0, last: null });
  });
});

describe("isFreshPrintout", () => {
  const last = { id: "w", name: "a.ts", at: 10_000 };

  it("prints a new file written just now, once", () => {
    expect(isFreshPrintout(last, null, 10_500)).toBe(true);
    expect(isFreshPrintout(last, "w", 10_500)).toBe(false);
    expect(isFreshPrintout(null, null, 10_500)).toBe(false);
  });

  it("does not print a file written more than a minute ago", () => {
    expect(isFreshPrintout(last, null, 10_000 + FRESH_MS + 1)).toBe(false);
  });
});

describe("printProgress", () => {
  it("runs from 0 to 1 over the print", () => {
    expect(printProgress(1_000, 500)).toBe(0);
    expect(printProgress(1_000, 1_000 + PRINT_MS / 2)).toBeCloseTo(0.5);
    expect(printProgress(1_000, 1_000 + PRINT_MS * 2)).toBe(1);
  });
});
