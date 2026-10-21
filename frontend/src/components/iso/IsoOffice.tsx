"use client";

import { useEffect, useRef } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { createIsoView, type IsoView } from "./isoView";

const ZOOM_STEP = 1.25;
/** `next dev` puts its indicator in the bottom-left corner; keep the buttons above it. */
const CONTROLS_BOTTOM =
  process.env.NODE_ENV === "development" ? "bottom-16" : "bottom-4";

/**
 * The isometric office scene with its zoom buttons and control hint
 * (drag to pan, scroll to zoom, double-click to reset).
 */
export function IsoOffice(): React.ReactNode {
  const { t } = useTranslation();
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<IsoView | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const view = createIsoView(mount);
    viewRef.current = view;
    return () => {
      view.dispose();
      viewRef.current = null;
    };
  }, []);

  const buttonClass =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400";

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="absolute inset-0" />
      <div
        className={`absolute left-4 flex flex-col gap-1.5 ${CONTROLS_BOTTOM}`}
      >
        <button
          type="button"
          className={buttonClass}
          aria-label={t("zoom.in")}
          onClick={() => viewRef.current?.zoomBy(ZOOM_STEP)}
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          className={buttonClass}
          aria-label={t("zoom.out")}
          onClick={() => viewRef.current?.zoomBy(1 / ZOOM_STEP)}
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          className={buttonClass}
          aria-label={t("zoom.reset")}
          onClick={() => viewRef.current?.resetView()}
        >
          <RotateCcw size={13} />
        </button>
      </div>
      <p className="pointer-events-none absolute bottom-3 right-4 text-[11px] text-slate-400">
        {t("iso.controlsHint")}
      </p>
    </div>
  );
}
