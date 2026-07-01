"use client";

import { Download, Home } from "lucide-react";
import { ACCENT } from "@/lib/photo-collage/constants";

type FinalViewProps = {
  stripDataUrl: string;
  /** Two-up 4×6 sheet: one print, two strips. Falls back to the bare strip. */
  printSheetUrl: string;
  /** Return to the app's home. */
  onHome: () => void;
};

/** The final view: the finished strip and a way to take it home. */
export function FinalView({ stripDataUrl, printSheetUrl, onHome }: FinalViewProps) {
  return (
    <section className="relative flex h-full w-full flex-col items-center">
      <h2 className="mt-4 text-[38px] font-black uppercase tracking-[2px] text-white [text-shadow:0_4px_10px_rgba(0,0,0,0.25)]">
        Here is your strip!
      </h2>

      {/* Home — top left, larger */}
      <button
        type="button"
        onClick={onHome}
        className="absolute left-6 top-6 z-10 flex h-[132px] w-[132px] flex-col items-center justify-center gap-1.5 rounded-full border-4 border-white text-[13px] font-black uppercase tracking-[1px] text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)] transition-transform hover:scale-105 active:scale-95"
        style={{ background: "#043371" }}
      >
        <Home size={38} strokeWidth={2.2} />
        Home
      </button>

      <div className="relative flex w-full flex-1 items-center justify-center px-[8vw]">
        {/* CENTER: strip (centered in the viewport) */}
        <div className="flex items-center justify-center">
          {stripDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stripDataUrl}
              alt="Your finished photo strip"
              className="max-h-[750px] w-auto rounded-[4px] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.35)]"
              style={{ height: "65vh" }}
            />
          )}
        </div>

        {/* RIGHT: save (floated so the strip stays centered) */}
        <div className="absolute right-[8vw] top-1/2 flex -translate-y-1/2 flex-col items-center justify-center gap-8">
          <a
            href={printSheetUrl || stripDataUrl || undefined}
            download="gettysburg-photo-strip.png"
            className="flex h-[140px] w-[140px] flex-col items-center justify-center gap-1.5 rounded-full border-4 border-white text-[15px] font-black uppercase tracking-[1px] text-white shadow-[0_10px_24px_rgba(0,0,0,0.25)] transition-transform hover:scale-105 active:scale-95"
            style={{ background: ACCENT }}
          >
            <Download size={36} strokeWidth={2.2} />
            Save
          </a>
        </div>
      </div>
    </section>
  );
}
