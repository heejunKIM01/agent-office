/**
 * Bubbles over the people of the isometric office, drawn as HTML so the text
 * stays sharp (see systems/officeBubbles.ts for which one shows). Text from
 * the session goes in through textContent only.
 */

import type { IsoBubble } from "@/systems/officeBubbles";

/** Words the bubbles need, already translated. */
export interface BubbleWords {
  /** 「고민 중」 */
  thinking: string;
  /** 「Ns째 고민 중」 */
  thinkingFor: (seconds: number) => string;
  /** 「살펴보는 중」 under a tool's target. */
  looking: string;
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

/** The empty holder a person's bubble is drawn into. */
export function bubbleHolder(): HTMLDivElement {
  return el(
    "div",
    `pointer-events-none flex flex-col items-center ${ABOVE_CHIP}`,
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
      "rounded-2xl border border-violet-200 bg-white/95 px-2.5 py-1 text-center shadow-sm",
    );
    const head = el(
      "div",
      "whitespace-nowrap text-[11px] font-semibold text-slate-700",
    );
    head.append(
      `💭 ${words.thinking} `,
      el("span", "animate-pulse text-violet-500", "· · ·"),
    );
    box.append(
      head,
      el(
        "div",
        "whitespace-nowrap text-[10px] text-violet-500",
        words.thinkingFor(bubble.seconds),
      ),
    );
    holder.append(box);
    return;
  }
  if (bubble.kind === "tool") {
    const box = el(
      "div",
      "flex max-w-[240px] items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-1.5 shadow-sm",
    );
    const lines = el("div", "min-w-0");
    lines.append(
      el(
        "div",
        "truncate text-[12px] font-semibold text-slate-800",
        bubble.text,
      ),
    );
    if (!bubble.asking)
      lines.append(el("div", "text-[10px] text-slate-400", words.looking));
    box.append(el("span", "text-[15px] leading-none", bubble.icon), lines);
    holder.append(box);
    return;
  }
  const styles: Record<"thought" | "speech" | "failed", string> = {
    thought: "border-violet-200 bg-violet-50/95 text-slate-700",
    speech: "border-slate-200 bg-white text-slate-800",
    failed: "border-red-300 bg-red-50 text-red-600",
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
