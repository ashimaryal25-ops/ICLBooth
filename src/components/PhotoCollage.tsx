"use client";

/**
 * PhotoCollage — React port of Chloe's original GBOOTH photo-strip booth,
 * rendered in-app.
 *
 * Owns the view state, capture session and canvas compositing. The four screens
 * live in ./photo-collage, helpers in lib/photo-collage.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_STRIP_COLOR,
  SKY,
  STRIP_GAP,
  STRIP_H,
  STRIP_PADDING_X,
  STRIP_PHOTO_W,
  STRIP_TOP_MARGIN,
  STRIP_W,
} from "@/lib/photo-collage/constants";
import { canvasFilter, slotPhotoHeight, sleep } from "@/lib/photo-collage/canvas";
import type { CollageView, FilterName, PhotoCollageProps } from "@/lib/photo-collage/types";
import { captureDevPhoto, startDevCamera, stopDevCamera } from "@/lib/dev-camera";
import { CameraView } from "@/components/photo-collage/CameraView";
import { DecorView } from "@/components/photo-collage/DecorView";
import { FinalView } from "@/components/photo-collage/FinalView";
import { LayoutView } from "@/components/photo-collage/LayoutView";

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
        <LayoutView onExit={onExit} onPick={startSession} />
      )}

      {/* ================= CAMERA ================= */}
      {view === "camera" && (
        <CameraView
          slots={slots}
          previews={previews}
          countdown={countdown}
          cameraError={cameraError}
          sessionDone={sessionDone}
          onBack={() => {
            stopDevCamera();
            setView("layout");
          }}
          onRetakeAll={retakeAll}
          onContinue={() => setView("decor")}
        />
      )}

      {/* ================= DECORATE ================= */}
      {view === "decor" && (
        <DecorView
          bgColor={bgColor}
          setBgColor={setBgColor}
          filter={filter}
          setFilter={setFilter}
          decorCanvasRef={decorCanvasRef}
          onBack={() => {
            resetShots();
            setView("camera");
          }}
          onContinue={goFinal}
        />
      )}

      {/* ================= FINAL ================= */}
      {view === "final" && (
        <FinalView
          stripDataUrl={stripDataUrl}
          onHome={() => {
            stopDevCamera();
            onExit();
          }}
        />
      )}
    </div>
  );
}
