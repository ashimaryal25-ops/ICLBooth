// Shared types for the photo-strip collage flow.

export type CollageView = "layout" | "camera" | "decor" | "final";
export type FilterName = "none" | "traditional" | "sepia" | "soft" | "y2k" | "vivid";

export type Sticker = {
  id: number;
  emoji: string;
  x: number;
  y: number;
  size: number;
};

export type PaletteDrag = { emoji: string; x: number; y: number };

export type PhotoCollageProps = {
  /** Return to the app's home chooser. */
  onExit: () => void;
};
