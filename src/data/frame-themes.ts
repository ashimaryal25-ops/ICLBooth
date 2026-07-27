// The frame-theme data lives in ./frame-themes.json — the photo windows are the
// transparent regions of each frame PNG, measured once and recorded here.
// This file is the hand-written loader + types that the app actually imports.

import frameThemes from "./frame-themes.json";

export type FrameSlot = { x: number; y: number; w: number; h: number };

/** Fully transparent rows/cols at each edge of the artwork; the renderer
 *  clamps the art outward into them so they don't print as white slivers. */
export type FrameBleed = { top: number; bottom: number; left: number; right: number };

export type FrameTheme = {
  key: string;
  label: string;
  photoCount: number;
  single: { src: string; w: number; h: number; slots: FrameSlot[]; bleed: FrameBleed };
};

export const FRAME_THEMES: FrameTheme[] = frameThemes;

export function framesForCount(count: number): FrameTheme[] {
  return FRAME_THEMES.filter((t) => t.photoCount === count);
}

export function findFrame(key: string, count: number): FrameTheme | undefined {
  return FRAME_THEMES.find((t) => t.key === key && t.photoCount === count);
}
