"use client";

import { Home, Info } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardForm } from "@/components/CardForm";
import { CardPreview } from "@/components/CardPreview";
import { CardReveal } from "@/components/CardReveal";
import { ImageUpload } from "@/components/ImageUpload";
import { PhotoCollage } from "@/components/PhotoCollage";
import type { CardIdentity, CardRequest } from "@/lib/card-schema";
import { createFallbackCard } from "@/lib/fallback-card";
import { isDevCamera, startDevCamera, stopDevCamera } from "@/lib/dev-camera";
import { generateCardIdentity } from "@/lib/generate-card-client";

type Step = "choose" | "cardSetup" | "generating" | "reveal" | "collage";

// Two builds of Ghost Runner. The home-screen tile runs the older self-playing
// attract build (dimmed, with its own START overlay, no camera, no sound); going
// fullscreen swaps in Raiyat's full game with Level 2, audio and hand tracking.
const ATTRACT_SRC = "/ghost-runner/attract.html";
const GAME_SRC = "/ghost-runner/index.html";

const sampleCard = createFallbackCard({
  name: "Your Name",
  theme: "gettysburg",
  selfDescription: "I build quick prototypes and help my team finish under pressure.",
});

const samplePhoto =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#222222"/>
    <circle cx="400" cy="210" r="92" fill="#d8b98d"/>
    <path d="M240 540c25-130 97-205 160-205s135 75 160 205" fill="#043371"/>
    <rect x="0" y="455" width="800" height="145" fill="#3a312a"/>
    <path d="M80 120h180l-36 160H44z" fill="#cc4e00" opacity=".78"/>
    <path d="M540 90h180l36 160H576z" fill="#8fdbff" opacity=".76"/>
  </svg>`);

export function BoothApp() {
  const [step, setStep] = useState<Step>("choose");
  const [photo, setPhoto] = useState<string | null>(null);
  const [card, setCard] = useState<CardIdentity | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [isSampleCardOpen, setIsSampleCardOpen] = useState(false);
  const [isGameFullscreen, setIsGameFullscreen] = useState(false);
  const [gameSrc, setGameSrc] = useState(ATTRACT_SRC);
  const [showIdlePopup, setShowIdlePopup] = useState(false);
  const gamePanelRef = useRef<HTMLDivElement>(null);
  const gameFrameRef = useRef<HTMLIFrameElement>(null);
  // Bumped by children (e.g. the collage taking a shot) to signal "still in use"
  // when there are no pointer/key events because the guest is just posing.
  const [activityNonce, setActivityNonce] = useState(0);

  // 30-second idle timeout → shows a "Continue session?" popup.
  // If the user doesn't interact within 15s of the popup, reset to home.
  // Never fires on "choose" (home) or "generating" since there's nothing to timeout.
  useEffect(() => {
    if (step === "choose" || step === "generating") {
      return;
    }

    let idleTimer: ReturnType<typeof setTimeout>;
    let popupTimer: ReturnType<typeof setTimeout>;

    const resetToHome = () => {
      setShowIdlePopup(false);
      setPhoto(null);
      setCard(null);
      setCardId(null);
      setStep("choose");
    };

    const showPopup = () => {
      setShowIdlePopup(true);
      // 15s to respond or auto-reset
      popupTimer = setTimeout(() => resetToHome(), 15000);
    };

    const resetTimer = () => {
      setShowIdlePopup(false);
      clearTimeout(idleTimer);
      clearTimeout(popupTimer);
      idleTimer = setTimeout(showPopup, 30000);
    };

    const handleActivity = () => resetTimer();

    window.addEventListener("pointerdown", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);

    resetTimer();

    return () => {
      clearTimeout(idleTimer);
      clearTimeout(popupTimer);
      setShowIdlePopup(false);
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [step, activityNonce]);

  // The idle popup should never show on the home ("choose") or "generating"
  // screens. We decide that here on each render instead of storing it, which
  // stops the popup from flashing on-screen for a split second before the timer
  // clears it.
  const idlePopupVisible =
    step === "choose" || step === "generating" ? false : showIdlePopup;

  // Laptop testing only. On the kiosk the mirror window owns the camera and this
  // never runs, so the card and collage keep talking to the mirror as before.
  // Ghost Runner picks the stream up off window.__boothCamera instead of opening
  // a second one.
  useEffect(() => {
    if (!isDevCamera()) return;
    let cancelled = false;

    void startDevCamera().catch((error: unknown) => {
      if (cancelled) return;
      const name = error instanceof Error ? error.name : "unknown";
      const message = error instanceof Error ? error.message : String(error);
      // Surfaced loudly because a silent failure here looks identical to a
      // black camera, and OverconstrainedError/NotAllowedError need different fixes.
      console.error(`[dev-camera] ${name}: ${message}`);
    });

    return () => {
      cancelled = true;
      stopDevCamera();
    };
  }, []);

  useEffect(() => {
    // Single exit path for every way out of the game (Home button, Esc key, kiosk
    // policy): drop back to the attract build, which reloads clean and silent.
    const handleFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement === gamePanelRef.current;
      setIsGameFullscreen(isFullscreen);
      if (!isFullscreen) {
        setGameSrc(ATTRACT_SRC);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Warm Ghost Runner's game assets into the browser HTTP cache at boot so the
  // first tap starts from cache instead of re-downloading every GIF/video/sound.
  // Only the bytes are fetched — the game document is NOT loaded or run until the
  // guest taps quarter 3, so there's no background rendering or camera use.
  useEffect(() => {
    const warmUrls = [
      "/ghost-runner/index.html",
      // Keep the "?v=..." exactly as the HTML asks for it. The browser treats
      // "/style.css" and "/style.css?v=2" as two different files, so pre-loading
      // the wrong one is wasted — the game would still download the real one.
      "/ghost-runner/style.css?v=1",
      // Keep in sync with the <script> tags in index.html and attract.html.
      "/ghost-runner/game.js?v=1",
      "/ghost-runner/attract.html",
      "/ghost-runner/attract.js?v=1",
      "/ghost-runner/Assets/background animation 1.mp4",
      "/ghost-runner/Assets/background_lvl2.mp4",
      "/ghost-runner/Assets/game_background.mp4",
      "/ghost-runner/Assets/start_sound.wav",
      "/ghost-runner/Assets/Obstacle_hitting_sound.mp3",
      "/ghost-runner/Assets/jump.wav",
      "/ghost-runner/Assets/Score_20.mp3",
      "/ghost-runner/Assets/lvl2_bgsound.wav",
      "/ghost-runner/Assets/hand_pose_jump.png",
      "/ghost-runner/Assets/ghostgifani.gif",
      "/ghost-runner/Assets/enemyghost 1 gif ani.gif",
      "/ghost-runner/Assets/random ghost gif.gif",
      "/ghost-runner/Assets/bunny ani gif.gif",
      "/ghost-runner/Assets/squirl gift .gif",
      "/ghost-runner/Assets/tree animations gif.gif",
      "/ghost-runner/Assets/lvl2_enemy.gif",
      "/ghost-runner/Assets/lvl2_enemy2.gif",
    ];
    warmUrls.forEach((url) => void fetch(url).catch(() => {}));
  }, []);

  useEffect(() => {
    if (!isGameFullscreen) return;

    let timeout: ReturnType<typeof setTimeout>;

    const returnToHome = async () => {
      gameFrameRef.current?.contentWindow?.postMessage(
        { type: "ghost-runner:reset" },
        window.location.origin,
      );

      if (document.fullscreenElement === gamePanelRef.current) {
        await document.exitFullscreen();
      }
    };

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => void returnToHome(), 120000);
    };

    const handleGameActivity = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.source === gameFrameRef.current?.contentWindow &&
        event.data?.type === "ghost-runner:activity"
      ) {
        resetTimer();
      }
    };

    window.addEventListener("message", handleGameActivity);
    window.addEventListener("pointerdown", resetTimer);
    window.addEventListener("keydown", resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", handleGameActivity);
      window.removeEventListener("pointerdown", resetTimer);
      window.removeEventListener("keydown", resetTimer);
    };
  }, [isGameFullscreen]);

  const toggleGameFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement === gamePanelRef.current) {
        await document.exitFullscreen();
        return;
      }
      // Swap to the real game first, then go fullscreen. Browsers only allow
      // fullscreen as a direct result of the user's click, so this has to run
      // during the same tap that triggered it.
      setGameSrc(GAME_SRC);
      await gamePanelRef.current?.requestFullscreen();
    } catch {
      // Fullscreen can be blocked by browser or kiosk policy; the embedded
      // quarter remains playable when that happens.
    }
  }, []);

  const leaveGameForHome = useCallback(async () => {
    gameFrameRef.current?.contentWindow?.postMessage(
      { type: "ghost-runner:reset" },
      window.location.origin,
    );
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    setStep("choose");
  }, []);

  const resetCardFlow = useCallback(() => {
    setStep("cardSetup");
    setPhoto(null);
    setCard(null);
    setCardId(null);
    setIsSampleCardOpen(false);
  }, []);

  const resetToChooser = useCallback(() => {
    setStep("choose");
    setPhoto(null);
    setCard(null);
    setCardId(null);
    setIsSampleCardOpen(false);
  }, []);

  const handleGenerate = useCallback(
    async (request: CardRequest) => {
      if (!photo) {
        return;
      }

      const startedAt = performance.now();
      setStep("generating");
      const generated = await generateCardIdentity(request);
      setCard(generated.card);
      setCardId(generated.cardId);

      const elapsed = performance.now() - startedAt;
      if (elapsed < 1200) {
        await new Promise((resolve) => setTimeout(resolve, 1200 - elapsed));
      }

      setStep("reveal");
    },
    [photo],
  );

  return (
    <main
      className={
        step === "choose" || step === "collage"
          ? "relative h-dvh w-full overflow-hidden text-[var(--gc-black)]"
          : "min-h-screen overflow-y-auto px-5 py-4 text-[var(--gc-black)] sm:px-8 lg:h-dvh lg:overflow-hidden"
      }
      // The orange bg gradient backs the whole trading-card flow. The collage
      // keeps its sky-blue and the 4-quadrant home keeps its cream look.
      style={
        step === "cardSetup" || step === "generating" || step === "reveal"
          ? {
              backgroundImage: "url('/cardify/bg.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <div
        className={
          step === "choose" || step === "collage"
            ? "relative z-10 h-full w-full"
            : "relative z-10 mx-auto h-full max-w-[1440px]"
        }
      >
        {step === "choose" && (
          <section className="grid h-full w-full grid-cols-2 grid-rows-2">
            {/* Quarter 1 — Trading Card (gold-card art, jumps straight to the form).
                bg-contain so the tilted cards are never corner-cropped; the side bars are
                filled with a matching orange gradient so they blend with the artwork. */}
            <button
              type="button"
              onClick={() => setStep("cardSetup")}
              className="group relative flex items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat transition-all hover:brightness-105 active:brightness-95"
              style={{
                backgroundImage: "url('/cardify/home-bg.png')",
              }}
            >
              {/* All tile text (Trading Card, Gettysburg themed, Tap to start) is baked into home-bg.png. */}
            </button>

            {/* Quarter 2 — Photo Collage: the collage-strip mockup shown whole on a
                navy that matches the image's own background, so it reads seamlessly.
                The three labels are a CSS overlay (the baked-in text was misspelled
                and has been erased from the art). The wrapper shrink-wraps to the
                contained image, so each label stays pinned under its strip at any
                display aspect ratio. */}
            <button
              type="button"
              onClick={() => setStep("collage")}
              aria-label="Photo Collage — build a keepsake photo strip"
              className="group relative flex items-center justify-center overflow-hidden transition-all hover:brightness-110 active:brightness-95"
              style={{ backgroundColor: "#05225a" }}
            >
              <span className="relative inline-flex max-h-full max-w-full">
                <Image
                  src="/cardify/collage-tile.png"
                  alt=""
                  width={2906}
                  height={1440}
                  className="block max-h-full max-w-full object-contain"
                  sizes="50vw"
                />
                {[
                  { label: "2-Strip Collage", left: "20.3%" },
                  { label: "3-Strip Collage", left: "52.6%" },
                  { label: "4-Strip Collage", left: "82.4%" },
                ].map(({ label, left }) => (
                  <span
                    key={label}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-serif italic text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.35)]"
                    style={{
                      left,
                      top: "93.5%",
                      fontSize: "clamp(0.8rem, 1.7vw, 1.9rem)",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </span>
            </button>

            {/* Quarter 3 — Ghost Runner (live, running in-quadrant) */}
            <div ref={gamePanelRef} className="group relative overflow-hidden bg-[#0a0a1a]">
              <iframe
                ref={gameFrameRef}
                src={gameSrc}
                title="Ghost Runner Game"
                allow="camera; fullscreen"
                allowFullScreen
                onLoad={() => {
                  // Unmute only. Auto-starting here painted the tower start screen
                  // for one frame before the game took over, which read as a flicker;
                  // the guest taps once to start, which is Raiyat's own entry point.
                  if (document.fullscreenElement !== gamePanelRef.current) return;
                  gameFrameRef.current?.contentWindow?.postMessage(
                    { type: "ghost-runner:unmute" },
                    window.location.origin,
                  );
                }}
                className="absolute inset-0 h-full w-full border-0"
              />
              {isGameFullscreen && (
                <button
                  type="button"
                  onClick={leaveGameForHome}
                  className="absolute bottom-6 right-6 z-20 inline-flex h-24 items-center gap-4 rounded-[12px] border-2 border-white bg-[var(--gc-orange)] px-10 text-2xl font-black text-white shadow-[0_4px_12px_rgba(0,0,0,0.35)] transition-colors hover:bg-[#b94300] active:bg-[#963700]"
                >
                  <Home size={34} strokeWidth={2.5} />
                  Home
                </button>
              )}
              {/* The attract build paints its own dimmed START GAME button, so this
                  is a transparent catcher: it shows that button through, but keeps
                  taps off the iframe (which would start the old game in the tile
                  instead of going fullscreen). */}
              {!isGameFullscreen && (
                <button
                  type="button"
                  onClick={toggleGameFullscreen}
                  aria-label="Play Ghost Runner full screen"
                  className="absolute inset-0 z-20 h-full w-full cursor-pointer bg-transparent"
                />
              )}
            </div>

            {/* Quarter 4 — Description */}
            <div className="flex flex-col justify-between overflow-hidden bg-[#fffdf9] p-8 text-left">
              <div className="flex items-center gap-2.5">
                <Info size={38} strokeWidth={2.2} className="text-[var(--gc-orange)]" />
                <span className="text-2xl font-black text-[var(--gc-black)]">Welcome to CardifyBooth</span>
              </div>
              <div className="space-y-3 text-[var(--gc-gray)]">
                <p className="text-lg font-semibold leading-6">
                  Snap a portrait and our AI turns it into a collectible Gettysburg College trading card — printed on the spot.
                </p>
                <p className="text-lg font-semibold leading-6">
                  Want a keepsake strip instead? Build a photo collage. Waiting your turn? Play Ghost Runner.
                </p>
              </div>
              <p className="text-sm font-black uppercase tracking-[0.12em] text-[var(--gc-black)]/70">
                Tap a tile to start →
              </p>
            </div>
          </section>
        )}

        {step === "collage" && (
          <PhotoCollage
            onExit={() => setStep("choose")}
            onActivity={() => setActivityNonce((n) => n + 1)}
          />
        )}

        {/* Card-setup layout: photo panel left, white field bars right, circular
            CONTINUE button submits — all straight on the orange gradient with no
            white shell around it. */}
        {step === "cardSetup" && (
          <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2.5">
            <button
              type="button"
              onClick={resetToChooser}
              className="w-fit rounded-[30px] border border-black/25 bg-white/30 px-5 py-2 text-sm font-bold text-[#222] backdrop-blur-[4px] transition-all hover:bg-white/50 active:scale-95"
            >
              ← Back
            </button>

            <CardForm
              isGenerating={false}
              photoReady={Boolean(photo)}
              mediaSlot={
                <ImageUpload
                  photo={photo}
                  onUpload={setPhoto}
                  onChooseAnother={() => setPhoto(null)}
                  onViewSample={() => setIsSampleCardOpen(true)}
                  samplePhoto={samplePhoto}
                />
              }
              onSubmit={handleGenerate}
            />
          </section>
        )}

        {isSampleCardOpen && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-[rgba(34,34,34,0.48)] p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Sample card"
          >
            <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-[8px] border border-[#d7c9bb] bg-white p-4 shadow-[0_8px_24px_rgba(34,34,34,0.18)]">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-lg font-black text-[var(--gc-black)]">Sample card</h2>
                <button
                  type="button"
                  onClick={() => setIsSampleCardOpen(false)}
                  className="rounded-[6px] border border-[var(--gc-black)]/18 bg-white px-3 py-2 text-sm font-bold text-[var(--gc-black)] hover:bg-[var(--gc-alabaster)]"
                >
                  Close
                </button>
              </div>
              <div className="mx-auto max-w-[320px]">
                <CardPreview card={sampleCard} photo={samplePhoto} />
              </div>
            </div>
          </div>
        )}

        {/* "Creating your card" heading + three pulsing dots with a Pac-Man
            chasing them, all scrolling across as a marquee. */}
        {step === "generating" && (
          <section className="relative grid h-full min-h-0 place-items-center overflow-hidden">
            <style>{`
              @keyframes iclDot {
                0%, 80%, 100% { transform: scale(0.7); opacity: 0.45; }
                40%           { transform: scale(1);   opacity: 1; }
              }
              /* Whole loader drifts off the left edge, then re-enters from the right. */
              @keyframes iclMarquee {
                from { transform: translateX(calc(50vw + 100%)); }
                to   { transform: translateX(calc(-50vw - 100%)); }
              }
              /* Pac-Man is two stacked quarter-notched circles chomping in opposite
                 directions; the wrapper is scaleX(-1) so he faces left, chasing the
                 dots as the marquee travels. */
              @keyframes iclJawTop {
                from { transform: rotate(38deg); }
                to   { transform: rotate(-2deg); }
              }
              @keyframes iclJawBottom {
                from { transform: rotate(-38deg); }
                to   { transform: rotate(2deg); }
              }
              .icl-pacman { position: relative; width: 48px; height: 48px; transform: scaleX(-1); }
              .icl-pacman .jaw {
                position: absolute; inset: 0; width: 0; height: 0;
                border: 24px solid #f2c40d; border-radius: 50%;
                border-right-color: transparent;
              }
              .icl-pacman .jaw-top    { animation: iclJawTop 0.32s linear infinite alternate; }
              .icl-pacman .jaw-bottom { animation: iclJawBottom 0.32s linear infinite alternate; }
              .icl-pacman .eye {
                position: absolute; top: 9px; left: 22px; width: 6px; height: 6px;
                border-radius: 50%; background: #111; z-index: 1;
              }
            `}</style>
            <div
              className="flex flex-col items-center gap-7"
              style={{ animation: "iclMarquee 7s linear infinite" }}
              aria-hidden="true"
            >
              <h2 className="whitespace-nowrap text-center text-[56px] font-black uppercase leading-none tracking-[6px] text-black">
                Creating your card
              </h2>
              <div className="flex items-center gap-3.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-4 w-4 rounded-full bg-black"
                    style={{ animation: `iclDot 1.3s ${i * 0.18}s infinite ease-in-out` }}
                  />
                ))}
                <span className="ml-4 icl-pacman">
                  <span className="jaw jaw-top" />
                  <span className="jaw jaw-bottom" />
                  <span className="eye" />
                </span>
              </div>
            </div>
            <p className="sr-only">Making your card. Hold tight.</p>
          </section>
        )}

        {step === "reveal" && card && photo && (
          <CardReveal
            card={card}
            cardId={cardId}
            photo={photo}
            onRestart={resetCardFlow}
            onGoHome={resetToChooser}
          />
        )}
      </div>

      {/* Kiosk idle popup — appears after 30s of inactivity, auto-resets in 15s */}
      {idlePopupVisible && (
        <div
          className="fixed inset-0 z-[9999] grid place-items-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Session timeout"
          // Tapping anywhere on the overlay counts as activity and dismisses the popup
          onClick={() => setShowIdlePopup(false)}
        >
          <div
            className="flex flex-col items-center gap-6 rounded-[16px] border-2 border-white/30 bg-[var(--gc-orange)] px-12 py-10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[48px]">👋</span>
            <h2 className="text-3xl font-black text-white">Still there?</h2>
            <p className="max-w-[320px] text-center text-lg font-semibold text-white/90">
              Tap continue to keep your session going.
            </p>
            <button
              type="button"
              onClick={() => setShowIdlePopup(false)}
              className="mt-2 rounded-full border-2 border-white bg-white px-10 py-4 text-xl font-black uppercase tracking-wide text-[var(--gc-orange)] shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
