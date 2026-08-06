"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { FrameTheme } from "@/data/frame-themes";
import {
  ACCENT,
  FILTERS,
  IMAGE_STICKERS,
  PRESET_COLORS,
  STICKER_EMOJIS,
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
  setFrameKey: Dispatch<SetStateAction<string | null>>;
  framePage: number;
  setFramePage: Dispatch<SetStateAction<number>>;
  framePageCount: number;
  visibleFrames: FrameTheme[];
  activeFrame: FrameTheme | undefined;
  paletteDrag: PaletteDrag | null;
  decorCanvasRef: RefObject<HTMLCanvasElement | null>;
  onCanvasPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onCanvasPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onCanvasPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPalettePointerDown: (
    emoji: string,
    src: string | undefined,
    e: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onPalettePointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPalettePointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  /** Leave the decorate view back to the camera. */
  onBack: () => void;
  /** Lock the strip and move to the final view. */
  onContinue: () => void;
};

/** The decorate view: live strip preview + the frame colour / filter / sticker / theme dashboard. */
export function DecorView({
  bgColor,
  setBgColor,
  filter,
  setFilter,
  stickers,
  setStickers,
  setFrameKey,
  framePage,
  setFramePage,
  framePageCount,
  visibleFrames,
  activeFrame,
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
    <>
      {paletteDrag && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[100] grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg border-2 border-white bg-[#043371]/90 p-1 text-[40px] shadow-xl"
          style={{ left: paletteDrag.x, top: paletteDrag.y }}
        >
          {paletteDrag.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={paletteDrag.src} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            paletteDrag.emoji
          )}
        </div>
      )}

      <section className="flex h-full w-full items-center justify-center overflow-hidden px-6 py-4">
        <button
          type="button"
          className={backBtn}
          onClick={onBack}
        >
          ← Back
        </button>

        <div className="flex w-full max-w-[1200px] items-center justify-center gap-[50px]">
          {/* Strip preview */}
          <div className="flex w-[320px] shrink-0 items-center justify-center">
            <canvas
              ref={decorCanvasRef}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onPointerCancel={onCanvasPointerUp}
              onPointerOut={onCanvasPointerUp}
              className="max-h-[76vh] max-w-full cursor-crosshair bg-white shadow-[0_12px_35px_rgba(0,0,0,0.3)]"
              style={{ touchAction: "none" }}
            />
          </div>

          {/* Dashboard */}
          <div className="flex w-[680px] flex-col gap-3">
            <h2 className="text-[34px] font-black uppercase tracking-[2px] text-white [text-shadow:0_4px_10px_rgba(0,0,0,0.25)]">
              Customize Your Strip
            </h2>

            <div className="grid grid-cols-2 gap-x-[45px] gap-y-[18px]">
              {/* FRAME COLOR */}
              <div className="flex flex-col items-start">
                <h3 className={heading}>Frame Color</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Frame colour ${c}`}
                      onClick={() => setBgColor(c)}
                      className="h-[42px] w-[42px] shrink-0 rounded-full border-2 shadow-[0_4px_10px_rgba(0,0,0,0.15)] transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: bgColor === c ? ACCENT : "rgba(255,255,255,0.8)",
                      }}
                    />
                  ))}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="relative h-[42px] w-[42px] cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-[0_4px_10px_rgba(0,0,0,0.15)]">
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="gbooth-wheel"
                        aria-label="Pick a custom frame colour"
                      />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]">
                      pick your color
                    </span>
                  </div>
                </div>
              </div>

              {/* FILTERS */}
              <div className="flex flex-col items-start">
                <h3 className={heading}>Filters</h3>
                <div className="grid w-full grid-cols-2 gap-2.5">
                  {FILTERS.map((f) => {
                    const active = filter === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFilter(f.key)}
                        className={glassBtn}
                        style={
                          active
                            ? {
                                background: ACCENT,
                                borderColor: ACCENT,
                                boxShadow: "0 0 10px rgba(0,34,255,0.4)",
                              }
                            : undefined
                        }
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STICKERS */}
              <div className="col-span-2 flex flex-col items-start">
                <h3 className={heading}>Stickers</h3>
                <p className="-mt-2 mb-2 text-[12px] font-bold text-white/85">
                  Drag one onto the strip
                </p>
                <div className="grid w-full grid-cols-8 gap-2">
                  {STICKER_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onPointerDown={(event) => onPalettePointerDown(emoji, undefined, event)}
                      onPointerMove={onPalettePointerMove}
                      onPointerUp={onPalettePointerUp}
                      onPointerCancel={onPalettePointerUp}
                      className="flex h-[58px] touch-none select-none items-center justify-center border border-white/40 bg-white/15 text-[24px] transition-transform hover:scale-105 hover:bg-white/25 active:cursor-grabbing"
                      aria-label={`Drag ${emoji} sticker onto the strip`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid w-full grid-cols-8 gap-2">
                  {IMAGE_STICKERS.map(({ src, label }) => (
                    <button
                      key={src}
                      type="button"
                      onPointerDown={(event) => onPalettePointerDown("", src, event)}
                      onPointerMove={onPalettePointerMove}
                      onPointerUp={onPalettePointerUp}
                      onPointerCancel={onPalettePointerUp}
                      className="flex h-[58px] touch-none select-none items-center justify-center border border-white/40 bg-white/15 p-1.5 transition-transform hover:scale-105 hover:bg-white/25 active:cursor-grabbing"
                      aria-label={`Drag ${label} sticker onto the strip`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={label} draggable={false} className="pointer-events-none max-h-full max-w-full object-contain" />
                    </button>
                  ))}
                </div>
                {stickers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStickers([])}
                    className={`mt-4 ${glassBtn}`}
                  >
                    Clear stickers
                  </button>
                )}
              </div>

              {/* STRIPS */}
              <div className="col-span-2 flex flex-col items-start">
                <div className="mb-2 flex w-full items-center justify-between">
                  <h3 className="text-[20px] font-black uppercase tracking-[1.5px] text-white [text-shadow:0_3px_8px_rgba(0,0,0,0.25)]">
                    Strips
                  </h3>
                  {framePageCount > 1 && (
                    <div className="flex items-center gap-2 text-[12px] font-black text-white">
                      <button
                        type="button"
                        onClick={() => setFramePage((page) => Math.max(0, page - 1))}
                        disabled={framePage === 0}
                        className="rounded-full border border-white/70 bg-white/15 px-3 py-1.5 disabled:opacity-30"
                        aria-label="Previous frame themes"
                      >
                        &larr;
                      </button>
                      <span>{framePage + 1} / {framePageCount}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFramePage((page) => Math.min(framePageCount - 1, page + 1))
                        }
                        disabled={framePage === framePageCount - 1}
                        className="rounded-full border border-white/70 bg-white/15 px-3 py-1.5 disabled:opacity-30"
                        aria-label="Next frame themes"
                      >
                        &rarr;
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid w-full grid-cols-6 gap-2.5 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setFrameKey(null)}
                    className="flex flex-col items-center gap-1.5 rounded-[14px] border-2 bg-white/15 p-1.5 transition-transform hover:scale-105"
                    style={{
                      borderColor: !activeFrame ? ACCENT : "rgba(255,255,255,0.55)",
                      boxShadow: !activeFrame ? "0 0 10px rgba(0,34,255,0.4)" : undefined,
                    }}
                  >
                    <span
                      className="h-[74px] w-[26px] rounded-[4px] border border-white/70"
                      style={{ backgroundColor: bgColor }}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-white">
                      Plain
                    </span>
                  </button>

                  {visibleFrames.map((f) => {
                    const active = activeFrame?.key === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFrameKey(f.key)}
                        className="flex flex-col items-center gap-1.5 rounded-[14px] border-2 bg-white/15 p-1.5 transition-transform hover:scale-105"
                        style={{
                          borderColor: active ? ACCENT : "rgba(255,255,255,0.55)",
                          boxShadow: active ? "0 0 10px rgba(0,34,255,0.4)" : undefined,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.single.src}
                          alt=""
                          className="h-[74px] w-[26px] rounded-[4px] border border-white/70 object-cover"
                        />
                        <span className="text-center text-[10px] font-bold uppercase leading-tight tracking-[0.5px] text-white">
                          {f.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex w-full justify-end pr-4">
              <button
                type="button"
                onClick={onContinue}
                className="rounded-[30px] border px-10 py-3.5 text-[15px] font-black uppercase tracking-[1px] text-white shadow-[0_0_14px_rgba(0,34,255,0.45)] transition-transform hover:scale-105 active:scale-95"
                style={{ background: ACCENT, borderColor: ACCENT }}
              >
                Continue →
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
