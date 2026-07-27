// Canvas helpers for the photo-strip flow: cropping, filters, and compositing,
// shared by the on-screen strip and the print sheets.

import type { FilterName, Sticker } from "./types";
import type { FrameBleed, FrameSlot } from "@/data/frame-themes";
import {
  CROP_ZOOM,
  STRIP_FOOTER_H,
  STRIP_GAP,
  STRIP_H,
  STRIP_TOP_MARGIN,
  VERTICAL_CROP_BIAS,
} from "./constants";

/** Photo height for a given slot count under the shared layout band. */
export function slotPhotoHeight(slotCount: number): number {
  const contentH = STRIP_H - STRIP_TOP_MARGIN - STRIP_FOOTER_H;
  return slotCount > 0 ? (contentH - (slotCount - 1) * STRIP_GAP) / slotCount : contentH;
}

/**
 * Cover-crop `src` to `cropAspect`, mirror it (like a real booth), apply the
 * filter, and draw into `dest`. Same zoom + downward bias as the on-screen
 * strip (see renderBase in PhotoCollage).
 *
 * `cropAspect` is separate from dest's aspect on purpose, so a photo can be
 * cropped to one shape and drawn into a slot of another.
 */
export function drawPhotoInto(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource & { width: number; height: number },
  dest: FrameSlot,
  cropAspect: number,
  filterName: FilterName,
) {
  let sw = src.width;
  let sh = src.width / cropAspect;
  if (sh > src.height) {
    sh = src.height;
    sw = src.height * cropAspect;
  }
  sw /= CROP_ZOOM;
  sh /= CROP_ZOOM;
  const sx = (src.width - sw) / 2;
  const sy = (src.height - sh) * VERTICAL_CROP_BIAS;

  ctx.save();
  ctx.beginPath();
  ctx.rect(dest.x, dest.y, dest.w, dest.h);
  ctx.clip();
  ctx.filter = canvasFilter(filterName);
  ctx.translate(dest.x + dest.w, dest.y);
  ctx.scale(-1, 1);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, dest.w, dest.h);
  ctx.restore();
}

/**
 * Stretch the artwork's outermost row/column of pixels into its transparent
 * edge bands, so the frame never leaves a white sliver at the edges.
 */
export function paintFrameBleed(
  ctx: CanvasRenderingContext2D,
  art: HTMLImageElement,
  bleed: FrameBleed,
  destW: number,
  destH: number,
) {
  const sx = art.naturalWidth / destW;
  const sy = art.naturalHeight / destH;
  const { top, bottom, left, right } = bleed;
  if (top > 0) {
    ctx.drawImage(art, 0, top * sy, art.naturalWidth, 1, 0, 0, destW, top);
  }
  if (bottom > 0) {
    const srcY = art.naturalHeight - bottom * sy - 1;
    ctx.drawImage(art, 0, srcY, art.naturalWidth, 1, 0, destH - bottom, destW, bottom);
  }
  if (left > 0) {
    ctx.drawImage(art, left * sx, 0, 1, art.naturalHeight, 0, 0, left, destH);
  }
  if (right > 0) {
    const srcX = art.naturalWidth - right * sx - 1;
    ctx.drawImage(art, srcX, 0, 1, art.naturalHeight, destW - right, 0, right, destH);
  }
}

/**
 * Stickers are placed in STRIP_W x STRIP_H space; `scale`/`offsetX` map them
 * onto a print sheet half.
 */
export function drawStickers(
  ctx: CanvasRenderingContext2D,
  stickers: Sticker[],
  images: Map<string, HTMLImageElement>,
  scale = 1,
  offsetX = 0,
) {
  ctx.save();
  stickers.forEach((s) => {
    if (s.src) {
      // Image sticker: fit inside a `size`x`size` box preserving aspect ratio,
      // centred on (x, y). Skipped if the PNG hasn't finished preloading.
      const img = images.get(s.src);
      if (!img || !img.complete || !img.naturalWidth) return;
      const box = s.size * scale;
      const ar = img.naturalWidth / img.naturalHeight;
      const w = ar >= 1 ? box : box * ar;
      const h = ar >= 1 ? box / ar : box;
      ctx.drawImage(img, offsetX + s.x * scale - w / 2, s.y * scale - h / 2, w, h);
      return;
    }
    ctx.font = `${s.size * scale}px Arial`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(s.emoji, offsetX + s.x * scale, s.y * scale);
  });
  ctx.restore();
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

/**
 * Build a 4×6 sheet with two copies of the strip side by side, so a centre cut
 * yields two complete 2×6 strips instead of slicing one in half.
 *
 * Uses the captured strip PNG rather than the live decor canvas, which is
 * unmounted by the time the final view is showing.
 */
export async function composePlainPrintSheet(
  stripDataUrl: string,
  bgColor: string,
): Promise<string | null> {
  if (!stripDataUrl) return null;

  const strip = new Image();
  strip.src = stripDataUrl;
  try {
    await new Promise<void>((resolve, reject) => {
      strip.onload = () => resolve();
      strip.onerror = () => reject(new Error("strip image failed to load"));
    });
  } catch {
    return null;
  }

  // 4:6 portrait sheet.
  const sheetH = 1800;
  const sheetW = 1200;
  const halfW = sheetW / 2; // 600 — the centre cut line (2 inches)

  // Margins in px (300 px/inch on this 4×6 sheet). Equal on both sides for now;
  // the real cut needs measuring on printed sheets before tuning these.
  const OUTER_MARGIN = 30; // background colour outside each strip
  const INNER_MARGIN = 30; // background colour between strip and centre cut

  const stripTargetW = halfW - OUTER_MARGIN - INNER_MARGIN;
  const scale = stripTargetW / strip.width; // uniform — no distortion
  const stripTargetH = strip.height * scale;
  const yTop = (sheetH - stripTargetH) / 2; // centre vertically; even top/bottom margin too

  const sheet = document.createElement("canvas");
  sheet.width = sheetW;
  sheet.height = sheetH;
  const ctx = sheet.getContext("2d");
  if (!ctx) return null;

  // Fill with bgColor so no white paper shows; the border bleeds to every edge.
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, sheetW, sheetH);

  // Left strip: OUTER_MARGIN from the left paper edge, inner edge short of centre.
  ctx.drawImage(strip, OUTER_MARGIN, yTop, stripTargetW, stripTargetH);

  // Right strip (identical): INNER_MARGIN to the right of centre.
  ctx.drawImage(strip, halfW + INNER_MARGIN, yTop, stripTargetW, stripTargetH);

  return sheet.toDataURL("image/png");
}
