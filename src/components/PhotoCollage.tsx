"use client";

/**
 * PhotoCollage — React port of Chloe's original GBOOTH photo-strip booth,
 * rendered in-app.
 *
 * Owns the view state, capture session and canvas compositing. The four screens
 * live in ./photo-collage, helpers in lib/photo-collage.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  CROP_ZOOM,
  DEFAULT_STRIP_COLOR,
  SKY,
  STRIP_GAP,
  STRIP_H,
  STRIP_PADDING_X,
  STRIP_PHOTO_W,
  STRIP_TOP_MARGIN,
  STRIP_W,
  VERTICAL_CROP_BIAS,
} from "@/lib/photo-collage/constants";
import { canvasFilter, composePlainPrintSheet, drawStickers, slotPhotoHeight, sleep } from "@/lib/photo-collage/canvas";
import type { CollageView, FilterName, PaletteDrag, PhotoCollageProps, Sticker } from "@/lib/photo-collage/types";
import { useStickerGestures } from "@/hooks/use-sticker-gestures";
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
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [paletteDrag, setPaletteDrag] = useState<PaletteDrag | null>(null);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sessionDone, setSessionDone] = useState(false);
  const [retakeNonce, setRetakeNonce] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [stripDataUrl, setStripDataUrl] = useState("");
  const [printSheetUrl, setPrintSheetUrl] = useState("");
  const [brandReady, setBrandReady] = useState(false);
  const [stripQrReady, setStripQrReady] = useState(false);

  const photosRef = useRef<HTMLCanvasElement[]>([]);
  // Bumped per capture run; a stale/overlapping loop checks this and bails.
  const captureRunRef = useRef(0);
  const decorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const brandImgRef = useRef<HTMLImageElement | null>(null);
  const stripQrImgRef = useRef<HTMLImageElement | null>(null);

  // The ICL mark is local, so drawing it cannot taint the printable canvas.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      brandImgRef.current = img;
      setBrandReady(true);
    };
    img.src = "/cardify/icl-logo.png";

    // Static QR code pointing to the ICL website
    QRCode.toDataURL("https://icl.sites.gettysburg.edu/", {
      margin: 1,
      width: 150,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        const qrImg = new Image();
        qrImg.onload = () => {
          stripQrImgRef.current = qrImg;
          setStripQrReady(true);
        };
        qrImg.src = url;
      })
      .catch(() => {});
  }, []);

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
    setStickers([]);
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
            // The camera hands back a mirrored (selfie) view; flip it back so
            // the stored shot is true-to-life and the strip does the mirroring.
            cx.translate(640, 0);
            cx.scale(-1, 1);
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

      // Cover-crop into the slot (no stretch), zoomed slightly (CROP_ZOOM) and
      // biased downward (VERTICAL_CROP_BIAS) to trim the empty ceiling the low
      // booth camera captures while keeping the face and torso.
      const targetAspect = photoW / photoH;
      let sw = src.width;
      let sh = src.width / targetAspect;
      if (sh > src.height) {
        sh = src.height;
        sw = src.height * targetAspect;
      }
      sw /= CROP_ZOOM;
      sh /= CROP_ZOOM;
      const sx = (src.width - sw) / 2;
      const sy = (src.height - sh) * VERTICAL_CROP_BIAS;

      ctx.save();
      // Clip so filters never bleed past the photo frame.
      ctx.beginPath();
      ctx.rect(STRIP_PADDING_X, y, photoW, photoH);
      ctx.clip();
      ctx.filter = canvasFilter(filter);
      // Mirror, like a real booth.
      ctx.translate(STRIP_PADDING_X + photoW, y);
      ctx.scale(-1, 1);
      ctx.drawImage(src, sx, sy, sw, sh, 0, 0, photoW, photoH);
      ctx.restore();
    }

    // Footer branding.
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 30px sans-serif";
    ctx.textAlign = "center";
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "2px";
    ctx.fillText("GETTYSBURG COLLEGE", STRIP_W / 2, STRIP_H - 206);
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";

    const brandImg = brandReady ? brandImgRef.current : null;
    if (brandImg) {
      const brandSize = 116;
      const brandX = STRIP_W - STRIP_PADDING_X - brandSize;
      const brandY = STRIP_H - 154;
      ctx.drawImage(brandImg, brandX, brandY, brandSize, brandSize);
    }

    const stripQrImg = stripQrReady ? stripQrImgRef.current : null;
    if (stripQrImg) {
      const qrSize = 116;
      const qrX = STRIP_PADDING_X;
      const qrY = STRIP_H - 154;
      ctx.drawImage(stripQrImg, qrX, qrY, qrSize, qrSize);
    }

    drawStickers(ctx, stickers);
  }, [bgColor, filter, stickers, brandReady, stripQrReady]);

  const {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    startPaletteDrag,
    movePaletteDrag,
    finishPaletteDrag,
  } = useStickerGestures({ decorCanvasRef, setStickers, setPaletteDrag });

  useEffect(() => {
    if (view !== "decor") return;
    renderStrip();
  }, [view, renderStrip]);

  const goFinal = async () => {
    const canvas = decorCanvasRef.current;
    if (!canvas) return;
    renderStrip();
    const imageDataUrl = canvas.toDataURL("image/png");
    setStripDataUrl(imageDataUrl);
    stopDevCamera();
    setView("final");

    // The saved file is the two-up 4×6 sheet, so one print yields two strips.
    const sheet = await composePlainPrintSheet(imageDataUrl, bgColor);
    setPrintSheetUrl(sheet ?? imageDataUrl);
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
          stickers={stickers}
          setStickers={setStickers}
          paletteDrag={paletteDrag}
          decorCanvasRef={decorCanvasRef}
          onCanvasPointerDown={onPointerDown}
          onCanvasPointerMove={onPointerMove}
          onCanvasPointerUp={onPointerUp}
          onPalettePointerDown={startPaletteDrag}
          onPalettePointerMove={movePaletteDrag}
          onPalettePointerUp={finishPaletteDrag}
          onBack={() => {
            resetShots();
            setView("camera");
          }}
          onContinue={() => void goFinal()}
        />
      )}

      {/* ================= FINAL ================= */}
      {view === "final" && (
        <FinalView
          stripDataUrl={stripDataUrl}
          printSheetUrl={printSheetUrl}
          onHome={() => {
            stopDevCamera();
            onExit();
          }}
        />
      )}
    </div>
  );
}
