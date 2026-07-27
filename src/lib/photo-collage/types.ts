// Shared types for the photo-strip collage flow.

export type CollageView = "layout" | "camera" | "decor" | "final";
export type FilterName = "none" | "traditional" | "sepia" | "soft" | "y2k" | "vivid";

// A sticker is either an emoji (drawn as text) or an image (`src` set, drawn
// from a preloaded PNG). `size` is the glyph font-size for emoji and the
// bounding-box longest side for images.
export type Sticker = {
  id: number;
  emoji: string;
  x: number;
  y: number;
  size: number;
  src?: string;
};

export type PaletteDrag = { emoji: string; x: number; y: number; src?: string };

export type PhotoCollageProps = {
  /** Return to the app's home chooser. */
  onExit: () => void;
};
