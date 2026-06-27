"use client";

import { LAYOUT_OPTIONS, backBtn } from "@/lib/photo-collage/constants";

type LayoutViewProps = {
  /** Return to the app's home chooser. */
  onExit: () => void;
  /** Start a capture session with the chosen shot count (2 / 3 / 4). */
  onPick: (slots: number) => void;
};

/** The entry view: pick how many shots go on the strip. */
export function LayoutView({ onExit, onPick }: LayoutViewProps) {
  return (
    <section className="flex h-full w-full flex-col items-center justify-center px-6">
      <button type="button" className={backBtn} onClick={onExit}>
        ← Back
      </button>

      <h2 className="mb-1 text-[42px] font-black uppercase tracking-[2px] text-white [text-shadow:0_4px_10px_rgba(0,0,0,0.25)]">
        Choose Your Layout
      </h2>
      <p className="mb-10 text-[15px] font-bold text-white/85 [text-shadow:0_2px_4px_rgba(0,0,0,0.2)]">
        How many shots do you want on your strip?
      </p>

      <div className="flex max-w-[1100px] items-center justify-center gap-[60px]">
        {LAYOUT_OPTIONS.map((opt) => (
          <button
            key={opt.slots}
            type="button"
            onClick={() => onPick(opt.slots)}
            className="group flex w-[220px] cursor-pointer flex-col items-center transition-transform duration-[250ms] hover:-translate-y-3"
          >
            {/* White strip mock-up */}
            <div className="mb-5 flex w-full justify-center">
              <div className="flex h-[250px] w-[110px] flex-col gap-2 rounded-[6px] border-2 border-dashed border-[#cbd5e1] bg-white p-2.5 shadow-[0_15px_30px_rgba(0,0,0,0.25)] transition-shadow group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
                {Array.from({ length: opt.slots }).map((_, i) => (
                  <div
                    key={i}
                    className="w-full flex-1 rounded-[4px] border border-[#e2e8f0] bg-[#f1f5f9]"
                  />
                ))}
              </div>
            </div>
            <span className="text-[18px] font-black tracking-[1px] text-white [text-shadow:0_2px_5px_rgba(0,0,0,0.3)]">
              {opt.label}
            </span>
            <span className="mt-1 text-[12px] font-bold text-white/70">{opt.sub}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
