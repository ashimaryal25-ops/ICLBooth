// Canvas helpers for the photo-strip flow: filters and layout maths, shared by
// the on-screen strip and the capture preview.

import type { FilterName } from "./types";
import {
  STRIP_FOOTER_H,
  STRIP_GAP,
  STRIP_H,
  STRIP_TOP_MARGIN,
} from "./constants";

/** Photo height for a given slot count under the shared layout band. */
export function slotPhotoHeight(slotCount: number): number {
  const contentH = STRIP_H - STRIP_TOP_MARGIN - STRIP_FOOTER_H;
  return slotCount > 0 ? (contentH - (slotCount - 1) * STRIP_GAP) / slotCount : contentH;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed to load: ${src}`));
    img.src = src;
  });
}

/** Safari-safe canvas filter strings. */
export function canvasFilter(name: FilterName): string {
  switch (name) {
    case "traditional":
      return "grayscale(100%) contrast(120%) brightness(103%)";
    case "sepia":
      return "sepia(75%) saturate(115%) contrast(105%)";
    case "soft":
      return "brightness(114%) contrast(92%) saturate(108%)";
    case "y2k":
      return "contrast(120%) brightness(108%) saturate(50%) hue-rotate(-8deg)";
    case "vivid":
      return "contrast(112%) saturate(170%) brightness(104%)";
    default:
      return "none";
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
