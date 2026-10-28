/**
 * The fishing pier's labels, laid over the scene as HTML so the text
 * stays sharp: a tag painted like a float for every person (orange on top
 * with a code and name, white below with what it is doing) and the catch
 * count over the fish tank. Text goes in through textContent only.
 */

import type { TalkLine } from "@/systems/placeTalk";

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

const TONES: Record<TalkLine["tone"], string> = {
  work: "text-slate-900",
  think: "text-sky-800",
  say: "text-slate-800",
  alert: "text-red-700",
};

export interface FishingTag {
  element: HTMLDivElement;
  code: HTMLSpanElement;
  title: HTMLSpanElement;
  line: HTMLDivElement;
  /** What the line shows now, to redraw it only when that changes. */
  lineKey: string;
}

/** A tag with a crew colour mark, a code (선장, B-204) and a title. */
export function fishingTag(color: string): FishingTag {
  const element = el(
    "div",
    "pointer-events-none flex max-w-[240px] flex-col overflow-hidden rounded-md border-2 border-slate-900 bg-white text-[11px] leading-4 text-slate-900 shadow-md",
  );
  const head = el(
    "div",
    "flex min-w-0 items-center gap-1.5 whitespace-nowrap bg-orange-500 px-2 py-0.5 text-white",
  );
  const mark = el(
    "span",
    "h-2.5 w-2.5 shrink-0 rounded-full border border-white",
  );
  mark.style.backgroundColor = color;
  const code = el("span", "shrink-0 font-mono font-extrabold");
  const title = el("span", "truncate font-semibold");
  head.append(mark, code, title);
  const line = el(
    "div",
    "flex min-w-0 items-center gap-1 whitespace-nowrap px-2 py-0.5",
  );
  line.hidden = true;
  element.append(head, line);
  return { element, code, title, line, lineKey: "" };
}

/** Put a code and title on a tag. */
export function nameFishingTag(
  tag: FishingTag,
  code: string,
  title: string,
): void {
  if (tag.code.textContent !== code) tag.code.textContent = code;
  if (tag.title.textContent !== title) tag.title.textContent = title;
}

/** Draw a tag's second line, only when it changed; null hides it. */
export function drawFishingLine(tag: FishingTag, line: TalkLine | null): void {
  const key = line
    ? `${line.tone}|${line.icon}|${line.text}|${line.detail}`
    : "";
  if (key === tag.lineKey) return;
  tag.lineKey = key;
  tag.line.replaceChildren();
  tag.line.hidden = line === null;
  if (!line) return;
  tag.line.append(
    el("span", "shrink-0", line.icon),
    el("span", `shrink-0 font-bold ${TONES[line.tone]}`, line.text),
  );
  if (line.detail) {
    tag.line.append(
      el("span", "truncate font-mono text-slate-600", line.detail),
    );
  }
}

/** The catch count over the fish tank. */
export function catchSign(): {
  element: HTMLDivElement;
  text: HTMLSpanElement;
} {
  const element = el(
    "div",
    "pointer-events-none flex items-center gap-1 whitespace-nowrap rounded-md border-2 border-orange-400 bg-slate-900/90 px-2 py-0.5 text-[13px] font-extrabold leading-5 text-orange-300 shadow-md",
  );
  const text = el("span", "font-mono");
  element.append(el("span", "", "🐟"), text);
  return { element, text };
}
