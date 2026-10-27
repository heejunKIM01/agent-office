/**
 * Bubbles over the people of the isometric office, drawn as HTML so the text
 * stays sharp (see systems/officeBubbles.ts for which one shows). Text from
 * the session goes in through textContent only. The office pets snore in
 * the same bubble a person dozing on the sofa does.
 */

import type * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { IsoBubble } from "@/systems/officeBubbles";

/** Words the bubbles need, already translated. */
export interface BubbleWords {
  /** 「고민 중」 */
  thinking: string;
  /** 「Ns째 고민 중」 */
  thinkingFor: (seconds: number) => string;
  /** 「살펴보는 중」 under a tool's target. */
  looking: string;
  /** 「👋 퇴근합니다!」 as a finished subagent heads home. */
  bye: string;
  /** 「☕ 대화 정리 중」 over coffee while the conversation is compacted. */
  compacting: string;
}

/** Room left under a bubble for the name chip (px). */
const ABOVE_CHIP = "pb-[30px]";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A bubble with words in it: thought, said or gone wrong. */
type SaidBubble = Extract<IsoBubble, { kind: "thought" | "speech" | "failed" }>;

/** Asleep, a person on the sofa or a pet snores. */
export const SNORE: SaidBubble = { kind: "speech", text: "💤" };

/** The empty holder a bubble is drawn into, with room under it for a name chip or not. */
export function bubbleHolder(overChip = true): HTMLDivElement {
  return el(
    "div",
    `pointer-events-none flex flex-col items-center ${overChip ? ABOVE_CHIP : ""}`,
  );
}

/** A key that changes whenever the bubble needs drawing again. */
export function bubbleKey(bubble: IsoBubble | null): string {
  if (!bubble) return "";
  switch (bubble.kind) {
    case "thinking":
      return `thinking:${bubble.seconds}`;
    case "tool":
      return `tool:${bubble.icon}:${bubble.text}:${bubble.asking}`;
    default:
      return `${bubble.kind}:${bubble.text}`;
  }
}

/** Draw a bubble into its holder, replacing what was there. */
export function drawBubble(
  holder: HTMLElement,
  bubble: IsoBubble | null,
  words: BubbleWords,
): void {
  holder.replaceChildren();
  if (!bubble) return;
  if (bubble.kind === "thinking") {
    const box = el(
      "div",
      "rounded-2xl border border-violet-200 bg-white/95 px-2.5 py-1 text-center shadow-sm dark:border-violet-400/40 dark:bg-slate-900/95",
    );
    const head = el(
      "div",
      "whitespace-nowrap text-[11px] font-semibold text-slate-700 dark:text-slate-200",
    );
    head.append(
      `💭 ${words.thinking} `,
      el("span", "animate-pulse text-violet-500 dark:text-violet-300", "· · ·"),
    );
    box.append(
      head,
      el(
        "div",
        "whitespace-nowrap text-[10px] text-violet-500 dark:text-violet-300",
        words.thinkingFor(bubble.seconds),
      ),
    );
    holder.append(box);
    return;
  }
  if (bubble.kind === "tool") {
    const box = el(
      "div",
      "flex max-w-[240px] items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/95",
    );
    const lines = el("div", "min-w-0");
    lines.append(
      el(
        "div",
        "truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100",
        bubble.text,
      ),
    );
    if (!bubble.asking)
      lines.append(
        el(
          "div",
          "text-[10px] text-slate-400 dark:text-slate-500",
          words.looking,
        ),
      );
    box.append(el("span", "text-[15px] leading-none", bubble.icon), lines);
    holder.append(box);
    return;
  }
  drawSaid(holder, bubble);
}

/** Something thought, said or gone wrong, in a rounded box with a tail. */
function drawSaid(holder: HTMLElement, bubble: SaidBubble): void {
  const styles: Record<"thought" | "speech" | "failed", string> = {
    thought:
      "border-violet-200 bg-violet-50/95 text-slate-700 dark:border-violet-400/40 dark:bg-[#231d3a] dark:text-violet-100",
    speech:
      "border-slate-200 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
    failed:
      "border-red-300 bg-red-50 text-red-600 dark:border-red-400/50 dark:bg-[#3a1a1f] dark:text-red-300",
  };
  const prefix = { thought: "💭 ", speech: "", failed: "❗ " }[bubble.kind];
  const box = el(
    "div",
    `line-clamp-3 max-w-[260px] rounded-2xl border px-3 py-2 text-[12px] font-medium leading-snug shadow-md ${styles[bubble.kind]}`,
    `${prefix}${bubble.text.replace(/^❗\s*/, "")}`,
  );
  // A little tail pointing down at the speaker.
  const tail = el(
    "div",
    `-mt-[5px] h-2.5 w-2.5 rotate-45 border-b border-r ${styles[bubble.kind]}`,
  );
  holder.append(box, tail);
}

/**
 * A pet's snore: 「💤」 ``height`` up off ``parent`` (just over its head, in
 * its own space) while it sleeps. It has no name chip under it. Call the
 * returned function each frame with whether it sleeps.
 */
export function petSnore(
  parent: THREE.Object3D,
  height: number,
): (asleep: boolean) => void {
  const holder = bubbleHolder(false);
  const label = new CSS2DObject(holder);
  label.center.set(0.5, 1);
  label.position.y = height;
  parent.add(label);
  let shown = false;
  return (asleep) => {
    if (asleep === shown) return;
    shown = asleep;
    holder.replaceChildren();
    if (asleep) drawSaid(holder, SNORE);
  };
}
