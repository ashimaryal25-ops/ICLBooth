"use client";

// Drag, pinch, and palette-drag handling for the Decorate view: pointer input
// updates the sticker refs and triggers one repaint. See the pinch note on
// onPointerMove and the guarded release on onPointerUp for the crash fixes.

import { useRef } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from "react";
import {
  EMOJI_STICKER_SIZE,
  IMAGE_STICKER_SIZE,
  STRIP_H,
  STRIP_W,
} from "@/lib/photo-collage/constants";
import type { PaletteDrag, Sticker } from "@/lib/photo-collage/types";

type GestureInputs = {
  decorCanvasRef: RefObject<HTMLCanvasElement | null>;
  scheduleComposite: () => void;
  setStickers: Dispatch<SetStateAction<Sticker[]>>;
  setPaletteDrag: Dispatch<SetStateAction<PaletteDrag | null>>;
  stickersRef: RefObject<Sticker[]>;
  gestureDirtyRef: RefObject<boolean>;
};

export function useStickerGestures({
  decorCanvasRef,
  scheduleComposite,
  setStickers,
  setPaletteDrag,
  stickersRef,
  gestureDirtyRef,
}: GestureInputs) {
  // Per-gesture scratch state: which pointers are down, plus the active pinch /
  // drag / palette-drag. Sticker edits go to stickersRef (see onPointerMove).
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

  /** Capture is best-effort: a pointer can already be gone (or synthetic). */
  const capturePointer = (el: HTMLElement, pointerId: number) => {
    try {
      el.setPointerCapture(pointerId);
    } catch {}
  };

  const releasePointer = (el: HTMLElement, pointerId: number) => {
    try {
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    } catch {}
  };

  /** Apply a gesture edit to the live list and queue one repaint. */
  const updateActiveSticker = (id: number, patch: Partial<Sticker>) => {
    stickersRef.current = stickersRef.current.map((s) =>
      s.id === id ? { ...s, ...patch } : s,
    );
    gestureDirtyRef.current = true;
    scheduleComposite();
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = canvasCoords(e);
    activePointersRef.current.set(e.pointerId, p);
    const live = stickersRef.current;

    if (activePointersRef.current.size === 1) {
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i];
        if (Math.hypot(p.x - s.x, p.y - s.y) < s.size / 1.2) {
          dragRef.current = { id: s.id, dx: p.x - s.x, dy: p.y - s.y };
          capturePointer(e.currentTarget, e.pointerId);
          break;
        }
      }
    } else if (activePointersRef.current.size === 2 && dragRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const activeSticker = live.find((s) => s.id === dragRef.current!.id);
      // A zero start distance would scale by Infinity/NaN on the first move.
      if (activeSticker && dist > 0) {
        pinchRef.current = { id: activeSticker.id, startDist: dist, startSize: activeSticker.size };
        // Capture the second finger too, so sliding it past the canvas edge
        // mid-pinch doesn't fire pointerout and silently cancel the zoom.
        capturePointer(e.currentTarget, e.pointerId);
      }
    }
  };

  // During a gesture we edit stickersRef and repaint from it. setStickers is
  // called just once, on pointer up.
  //
  // Doing setStickers on every move used to crash the booth on pinch. The catch:
  // setStickers(prev => ...) doesn't run right away — React runs that function
  // on the next render. But pointer up already set pinchRef.current = null, so
  // when React ran the leftover updater it read `.id` off null and threw. A
  // throw during render drops the app to Next's "This page couldn't load"
  // screen — that was the guest crash, not a GPU/browser problem. A ref has no
  // such lag: we read its value now, not on some later render.
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = canvasCoords(e);
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, p);
    }

    if (activePointersRef.current.size >= 2 && pinchRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const newSize = Math.max(
        20,
        Math.min(600, pinchRef.current.startSize * (dist / pinchRef.current.startDist)),
      );
      if (Number.isFinite(newSize)) {
        updateActiveSticker(pinchRef.current.id, { size: newSize });
      }
    } else if (activePointersRef.current.size === 1 && dragRef.current) {
      updateActiveSticker(dragRef.current.id, {
        x: p.x - dragRef.current.dx,
        y: p.y - dragRef.current.dy,
      });
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    // Guarded release: only the finger that grabbed the sticker was captured, so
    // the old unconditional releasePointerCapture threw NotFoundError when the
    // *second* finger of a pinch was the last one lifted — a second route to the
    // same crash screen.
    releasePointer(e.currentTarget, e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    if (activePointersRef.current.size === 0) {
      dragRef.current = null;
      // Publish the gesture result once it is over, so print/export and the rest
      // of the UI see the final position and size.
      if (gestureDirtyRef.current) {
        gestureDirtyRef.current = false;
        setStickers(stickersRef.current);
      }
    }
  };

  const startPaletteDrag = (
    emoji: string,
    src: string | undefined,
    e: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    const nextDrag = { emoji, src, x: e.clientX, y: e.clientY };
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

    const size = activeDrag.src ? IMAGE_STICKER_SIZE : EMOJI_STICKER_SIZE;
    const x = ((e.clientX - box.left) / box.width) * STRIP_W;
    const y = ((e.clientY - box.top) / box.height) * STRIP_H;
    setStickers((previous) => [
      ...previous,
      {
        id: Date.now() + Math.random(),
        emoji: activeDrag.emoji,
        src: activeDrag.src,
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
