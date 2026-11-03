import { describe, expect, it } from "vitest";
import {
  faceToward,
  isRiskyCommand,
  latestAlarm,
} from "../src/systems/officeAlarm";

describe("isRiskyCommand", () => {
  it("is a forced push, a hard reset or a forced recursive remove", () => {
    expect(
      [
        "git push --force",
        "git push -f origin main",
        "git push --force-with-lease origin feat/x",
        "git -C repo push -uf origin main",
        "git reset --hard origin/main",
        "rm -rf node_modules",
        "rm -fr dist",
        "sudo rm -r -f /tmp/x",
        "rm --recursive --force build",
        "npm test && rm -rf .next",
      ].map(isRiskyCommand),
    ).toEqual(Array(10).fill(true));
  });

  it("is not a plain push, a soft reset, a plain remove or words in a message", () => {
    expect(
      [
        "git push origin main",
        "git push -u origin feat/x",
        "git reset --soft HEAD~1",
        "git reset HEAD file.ts",
        "rm -r old",
        "rm -f a.txt",
        'git commit -m "stop using rm -rf in scripts"',
        "git commit -F - <<'EOF'\nfix: no more git push --force\nEOF",
        "echo 'git reset --hard'",
        undefined,
      ].map(isRiskyCommand),
    ).toEqual(Array(10).fill(false));
  });
});

describe("latestAlarm", () => {
  const pre = (id: string, command: string, at: number) => ({
    id,
    type: "pre_tool_use",
    timestamp: new Date(at),
    detail: { toolInput: { command } },
  });

  it("takes the newest risky command Claude started", () => {
    const log = [
      pre("c", "ls", 3000),
      pre("b", "git reset --hard", 2000),
      pre("a", "rm -rf dist", 1000),
    ];
    expect(latestAlarm(log)).toEqual({ id: "b", at: 2000 });
  });

  it("is null without one", () => {
    expect(latestAlarm([pre("a", "git push", 1000)])).toBeNull();
  });
});

describe("faceToward", () => {
  it("turns someone to face a point", () => {
    expect(faceToward({ x: 0, z: 0 }, { x: 0, z: 5 })).toBeCloseTo(0);
    expect(faceToward({ x: 0, z: 0 }, { x: 5, z: 0 })).toBeCloseTo(Math.PI / 2);
    expect(Math.abs(faceToward({ x: 0, z: 5 }, { x: 0, z: 0 }))).toBeCloseTo(
      Math.PI,
    );
  });
});
