"use client";

// Drag, pinch, and palette-drag handling for the Decorate view.

import { useRef } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from "react";
import {
  EMOJI_STICKER_SIZE,
  STRIP_H,
  STRIP_W,
} from "@/lib/photo-collage/constants";
import type { PaletteDrag, Sticker } from "@/lib/photo-collage/types";

type GestureInputs = {
  decorCanvasRef: RefObject<HTMLCanvasElement | null>;
  setStickers: Dispatch<SetStateAction<Sticker[]>>;
  setPaletteDrag: Dispatch<SetStateAction<PaletteDrag | null>>;
};

export function useStickerGestures({
  decorCanvasRef,
  setStickers,
  setPaletteDrag,
}: GestureInputs) {
  // Per-gesture scratch state: which pointers are down, plus the active pinch /
  // drag / palette-drag.
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ id: number; startDist: number; startSize: number } | null>(null);
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const paletteDragRef = useRef<PaletteDrag | null>(null);

  const canvasCoords = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) / box.width) * STRIP_W,
      y: ((e.clientY - box.top) / box.height) * STRIP_H,
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = canvasCoords(e);
    activePointersRef.current.set(e.pointerId, p);

    if (activePointersRef.current.size === 1) {
      setStickers((live) => {
        for (let i = live.length - 1; i >= 0; i--) {
          const s = live[i];
          if (Math.hypot(p.x - s.x, p.y - s.y) < s.size / 1.2) {
            dragRef.current = { id: s.id, dx: p.x - s.x, dy: p.y - s.y };
            e.currentTarget.setPointerCapture(e.pointerId);
            break;
          }
        }
        return live;
      });
    } else if (activePointersRef.current.size === 2 && dragRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setStickers((live) => {
        const activeSticker = live.find((s) => s.id === dragRef.current!.id);
        if (activeSticker) {
          pinchRef.current = { id: activeSticker.id, startDist: dist, startSize: activeSticker.size };
        }
        return live;
      });
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = canvasCoords(e);
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, p);
    }

    if (activePointersRef.current.size >= 2 && pinchRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setStickers((previous) =>
        previous.map((s) =>
          s.id === pinchRef.current!.id
            ? {
                ...s,
                size: Math.max(
                  20,
                  Math.min(600, pinchRef.current!.startSize * (dist / pinchRef.current!.startDist)),
                ),
              }
            : s,
        ),
      );
    } else if (activePointersRef.current.size === 1 && dragRef.current) {
      setStickers((previous) =>
        previous.map((s) =>
          s.id === dragRef.current!.id
            ? { ...s, x: p.x - dragRef.current!.dx, y: p.y - dragRef.current!.dy }
            : s,
        ),
      );
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    if (activePointersRef.current.size === 0) {
      dragRef.current = null;
    }
  };

  const startPaletteDrag = (emoji: string, e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const nextDrag = { emoji, x: e.clientX, y: e.clientY };
    paletteDragRef.current = nextDrag;
    setPaletteDrag(nextDrag);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const movePaletteDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!paletteDragRef.current) return;
    const nextDrag = {
      ...paletteDragRef.current,
      x: e.clientX,
      y: e.clientY,
    };
    paletteDragRef.current = nextDrag;
    setPaletteDrag(nextDrag);
  };

  const finishPaletteDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const activeDrag = paletteDragRef.current;
    paletteDragRef.current = null;
    setPaletteDrag(null);

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!activeDrag || !decorCanvasRef.current) return;

    const box = decorCanvasRef.current.getBoundingClientRect();
    const droppedOnStrip =
      e.clientX >= box.left &&
      e.clientX <= box.right &&
      e.clientY >= box.top &&
      e.clientY <= box.bottom;

    if (!droppedOnStrip) return;

    const size = EMOJI_STICKER_SIZE;
    const x = ((e.clientX - box.left) / box.width) * STRIP_W;
    const y = ((e.clientY - box.top) / box.height) * STRIP_H;
    setStickers((previous) => [
      ...previous,
      {
        id: Date.now() + Math.random(),
        emoji: activeDrag.emoji,
        x: Math.min(STRIP_W - size / 2, Math.max(size / 2, x)),
        y: Math.min(STRIP_H - size / 2, Math.max(size / 2, y)),
        size,
      },
    ]);
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    startPaletteDrag,
    movePaletteDrag,
    finishPaletteDrag,
  };
}
