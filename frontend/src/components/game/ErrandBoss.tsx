/**
 * ErrandBoss Component
 *
 * The boss away from the desk on an errand (systems/bossErrands.ts):
 * - walking: hops along the path
 * - reading: holds an open book in the archive, turning pages
 * - operating: faces the server rack (back to the viewer, so no face or
 *   hands), swaying slightly while the rack console scrolls (OfficeRooms)
 * - pondering: stands still, chin in hand, thinking dots (stuck or thinking
 *   long, docs/plan/spec.md R3)
 */

"use client";

import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTick } from "@pixi/react";
import { Graphics, Texture } from "pixi.js";
import type { Position } from "@/types";
import {
  BOSS_HEIGHT,
  BOSS_WIDTH,
  PONDER_CHIN_Y,
  STROKE_WIDTH,
  drawBossBody,
} from "./BossSprite";
import { drawLeftArm, drawRightArm } from "./shared/drawArm";
import { drawThinkingDots } from "./shared/drawThinkingDots";

// ============================================================================
// TYPES
// ============================================================================

export type ErrandPose = "walking" | "reading" | "operating" | "pondering";

export interface ErrandBossProps {
  position: Position;
  pose: ErrandPose;
  sunglassesTexture: Texture | null;
  headsetTexture: Texture | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HOP_HEIGHT = 3;
const HOP_SPEED = 0.012; // radians per ms
const PAGE_TURN_MS = 1400;
const TYPING_SWAY_SPEED = 0.018; // radians per ms
const ARM_COLOR = 0x1f2937;
const BODY_HALF_WIDTH = (BOSS_WIDTH - STROKE_WIDTH) / 2;

// ============================================================================
// DRAWING
// ============================================================================

/** Open book held at chest height; `turn` (0..1) sweeps a page across */
function drawOpenBook(g: Graphics, turn: number): void {
  g.clear();
  // Cover
  g.roundRect(-23, 0, 46, 28, 3);
  g.fill(0x7c2d12);
  g.roundRect(-23, 0, 46, 28, 3);
  g.stroke({ width: 1, color: 0x431407 });
  // Pages
  g.rect(-21, 2, 20, 23);
  g.fill(0xfef9e7);
  g.rect(1, 2, 20, 23);
  g.fill(0xfdf6dc);
  // Spine
  g.rect(-1, 1, 2, 25);
  g.fill(0x431407);
  // Text lines
  for (let i = 0; i < 4; i++) {
    g.rect(-18, 6 + i * 4, i % 2 === 0 ? 14 : 11, 1);
    g.fill(0x475569);
    g.rect(4, 6 + i * 4, i % 2 === 0 ? 14 : 10, 1);
    g.fill(0x475569);
  }
  // Turning page: narrows toward the spine, then opens on the left
  if (turn > 0) {
    const width = 20 * Math.abs(Math.cos(turn * Math.PI));
    const x = turn < 0.5 ? 1 : -1 - width;
    g.rect(x, 2, width, 23);
    g.fill(0xffffff);
    g.stroke({ width: 1, color: 0xd6d3d1 });
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

function ErrandBossComponent({
  position,
  pose,
  sunglassesTexture,
  headsetTexture,
}: ErrandBossProps): ReactNode {
  const [time, setTime] = useState(0);
  const timeRef = useRef(0);

  useTick((ticker) => {
    timeRef.current += ticker.deltaMS;
    setTime(timeRef.current);
  });

  const hop =
    pose === "walking" ? -Math.abs(Math.sin(time * HOP_SPEED)) * HOP_HEIGHT : 0;
  const pageTurn =
    pose === "reading"
      ? Math.max(0, ((time % PAGE_TURN_MS) - (PAGE_TURN_MS - 400)) / 400)
      : 0;
  const sway =
    pose === "operating" ? Math.sin(time * TYPING_SWAY_SPEED) * 1.5 : 0;

  const drawBody = useMemo(
    () => (g: Graphics) => drawBossBody(g, "working"),
    [],
  );

  // Hands hold the bottom corners of the book
  const armParams = useMemo(
    () => ({
      bodyHalfWidth: BODY_HALF_WIDTH,
      startY: 0,
      endY: 24,
      handColor: ARM_COLOR,
    }),
    [],
  );
  const drawRight = useCallback(
    (g: Graphics) => drawRightArm(g, armParams),
    [armParams],
  );
  const drawLeft = useCallback(
    (g: Graphics) => drawLeftArm(g, armParams),
    [armParams],
  );
  const drawBook = useCallback(
    (g: Graphics) => drawOpenBook(g, pageTurn),
    [pageTurn],
  );

  // Pondering: right hand under the chin, left hand resting at the waist
  const drawPonderRight = useCallback(
    (g: Graphics) => drawRightArm(g, { ...armParams, endY: PONDER_CHIN_Y }),
    [armParams],
  );
  const drawPonderLeft = useCallback(
    (g: Graphics) => drawLeftArm(g, { ...armParams, endY: 20 }),
    [armParams],
  );
  const drawDots = useCallback(
    (g: Graphics) => drawThinkingDots(g, time, -(BOSS_HEIGHT / 2)),
    [time],
  );

  // From the back (operating) neither the face nor the hands are visible
  const showFace = pose !== "operating";

  return (
    <pixiContainer x={position.x + sway} y={position.y + hop}>
      <pixiGraphics draw={drawBody} />

      {/* Sunglasses only from the front (operating shows the boss's back) */}
      {showFace && sunglassesTexture && (
        <pixiSprite
          texture={sunglassesTexture}
          anchor={0.5}
          x={0}
          y={-19}
          scale={{ x: 0.036, y: 0.04 }}
          tint={0x000000}
        />
      )}

      {headsetTexture && (
        <pixiSprite
          texture={headsetTexture}
          anchor={0.5}
          x={0}
          y={-20}
          scale={{ x: 0.66825, y: 0.675 }}
        />
      )}

      {pose === "reading" && (
        <>
          <pixiGraphics draw={drawBook} />
          <pixiGraphics draw={drawRight} />
          <pixiGraphics draw={drawLeft} />
        </>
      )}

      {pose === "pondering" && (
        <>
          <pixiGraphics draw={drawPonderRight} />
          <pixiGraphics draw={drawPonderLeft} />
          <pixiGraphics draw={drawDots} />
        </>
      )}

      {/* Boss label */}
      <pixiContainer y={-63} scale={0.5}>
        <pixiText
          text="Claude"
          anchor={0.5}
          style={{
            fontFamily: "monospace",
            fontSize: 24,
            fill: 0xffffff,
            fontWeight: "bold",
            stroke: { width: 4, color: 0x000000 },
          }}
          resolution={2}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

export const ErrandBoss = memo(ErrandBossComponent);
