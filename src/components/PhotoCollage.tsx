"use client";

/**
 * PhotoCollage — React port of Chloe's original GBOOTH photo-strip booth,
 * rendered in-app.
 *
 * Owns the view state, capture session and canvas compositing. The four screens
 * live in ./photo-collage, helpers in lib/photo-collage.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { findFrame, framesForCount } from "@/data/frame-themes";
import {
  CROP_ZOOM,
  DEFAULT_STRIP_COLOR,
  IMAGE_STICKERS,
  SKY,
  STRIP_GAP,
  STRIP_H,
  STRIP_PADDING_X,
  STRIP_PHOTO_W,
  STRIP_TOP_MARGIN,
  STRIP_W,
  VERTICAL_CROP_BIAS,
} from "@/lib/photo-collage/constants";
import {
  canvasFilter,
  composeFramePrintSheet,
  composePlainPrintSheet,
  drawPhotoInto,
  drawStickers,
  loadImage,
  paintFrameBleed,
  slotPhotoHeight,
  sleep,
} from "@/lib/photo-collage/canvas";
import type { CollageView, FilterName, PaletteDrag, PhotoCollageProps, Sticker } from "@/lib/photo-collage/types";
import { useStickerGestures } from "@/hooks/use-sticker-gestures";
import { useMirrorRelay } from "@/hooks/use-mirror-relay";
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
  // null = the plain background-colour strip. Anything else is one of the
  // custom frames; the two paths are independent all the way to the print sheet.
  const [frameKey, setFrameKey] = useState<string | null>(null);
  const [frameImg, setFrameImg] = useState<HTMLImageElement | null>(null);
  const [framePage, setFramePage] = useState(0);
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
  // Offscreen base under the stickers; repainted only on change, blitted per frame.
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderRafRef = useRef<number | null>(null);
  const brandImgRef = useRef<HTMLImageElement | null>(null);
  const stripQrImgRef = useRef<HTMLImageElement | null>(null);
  // PNG stickers preloaded, keyed by src for sync lookup in drawStickers.
  const stickerImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [stickerImgsReady, setStickerImgsReady] = useState(false);

  // --- Camera relay ---------------------------------------------------------
  const { sendToMirror, stopCamera, requestMirrorPhoto } = useMirrorRelay();

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

  // Preload the PNG stickers once so drawStickers can blit them synchronously.
  useEffect(() => {
    let remaining = IMAGE_STICKERS.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) setStickerImgsReady(true);
    };
    IMAGE_STICKERS.forEach(({ src }) => {
      const img = new Image();
      img.onload = () => {
        stickerImgsRef.current.set(src, img);
        done();
      };
      img.onerror = done;
      img.src = src;
    });
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
    setFrameKey(null);
    setFramePage(0);
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
      sendToMirror({ type: "mirror-start" });
      sendToMirror({ type: "mirror-ping" });
      await sleep(500);

      for (let i = 0; i < slots; i++) {
        for (let t = 3; t > 0; t--) {
          if (isStale()) return;
          setCountdown(t);
          sendToMirror({ type: "countdown", value: t });
          await sleep(1000);
        }
        if (isStale()) return;
        setCountdown(null);
        sendToMirror({ type: "countdown", value: 0 });

        const photo = await requestMirrorPhoto();
        if (isStale()) return;
        if (!photo) {
          setCameraError("Please check the camera screen and try again.");
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
            // The CRT relay sends its mirrored view; flip it back for the print.
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
  }, [view, slots, retakeNonce, requestMirrorPhoto, sendToMirror]);

  // --- Custom frames --------------------------------------------------------
  // Not every frame has a version for every photo count. If the guest switches
  // to a count this frame wasn't drawn for, fall back to the plain strip.
  const availableFrames = useMemo(() => framesForCount(slots), [slots]);
  const framePageCount = Math.max(1, Math.ceil(availableFrames.length / 5));
  const visibleFrames = useMemo(
    () => availableFrames.slice(framePage * 5, framePage * 5 + 5),
    [availableFrames, framePage],
  );
  const activeFrame = useMemo(
    () => (frameKey ? findFrame(frameKey, slots) : undefined),
    [frameKey, slots],
  );

  // Preload the on-screen frame art; the strip re-renders once it is decoded.
  useEffect(() => {
    if (!activeFrame) return;
    let cancelled = false;
    loadImage(activeFrame.single.src)
      .then((img) => {
        if (!cancelled) setFrameImg(img);
      })
      .catch(() => {
        if (!cancelled) setFrameImg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeFrame]);

  // --- Strip rendering (direct port of renderPhotoStripCanvas) --------------
  // Paint everything under the stickers into the offscreen base. Heavy pass,
  // split from the cheap sticker composite so drags stay smooth.
  const renderBase = useCallback(() => {
    let canvas = baseCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = STRIP_W;
      canvas.height = STRIP_H;
      baseCanvasRef.current = canvas;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const photos = photosRef.current;

    // Custom frame: photos sit behind the art, showing through its transparent
    // windows (plain-strip chrome below is skipped). The src check avoids drawing
    // a half-loaded previous theme; decoded because filenames have spaces.
    if (
      activeFrame &&
      frameImg &&
      decodeURIComponent(frameImg.src).endsWith(activeFrame.single.src)
    ) {
      const fx = STRIP_W / activeFrame.single.w;
      const fy = STRIP_H / activeFrame.single.h;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, STRIP_W, STRIP_H);
      paintFrameBleed(ctx, frameImg, activeFrame.single.bleed, STRIP_W, STRIP_H);
      activeFrame.single.slots.forEach((slot, i) => {
        const src = photos[i];
        if (!src) return;
        drawPhotoInto(
          ctx,
          src,
          { x: slot.x * fx, y: slot.y * fy, w: slot.w * fx, h: slot.h * fy },
          slot.w / slot.h,
          filter,
        );
      });
      ctx.drawImage(frameImg, 0, 0, STRIP_W, STRIP_H);
      return;
    }

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
  }, [bgColor, filter, brandReady, stripQrReady, activeFrame, frameImg]);

  // Gesture refs are created here and passed into useStickerGestures, so the
  // React Compiler treats them as plain component refs.
  const stickersRef = useRef<Sticker[]>([]);
  const gestureDirtyRef = useRef(false);

  /**
   * Blit the prepared base onto the visible canvas and stamp the stickers on
   * top. This is all a drag/pinch costs: one full-canvas copy plus a handful of
   * small sticker blits, with no photo re-cropping and no filter passes.
   */
  const composite = useCallback(() => {
    const canvas = decorCanvasRef.current;
    const base = baseCanvasRef.current;
    if (!canvas || !base) return;
    // Assigning width/height reallocates and clears the backing store, so only
    // do it when the size actually differs. STRIP_W/H are constant: once.
    if (canvas.width !== STRIP_W || canvas.height !== STRIP_H) {
      canvas.width = STRIP_W;
      canvas.height = STRIP_H;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(base, 0, 0);
    drawStickers(ctx, stickersRef.current, stickerImgsRef.current);
  }, []);

  /** Full repaint: rebuild the base, then composite. */
  const renderStrip = useCallback(() => {
    renderBase();
    composite();
  }, [renderBase, composite]);

  /**
   * Coalesce gesture repaints to one per animation frame, so a 120-240 Hz
   * digitiser cannot queue more canvas work than the display can retire.
   */
  const scheduleComposite = useCallback(() => {
    if (renderRafRef.current != null) return;
    renderRafRef.current = requestAnimationFrame(() => {
      renderRafRef.current = null;
      composite();
    });
  }, [composite]);

  // --- Sticker gestures (drag / pinch / palette) ----------------------------
  // This hook must be called after scheduleComposite (it takes it as an
  // argument) and before the render effects below that read stickersRef.
  const {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    startPaletteDrag,
    movePaletteDrag,
    finishPaletteDrag,
  } = useStickerGestures({
    decorCanvasRef,
    scheduleComposite,
    setStickers,
    setPaletteDrag,
    stickersRef,
    gestureDirtyRef,
  });

  // Rebuild the base whenever one of its inputs changes. Deliberately NOT
  // dependent on `stickers`: moving a sticker must never trigger this pass.
  useEffect(() => {
    if (view !== "decor") return;
    renderStrip();
  }, [view, renderStrip]);

  // Keyed on `stickers` alone: a gesture never calls setStickers until it ends,
  // so this can't clobber the live list mid-drag.
  useEffect(() => {
    stickersRef.current = stickers;
  }, [stickers]);

  // Cheap repaint when the committed sticker list changes (added, cleared, or a
  // gesture ended). Called directly rather than via rAF so the strip still
  // paints on a backgrounded tab.
  useEffect(() => {
    if (view !== "decor") return;
    composite();
  }, [view, stickers, stickerImgsReady, composite]);

  // Drop any queued gesture frame when leaving Decorate.
  useEffect(() => {
    return () => {
      if (renderRafRef.current != null) {
        cancelAnimationFrame(renderRafRef.current);
        renderRafRef.current = null;
      }
    };
  }, [view]);

  const goFinal = async () => {
    const canvas = decorCanvasRef.current;
    if (!canvas) return;

    // Draw once synchronously so the captured strip reflects the final sticker
    // positions even if a coalesced (rAF) redraw was still pending.
    if (renderRafRef.current != null) {
      cancelAnimationFrame(renderRafRef.current);
      renderRafRef.current = null;
    }
    if (gestureDirtyRef.current) {
      gestureDirtyRef.current = false;
      setStickers(stickersRef.current);
    }
    renderStrip();
    const imageDataUrl = canvas.toDataURL("image/png");
    setStripDataUrl(imageDataUrl);
    stopCamera();
    setView("final");

    // The saved file is the two-up 4×6 sheet, so one print yields two strips.
    // Custom frames ship as ready-made sheets with the pattern already bled
    // across the centre seam; the plain strip is composed here instead.
    const sheet = activeFrame
      ? await composeFramePrintSheet(
          activeFrame,
          filter,
          stickersRef.current,
          photosRef.current,
          stickerImgsRef.current,
        )
      : await composePlainPrintSheet(imageDataUrl, bgColor);
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
            stopCamera();
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
          setFrameKey={setFrameKey}
          framePage={framePage}
          setFramePage={setFramePage}
          framePageCount={framePageCount}
          visibleFrames={visibleFrames}
          activeFrame={activeFrame}
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
            stopCamera();
            onExit();
          }}
        />
      )}
    </div>
  );
}
