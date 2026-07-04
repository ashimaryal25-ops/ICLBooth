"use client";

import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from "react";
import {
  ACCENT,
  FILTERS,
  PRESET_COLORS,
  STICKER_EMOJIS,
  STRIP_H,
  STRIP_W,
  backBtn,
  glassBtn,
  heading,
} from "@/lib/photo-collage/constants";
import type { FilterName, PaletteDrag, Sticker } from "@/lib/photo-collage/types";

type DecorViewProps = {
  bgColor: string;
  setBgColor: Dispatch<SetStateAction<string>>;
  filter: FilterName;
  setFilter: Dispatch<SetStateAction<FilterName>>;
  stickers: Sticker[];
  setStickers: Dispatch<SetStateAction<Sticker[]>>;
  paletteDrag: PaletteDrag | null;
  decorCanvasRef: RefObject<HTMLCanvasElement | null>;
  onCanvasPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onCanvasPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onCanvasPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPalettePointerDown: (emoji: string, e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPalettePointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPalettePointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  /** Back to the camera for a fresh set of shots. */
  onBack: () => void;
  /** Capture the strip and move to the final view. */
  onContinue: () => void;
};

/** The decorate view: the live strip plus colour and filter controls. */
export function DecorView({
  bgColor,
  setBgColor,
  filter,
  setFilter,
  stickers,
  setStickers,
  paletteDrag,
  decorCanvasRef,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onPalettePointerDown,
  onPalettePointerMove,
  onPalettePointerUp,
  onBack,
  onContinue,
}: DecorViewProps) {
  return (
    <section className="grid h-full w-full grid-cols-[minmax(0,1fr)_340px] gap-6 px-8 pb-8 pt-16">
      <button type="button" className={backBtn} onClick={onBack}>
        ← Back
      </button>

      <div className="grid min-h-0 place-items-center">
        <canvas
          ref={decorCanvasRef}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
          className="max-h-full w-auto touch-none rounded-[4px] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.35)]"
          style={{ aspectRatio: `${STRIP_W} / ${STRIP_H}`, height: "min(78vh, 750px)" }}
        />
      </div>

      <div className="flex min-h-0 flex-col gap-7 overflow-y-auto">
        <div>
          <h3 className={heading}>Strip Colour</h3>
          <div className="flex flex-wrap gap-2.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setBgColor(color)}
                aria-label={`Strip colour ${color}`}
                aria-pressed={bgColor === color}
                className={`h-11 w-11 rounded-full border-[3px] transition-transform active:scale-95 ${
                  bgColor === color ? "border-white scale-110" : "border-white/40"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className={heading}>Filter</h3>
          <div className="grid grid-cols-2 gap-2">
            {FILTERS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                aria-pressed={filter === option.key}
                className={`${glassBtn} ${filter === option.key ? "bg-white/45" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className={heading}>Stickers</h3>
          <p className="mb-2.5 text-[11px] font-bold text-white/70">
            Drag onto the strip. Pinch with two fingers to resize.
          </p>
          <div className="flex flex-wrap gap-2">
            {STICKER_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onPointerDown={(e) => onPalettePointerDown(emoji, e)}
                onPointerMove={onPalettePointerMove}
                onPointerUp={onPalettePointerUp}
                onPointerCancel={onPalettePointerUp}
                aria-label={`Sticker ${emoji}`}
                className="h-12 w-12 touch-none rounded-[12px] border border-white/60 bg-white/25 text-2xl leading-none transition-all hover:bg-white/40 active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>
          {stickers.length > 0 && (
            <button
              type="button"
              onClick={() => setStickers([])}
              className={`${glassBtn} mt-2.5`}
            >
              Clear stickers
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-auto rounded-[20px] border px-8 py-3.5 text-[13px] font-bold uppercase tracking-[0.5px] text-white shadow-[0_0_10px_rgba(0,34,255,0.4)] transition-transform hover:scale-105"
          style={{ background: ACCENT, borderColor: ACCENT }}
        >
          Continue →
        </button>
      </div>

      {/* Ghost of the sticker being dragged out of the palette. */}
      {paletteDrag && (
        <span
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 text-5xl"
          style={{ left: paletteDrag.x, top: paletteDrag.y }}
        >
          {paletteDrag.emoji}
        </span>
      )}
    </section>
  );
}
