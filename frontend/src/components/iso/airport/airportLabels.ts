/**
 * The airport's labels, laid over the scene as HTML so the text stays
 * sharp: a dark data block like a radar's for every plane (its flight
 * number and task, and a line for what it is doing), the same for the
 * tower and the gate, the radio strip under the tower and the hearts that
 * rise when I say thanks. Text goes in through textContent only.
 */

import type { TalkLine } from "@/systems/airportTalk";

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
  work: "text-emerald-300",
  think: "text-sky-300",
  say: "text-slate-100",
  alert: "text-red-300",
};

export interface DataTag {
  element: HTMLDivElement;
  code: HTMLSpanElement;
  title: HTMLSpanElement;
  line: HTMLDivElement;
  /** What the line shows now, to redraw it only when that changes. */
  lineKey: string;
}

/** A data block with a colour mark, a code (TWR, EX 204) and a title. */
export function dataTag(color: string): DataTag {
  const element = el(
    "div",
    "pointer-events-none flex max-w-[240px] flex-col gap-0.5 rounded-md border border-slate-600/60 bg-slate-900/85 px-2 py-1 text-[11px] leading-4 text-slate-100 shadow-md",
  );
  const head = el("div", "flex min-w-0 items-center gap-1.5 whitespace-nowrap");
  const mark = el("span", "h-2 w-2 shrink-0 rounded-sm");
  mark.style.backgroundColor = color;
  const code = el("span", "shrink-0 font-mono font-bold text-amber-300");
  const title = el("span", "truncate font-semibold");
  head.append(mark, code, title);
  const line = el("div", "flex min-w-0 items-center gap-1 whitespace-nowrap");
  line.hidden = true;
  element.append(head, line);
  return { element, code, title, line, lineKey: "" };
}

/** Put a code and title on a tag. */
export function nameTag(tag: DataTag, code: string, title: string): void {
  if (tag.code.textContent !== code) tag.code.textContent = code;
  if (tag.title.textContent !== title) tag.title.textContent = title;
}

/** Draw a tag's second line, only when it changed; null hides it. */
export function drawLine(tag: DataTag, line: TalkLine | null): void {
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
    el("span", `shrink-0 font-semibold ${TONES[line.tone]}`, line.text),
  );
  if (line.detail) {
    tag.line.append(
      el("span", "truncate font-mono text-slate-300", line.detail),
    );
  }
}

/** The radio strip under the tower: what the controller last said to a plane. */
export function radioStrip(): {
  element: HTMLDivElement;
  text: HTMLSpanElement;
} {
  const element = el(
    "div",
    "pointer-events-none flex max-w-[240px] items-center gap-1 whitespace-nowrap rounded-full bg-amber-300/95 px-2.5 py-1 text-[11px] font-semibold leading-4 text-slate-900 shadow-md",
  );
  const text = el("span", "truncate");
  element.append(el("span", "shrink-0", "📻"), text);
  return { element, text };
}

/** A heart that rises and fades over a figure. */
export function heart(): HTMLSpanElement {
  return el(
    "span",
    "pointer-events-none select-none text-[18px] leading-none",
    "💗",
  );
}
