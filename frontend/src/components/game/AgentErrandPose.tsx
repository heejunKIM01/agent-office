/**
 * AgentErrandPose Component
 *
 * Hands (and props) of an agent standing in a side room on an errand
 * (systems/agentErrands.ts), drawn over its AgentSprite:
 * - reading: an open book held in both hands, turning pages
 * - pondering: chin in hand with thinking dots (stuck at the spot)
 * At a server rack the agent shows its back (AgentSprite `facingAway`), so
 * there is nothing to draw on top.
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
import { Graphics } from "pixi.js";
import type { Position } from "@/types";
import {
  AGENT_HEAD_TOP_Y,
  AGENT_PONDER_CHIN_Y,
  AGENT_WIDTH,
  STROKE_WIDTH,
} from "./AgentSprite";
import { PAGE_TURN_MS } from "./ErrandBoss";
import { drawLeftArm, drawRightArm } from "./shared/drawArm";
import { drawOpenBook } from "./shared/drawOpenBook";
import { drawThinkingDots } from "./shared/drawThinkingDots";

export type AgentErrandPoseKind = "reading" | "pondering";

export interface AgentErrandPoseProps {
  position: Position;
  pose: AgentErrandPoseKind;
}

// Agent body center sits 18px above its position; the book is held at chest
// height and the hands grip its bottom corners.
const BOOK_TOP_Y = -22;
const BOOK_HANDS_Y = BOOK_TOP_Y + 24;
const SHOULDER_Y = -16;

function AgentErrandPoseComponent({
  position,
  pose,
}: AgentErrandPoseProps): ReactNode {
  const [time, setTime] = useState(0);
  const timeRef = useRef(0);

  useTick((ticker) => {
    timeRef.current += ticker.deltaMS;
    setTime(timeRef.current);
  });

  const pageTurn =
    pose === "reading"
      ? Math.max(0, ((time % PAGE_TURN_MS) - (PAGE_TURN_MS - 400)) / 400)
      : 0;

  const armParams = useMemo(
    () => ({
      bodyHalfWidth: (AGENT_WIDTH - STROKE_WIDTH) / 2,
      startY: SHOULDER_Y,
      handColor: 0x1f2937,
    }),
    [],
  );

  const drawRight = useCallback(
    (g: Graphics) =>
      drawRightArm(g, {
        ...armParams,
        endY: pose === "reading" ? BOOK_HANDS_Y : AGENT_PONDER_CHIN_Y,
      }),
    [armParams, pose],
  );
  const drawLeft = useCallback(
    (g: Graphics) =>
      drawLeftArm(g, {
        ...armParams,
        endY: pose === "reading" ? BOOK_HANDS_Y : 4,
      }),
    [armParams, pose],
  );
  const drawBook = useCallback(
    (g: Graphics) => drawOpenBook(g, pageTurn),
    [pageTurn],
  );
  const drawDots = useCallback(
    (g: Graphics) => drawThinkingDots(g, time, AGENT_HEAD_TOP_Y),
    [time],
  );

  return (
    <pixiContainer x={position.x} y={position.y}>
      {pose === "reading" && (
        <pixiContainer y={BOOK_TOP_Y}>
          <pixiGraphics draw={drawBook} />
        </pixiContainer>
      )}
      <pixiGraphics draw={drawRight} />
      <pixiGraphics draw={drawLeft} />
      {pose === "pondering" && <pixiGraphics draw={drawDots} />}
    </pixiContainer>
  );
}

export const AgentErrandPose = memo(AgentErrandPoseComponent);
