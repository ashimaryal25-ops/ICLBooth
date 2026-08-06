"use client";

import { ACCENT, STRIP_PHOTO_W, VERTICAL_CROP_BIAS, backBtn, glassBtn } from "@/lib/photo-collage/constants";
import { slotPhotoHeight } from "@/lib/photo-collage/canvas";

type CameraViewProps = {
  slots: number;
  previews: string[];
  countdown: number | null;
  cameraError: string | null;
  sessionDone: boolean;
  /** Leave the camera back to the layout picker. */
  onBack: () => void;
  onRetakeAll: () => void;
  /** Move on to the decorate view once all shots are taken. */
  onContinue: () => void;
};

/** The capture view: mirror viewfinder + per-slot thumbnails + Retake/Continue. */
export function CameraView({
  slots,
  previews,
  countdown,
  cameraError,
  sessionDone,
  onBack,
  onRetakeAll,
  onContinue,
}: CameraViewProps) {
  const viewfinderRatio = STRIP_PHOTO_W / slotPhotoHeight(slots);
  // Same height for both columns so the row never sizes itself off
  // whichever one happens to be taller (the tall 2-shot thumbnails
  // used to do this, leaving the sidebar flush at the top instead of
  // centered like the viewfinder).
  const columnHeight =
    viewfinderRatio >= 1 ? `${560 / viewfinderRatio}px` : "min(78vh, 680px)";

  return (
    <section className="flex h-full w-full items-center justify-center px-10">
      <button
        type="button"
        className={backBtn}
        onClick={onBack}
      >
        ← Back
      </button>

      <div className="flex w-full max-w-[1100px] items-center justify-center gap-[50px]">
        {/* Viewfinder */}
        <div
          className="relative flex shrink-0 items-center justify-center overflow-hidden bg-black shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
          style={{
            aspectRatio: `${STRIP_PHOTO_W} / ${slotPhotoHeight(slots)}`,
            height: columnHeight,
          }}
        >
          {previews.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previews[previews.length - 1]}
              alt="Latest captured photo"
              className="h-full w-full -scale-x-100 object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-10 text-center text-2xl font-black text-white">
              Look at the camera screen
            </div>
          )}
          {countdown !== null && (
            <div className="gbooth-countdown pointer-events-none absolute z-10 text-[140px] font-black text-white [text-shadow:0_0_25px_rgba(0,0,0,0.8),0_0_50px_#0022ff]">
              {countdown}
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-8 text-center text-lg font-bold text-white">
              {cameraError}
            </div>
          )}
        </div>

        {/* Sidebar previews + controls */}
        <div
          className="flex w-[480px] flex-col items-center justify-center gap-[30px]"
          style={{ height: columnHeight }}
        >
          <div
            className="grid w-full gap-[15px]"
            style={{
              // Always two across, so the tall 2-shot thumbnails sit side by
              // side (one row) instead of stacking and pushing the Retake/
              // Continue buttons off the bottom.
              gridTemplateColumns: "repeat(2, 1fr)",
              maxWidth: "100%",
            }}
          >
            {Array.from({ length: slots }).map((_, i) => (
              <div
                key={i}
                className="flex w-full items-center justify-center border border-white/50 bg-white/85 shadow-[0_4px_10px_rgba(0,0,0,0.15)]"
                style={{ aspectRatio: `${STRIP_PHOTO_W} / ${slotPhotoHeight(slots)}` }}
              >
                {previews[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previews[i]}
                    alt={`Shot ${i + 1}`}
                    className="h-[90%] w-[90%] -scale-x-100 object-cover"
                    style={{ objectPosition: `center ${VERTICAL_CROP_BIAS * 100}%` }}
                  />
                ) : (
                  <span className="text-3xl font-black text-[#cbd5e1]">{i + 1}</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex h-[90px] items-center justify-center gap-[30px]">
            {sessionDone && (
              <>
                <button
                  type="button"
                  onClick={onRetakeAll}
                  className={`${glassBtn} px-6 py-3 text-[13px]`}
                >
                  Retake All
                </button>
                <button
                  type="button"
                  onClick={onContinue}
                  className="rounded-[20px] border px-8 py-3 text-[13px] font-bold uppercase tracking-[0.5px] text-white shadow-[0_0_10px_rgba(0,34,255,0.4)] transition-transform hover:scale-105"
                  style={{ background: ACCENT, borderColor: ACCENT }}
                >
                  Continue →
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
