// Shared types for the photo-strip collage flow.

export type CollageView = "layout" | "camera" | "decor" | "final";
export type FilterName = "none" | "traditional" | "sepia" | "soft" | "y2k" | "vivid";

export type PhotoCollageProps = {
  /** Return to the app's home chooser. */
  onExit: () => void;
};
