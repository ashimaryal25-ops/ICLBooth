"use client";

/**
 * PhotoCollage — React port of Chloe's original GBOOTH photo-strip booth,
 * rendered in-app instead of as a standalone page.
 *
 * Keeps the original four screens (pick a layout, shoot, decorate, finish) and
 * the same strip proportions; the vanilla DOM/canvas code becomes React state
 * plus one offscreen canvas that renders the strip.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACCENT,
  DEFAULT_STRIP_COLOR,
  FILTERS,
  LAYOUT_OPTIONS,
  PRESET_COLORS,
  SKY,
  STRIP_GAP,
  STRIP_H,
  STRIP_PADDING_X,
  STRIP_PHOTO_W,
  STRIP_TOP_MARGIN,
  STRIP_W,
  backBtn,
  glassBtn,
  heading,
} from "@/lib/photo-collage/constants";
import { canvasFilter, slotPhotoHeight, sleep } from "@/lib/photo-collage/canvas";
import type { CollageView, FilterName, PhotoCollageProps } from "@/lib/photo-collage/types";
import { captureDevPhoto, startDevCamera, stopDevCamera } from "@/lib/dev-camera";

export function PhotoCollage({ onExit }: PhotoCollageProps) {
  const [view, setView] = useState<CollageView>("layout");
  const [slots, setSlots] = useState(4);
  const [filter, setFilter] = useState<FilterName>("none");
  const [bgColor, setBgColor] = useState(DEFAULT_STRIP_COLOR);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sessionDone, setSessionDone] = useState(false);
  const [retakeNonce, setRetakeNonce] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [stripDataUrl, setStripDataUrl] = useState("");

  const photosRef = useRef<HTMLCanvasElement[]>([]);
  // Bumped per capture run; a stale/overlapping loop checks this and bails.
  const captureRunRef = useRef(0);
  const decorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const resetShots = useCallback(() => {
    photosRef.current = [];
    setPreviews([]);
    setSessionDone(false);
    setCountdown(null);
    setCameraError(null);
  }, []);

  const startSession = (nextSlots: number) => {
    resetShots();
    setSlots(nextSlots);
    setFilter("none");
    setBgColor(DEFAULT_STRIP_COLOR);
    setView("camera");
  };

  const retakeAll = () => {
    resetShots();
    setRetakeNonce((n) => n + 1);
  };

  // --- Capture session (the original countdown + retake flow) ----------------
  useEffect(() => {
    if (view !== "camera") return;
    let cancelled = false;
    const runId = ++captureRunRef.current;
    const isStale = () => cancelled || runId !== captureRunRef.current;

    (async () => {
      try {
        await startDevCamera();
      } catch {
        if (!isStale()) setCameraError("Could not open the camera. Check permissions and try again.");
        return;
      }
      await sleep(500);

      for (let i = 0; i < slots; i++) {
        for (let t = 3; t > 0; t--) {
          if (isStale()) return;
          setCountdown(t);
          await sleep(1000);
        }
        if (isStale()) return;
        setCountdown(null);

        const photo = captureDevPhoto();
        if (isStale()) return;
        if (!photo) {
          setCameraError("The camera did not return a photo. Try again.");
          return;
        }

        const image = new Image();
        image.src = photo;
        await new Promise<void>((resolve) => {
          image.onload = () => resolve();
          image.onerror = () => resolve();
        });
        if (isStale()) return;

        // Cap at the chosen slot count so a rogue loop can never overshoot.
        if (image.naturalWidth > 0 && photosRef.current.length < slots) {
          const c = document.createElement("canvas");
          c.width = 640;
          c.height = 480;
          const cx = c.getContext("2d");
          if (cx) {
            cx.drawImage(image, 0, 0, 640, 480);
            photosRef.current.push(c);
            setPreviews((p) => [...p, c.toDataURL("image/png")]);
          }
        }
        if (i < slots - 1) await sleep(1200);
      }
      if (!isStale()) setSessionDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [view, slots, retakeNonce]);

  // --- Strip rendering (direct port of renderPhotoStripCanvas) --------------
  const renderStrip = useCallback(() => {
    const canvas = decorCanvasRef.current;
    if (!canvas) return;
    if (canvas.width !== STRIP_W || canvas.height !== STRIP_H) {
      canvas.width = STRIP_W;
      canvas.height = STRIP_H;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const photos = photosRef.current;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, STRIP_W, STRIP_H);

    const slotCount = photos.length;
    const photoW = STRIP_PHOTO_W;
    const photoH = slotPhotoHeight(slotCount);

    for (let i = 0; i < slotCount; i++) {
      const y = STRIP_TOP_MARGIN + i * (photoH + STRIP_GAP);
      const src = photos[i];

      // Cover-crop into the slot so the photo fills it without stretching.
      const targetAspect = photoW / photoH;
      let sw = src.width;
      let sh = src.width / targetAspect;
      if (sh > src.height) {
        sh = src.height;
        sw = src.height * targetAspect;
      }
      const sx = (src.width - sw) / 2;
      const sy = (src.height - sh) / 2;

      ctx.save();
      // Clip so filters never bleed past the photo frame.
      ctx.beginPath();
      ctx.rect(STRIP_PADDING_X, y, photoW, photoH);
      ctx.clip();
      ctx.filter = canvasFilter(filter);
      ctx.drawImage(src, sx, sy, sw, sh, STRIP_PADDING_X, y, photoW, photoH);
      ctx.restore();
    }

    // Footer branding.
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 30px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GETTYSBURG COLLEGE", STRIP_W / 2, STRIP_H - 206);
  }, [bgColor, filter]);

  useEffect(() => {
    if (view !== "decor") return;
    renderStrip();
  }, [view, renderStrip]);

  const goFinal = () => {
    const canvas = decorCanvasRef.current;
    if (!canvas) return;
    renderStrip();
    setStripDataUrl(canvas.toDataURL("image/png"));
    stopDevCamera();
    setView("final");
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden font-[Arial,sans-serif]"
      style={{ backgroundColor: SKY }}
    >
      <style>{`
        @keyframes gboothPulseCount {
          0%   { transform: scale(0.95); opacity: 0.9; }
          100% { transform: scale(1.05); opacity: 1; }
        }
        .gbooth-countdown { animation: gboothPulseCount 1s infinite alternate; }
        .gbooth-wheel { position:absolute; top:-10px; left:-10px; width:68px; height:68px; border:none; background:none; cursor:pointer; -webkit-appearance:none; }
      `}</style>

      {/* ================= LAYOUT PICKER ================= */}
      {view === "layout" && (
        <section className="grid h-full w-full place-items-center p-8">
          <button type="button" onClick={onExit} className={backBtn}>
            ← Back
          </button>
          <div className="w-full max-w-3xl text-center">
            <h1 className="font-['Arial_Black',Arial,sans-serif] text-[42px] font-black uppercase tracking-[2px] text-white [text-shadow:0_3px_8px_rgba(0,0,0,0.25)]">
              Photo Strip
            </h1>
            <p className="mt-2 text-lg font-bold text-white/90">
              How many shots do you want?
            </p>
            <div className="mt-8 grid grid-cols-3 gap-5">
              {LAYOUT_OPTIONS.map((option) => (
                <button
                  key={option.slots}
                  type="button"
                  onClick={() => startSession(option.slots)}
                  className="flex flex-col items-center gap-2 rounded-[18px] border-2 border-white/70 bg-white/20 px-4 py-8 text-white transition-all hover:bg-white/35 active:scale-95"
                >
                  <span className="font-['Arial_Black',Arial,sans-serif] text-2xl font-black">
                    {option.label}
                  </span>
                  <span className="text-sm font-bold text-white/85">{option.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================= CAMERA ================= */}
      {view === "camera" && (
        <section className="grid h-full w-full place-items-center p-8">
          <button
            type="button"
            onClick={() => {
              stopDevCamera();
              setView("layout");
            }}
            className={backBtn}
          >
            ← Back
          </button>

          <div className="w-full max-w-2xl text-center">
            <h2 className={heading}>
              {sessionDone ? "All shots taken" : `Shot ${previews.length + 1} of ${slots}`}
            </h2>

            <div className="relative mx-auto grid aspect-[4/3] w-full max-w-xl place-items-center overflow-hidden rounded-[16px] border-4 border-white/70 bg-black/25">
              {countdown !== null && (
                <span className="gbooth-countdown font-['Arial_Black',Arial,sans-serif] text-[120px] font-black text-white [text-shadow:0_4px_12px_rgba(0,0,0,0.4)]">
                  {countdown}
                </span>
              )}
              {countdown === null && !sessionDone && (
                <span className="text-xl font-black uppercase tracking-[1px] text-white">
                  Hold still…
                </span>
              )}
              {sessionDone && (
                <span className="text-xl font-black uppercase tracking-[1px] text-white">
                  Nice one!
                </span>
              )}
            </div>

            <div className="mt-4 flex justify-center gap-3">
              {previews.map((preview, index) => (
                <img
                  key={index}
                  src={preview}
                  alt={`Shot ${index + 1}`}
                  className="h-20 w-[106px] rounded-[8px] border-2 border-white/70 object-cover"
                />
              ))}
            </div>

            {cameraError && (
              <p className="mt-4 rounded-[10px] bg-black/50 px-4 py-2 text-sm font-bold text-[#ffb4b4]">
                {cameraError}
              </p>
            )}

            {sessionDone && (
              <div className="mt-6 flex justify-center gap-3">
                <button type="button" onClick={retakeAll} className={glassBtn}>
                  Retake all
                </button>
                <button
                  type="button"
                  onClick={() => setView("decor")}
                  className="rounded-[20px] border-2 border-white bg-white px-6 py-2.5 text-[12px] font-black uppercase tracking-[0.5px] transition-all active:scale-95"
                  style={{ color: ACCENT }}
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================= DECORATE ================= */}
      {view === "decor" && (
        <section className="grid h-full w-full grid-cols-[minmax(0,1fr)_320px] gap-6 p-8">
          <button
            type="button"
            onClick={() => {
              resetShots();
              setView("camera");
            }}
            className={backBtn}
          >
            ← Back
          </button>

          <div className="grid min-h-0 place-items-center pt-12">
            <canvas
              ref={decorCanvasRef}
              className="max-h-full w-auto rounded-[10px] shadow-[0_8px_28px_rgba(0,0,0,0.25)]"
              style={{ aspectRatio: `${STRIP_W} / ${STRIP_H}` }}
            />
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto pt-12">
            <div>
              <h3 className={heading}>Strip colour</h3>
              <div className="flex flex-wrap gap-2.5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBgColor(color)}
                    aria-label={`Strip colour ${color}`}
                    className={`h-11 w-11 rounded-full border-[3px] transition-transform active:scale-95 ${
                      bgColor === color ? "border-white" : "border-white/40"
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
                    className={`${glassBtn} ${filter === option.key ? "bg-white/45" : ""}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={goFinal}
              className="mt-auto rounded-[20px] border-2 border-white bg-white px-6 py-3.5 text-[13px] font-black uppercase tracking-[0.5px] transition-all active:scale-95"
              style={{ color: ACCENT }}
            >
              Finish strip
            </button>
          </div>
        </section>
      )}

      {/* ================= FINAL ================= */}
      {view === "final" && (
        <section className="grid h-full w-full place-items-center p-8">
          <div className="flex items-center gap-14">
            {stripDataUrl && (
              <img
                src={stripDataUrl}
                alt="Your finished photo strip"
                className="max-h-[80vh] w-auto rounded-[10px] shadow-[0_8px_28px_rgba(0,0,0,0.25)]"
              />
            )}

            <div className="flex flex-col items-center gap-6">
              <h2 className="font-['Arial_Black',Arial,sans-serif] text-3xl font-black uppercase text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.25)]">
                All done
              </h2>
              <a
                href={stripDataUrl}
                download="gettysburg-photo-strip.png"
                className="rounded-[20px] border-2 border-white bg-white px-8 py-3.5 text-[13px] font-black uppercase tracking-[0.5px] transition-all active:scale-95"
                style={{ color: ACCENT }}
              >
                Save strip
              </a>
              <button
                type="button"
                onClick={() => {
                  stopDevCamera();
                  onExit();
                }}
                className={glassBtn}
              >
                Home
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
