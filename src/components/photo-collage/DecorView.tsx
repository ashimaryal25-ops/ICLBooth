"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  ACCENT,
  FILTERS,
  PRESET_COLORS,
  STRIP_H,
  STRIP_W,
  backBtn,
  glassBtn,
  heading,
} from "@/lib/photo-collage/constants";
import type { FilterName } from "@/lib/photo-collage/types";

type DecorViewProps = {
  bgColor: string;
  setBgColor: Dispatch<SetStateAction<string>>;
  filter: FilterName;
  setFilter: Dispatch<SetStateAction<FilterName>>;
  decorCanvasRef: RefObject<HTMLCanvasElement | null>;
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
  decorCanvasRef,
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
          className="max-h-full w-auto rounded-[4px] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.35)]"
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

        <button
          type="button"
          onClick={onContinue}
          className="mt-auto rounded-[20px] border px-8 py-3.5 text-[13px] font-bold uppercase tracking-[0.5px] text-white shadow-[0_0_10px_rgba(0,34,255,0.4)] transition-transform hover:scale-105"
          style={{ background: ACCENT, borderColor: ACCENT }}
        >
          Continue →
        </button>
      </div>
    </section>
  );
}
