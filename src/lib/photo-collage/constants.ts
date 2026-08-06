// All the fixed values for the photo-strip flow: strip geometry, palette,
// filters, stickers and layout options. Kept apart from the views so
// the numbers are easy to find and tune in one place.

import type { FilterName } from "./types";

// Strip geometry.
export const STRIP_W = 600;
export const STRIP_H = 1800;
export const STRIP_PADDING_X = 24;

// Reframing for the low-mounted booth camera, which captures a lot of empty
// ceiling above the guest. Tune these two if the framing needs adjusting:
export const CROP_ZOOM = 1.2; // >1 zooms in to push the ceiling out of frame
export const VERTICAL_CROP_BIAS = 0.72; // 0 keeps the top of the frame, 1 keeps the bottom

// Shared layout band so 2/3/4-shot strips are laid out identically: photos
// always fill the same region (top margin → footer) with equal gaps, and the
// footer sits in a fixed reserved band at the bottom. No per-layout tuning.
export const STRIP_TOP_MARGIN = 24;
export const STRIP_GAP = 20;
export const STRIP_FOOTER_H = 250; // reserved bottom band for college text + QR + logo

// Photo width is constant; height follows from how many photos share the band.
// The strip renderer AND the camera preview both use this, so the shape a guest
// frames on the capture screen is exactly the shape that lands on the strip.
export const STRIP_PHOTO_W = STRIP_W - STRIP_PADDING_X * 2;

// Palette.
export const PRESET_COLORS = ["#043371", "#CC4E00", "#EB9AB2", "#CDED76", "#AEA43A"];
export const DEFAULT_STRIP_COLOR = "#EB9AB2";
export const SKY = "#82c4f5";
export const ACCENT = "#0022ff";

export const FILTERS: { key: FilterName; label: string }[] = [
  { key: "none", label: "Original" },
  { key: "traditional", label: "Traditional" },
  { key: "sepia", label: "Sepia" },
  { key: "soft", label: "Soft Light" },
  { key: "y2k", label: "Y2K" },
  { key: "vivid", label: "Vivid" },
];

export const STICKER_EMOJIS = ["❤️", "⭐", "✨", "🎀", "🕶️", "👑", "🐈", "🍒"];

// Gettysburg / ICL PNG stickers (transparent). Dragged onto the strip like the
// emoji, but drawn from preloaded images. Files live in public/stickers.
export const IMAGE_STICKERS: { src: string; label: string }[] = [
  { src: "/stickers/gburg-primary-logo.png", label: "Gettysburg College logo" },
  { src: "/stickers/gburg-g-logo.png", label: "Gettysburg G logo" },
  { src: "/stickers/bullet-mascot.png", label: "Bullets mascot" },
  { src: "/stickers/gburg-college.png", label: "Gettysburg College" },
  { src: "/stickers/gburg-pennant.png", label: "Gettysburg pennant" },
  { src: "/stickers/gburg-cookie.png", label: "Gettysburg cookie" },
  { src: "/stickers/do-great-work-glasses.png", label: "Do great work glasses" },
  { src: "/stickers/icl-logo-sticker.png", label: "ICL logo" },
];
// Image stickers drop bigger than emoji so logos stay legible.
export const IMAGE_STICKER_SIZE = 150;
export const EMOJI_STICKER_SIZE = 84;

export const LAYOUT_OPTIONS = [
  { slots: 2, label: "2 SHOTS", sub: "Classic duo" },
  { slots: 3, label: "3 SHOTS", sub: "Triple strip" },
  { slots: 4, label: "4 SHOTS", sub: "Full strip" },
];

// Shared UI styling, rebuilt from Chloe's original CSS. Used by the views.
export const glassBtn =
  "rounded-[20px] border border-white/60 bg-white/20 px-3 py-2.5 text-[12px] font-bold uppercase tracking-[0.5px] text-white transition-all hover:bg-white/35";
export const backBtn =
  "absolute left-6 top-5 z-50 rounded-[30px] border border-white/60 bg-white/25 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-[5px] transition-all hover:bg-white/40 active:scale-95";
export const heading =
  "mb-4 font-['Arial_Black',Arial,sans-serif] text-[15px] font-black uppercase tracking-[1.5px] text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.25)]";
