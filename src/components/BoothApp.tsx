"use client";

import { Home } from "lucide-react";
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

// Two builds of Ghost Runner. The home-screen tile runs the self-playing
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
  const [isSampleCardOpen, setIsSampleCardOpen] = useState(false);
  const [isGameFullscreen, setIsGameFullscreen] = useState(false);
  const [gameSrc, setGameSrc] = useState(ATTRACT_SRC);
  const gamePanelRef = useRef<HTMLDivElement>(null);
  const gameFrameRef = useRef<HTMLIFrameElement>(null);

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

  // Warm Ghost Runner's game assets into the browser HTTP cache at boot so the
  // first tap starts from cache instead of re-downloading every GIF/video/sound.
  // Only the bytes are fetched — the game document is NOT loaded or run until the
  // guest taps the tile, so there's no background rendering or camera use.
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
      // tile remains playable when that happens.
    }
  }, []);

  const leaveGameForHome = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }, []);

  const resetCardFlow = useCallback(() => {
    setStep("cardSetup");
    setPhoto(null);
    setCard(null);
    setIsSampleCardOpen(false);
  }, []);

  const resetToChooser = useCallback(() => {
    setStep("choose");
    setPhoto(null);
    setCard(null);
    setIsSampleCardOpen(false);
  }, []);

  const handleGenerate = useCallback(
    async (request: CardRequest) => {
      if (!photo) {
        return;
      }

      // Hold the loader on screen for a beat even when the fallback returns
      // instantly, otherwise the card appears before the guest has looked up.
      const startedAt = performance.now();
      setStep("generating");
      const generated = await generateCardIdentity(request);
      setCard(generated.card);

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
    >
      <div
        className={
          step === "choose" || step === "collage"
            ? "relative z-10 h-full w-full"
            : "relative z-10 mx-auto h-full max-w-[1440px]"
        }
      >
        {step === "choose" && (
          <section className="choice-stage grid h-full w-full grid-cols-1 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setStep("cardSetup")}
              className="group grid place-items-center p-10 text-center transition-all hover:brightness-110 active:brightness-95"
            >
              <span className="max-w-xs">
                <span className="block text-sm font-black uppercase tracking-[0.2em] text-white/80">
                  Gettysburg College
                </span>
                <span className="mt-2 block text-4xl font-black text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.3)]">
                  Trading Card
                </span>
                <span className="mt-3 block text-base font-semibold leading-6 text-white/90">
                  Snap a portrait and turn it into a collectible card.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStep("collage")}
              className="group grid place-items-center p-10 text-center transition-all hover:brightness-110 active:brightness-95"
            >
              <span className="max-w-xs">
                <span className="block text-sm font-black uppercase tracking-[0.2em] text-white/80">
                  Keepsake
                </span>
                <span className="mt-2 block text-4xl font-black text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.3)]">
                  Photo Strip
                </span>
                <span className="mt-3 block text-base font-semibold leading-6 text-white/90">
                  Build a classic photo booth strip to take home.
                </span>
              </span>
            </button>

            {/* Ghost Runner runs live in its tile: the attract build plays itself
                behind a transparent catcher that promotes a tap to fullscreen. */}
            <div ref={gamePanelRef} className="group relative overflow-hidden bg-[#0a0a1a]">
              <iframe
                ref={gameFrameRef}
                src={gameSrc}
                title="Ghost Runner Game"
                allow="camera; fullscreen"
                allowFullScreen
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
              {/* The attract build paints its own START button, so this is a
                  transparent catcher: it shows that button through, but keeps
                  taps off the iframe (which would start the attract game in the
                  tile instead of going fullscreen). */}
              {!isGameFullscreen && (
                <button
                  type="button"
                  onClick={toggleGameFullscreen}
                  aria-label="Play Ghost Runner full screen"
                  className="absolute inset-0 z-20 h-full w-full cursor-pointer bg-transparent"
                />
              )}
            </div>
          </section>
        )}

        {step === "collage" && <PhotoCollage onExit={resetToChooser} />}

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

        {step === "generating" && (
          <section className="grid h-full min-h-0 place-items-center">
            <div className="w-full max-w-[320px]">
              <div className="card-build-preview">
                <div className="card-build-topline" />
                <div className="card-build-photo">
                  <div className="card-build-scan" />
                </div>
                <div className="grid gap-2">
                  <div className="card-build-bar sk" />
                  <div className="card-build-bar sk" />
                  <div className="card-build-bar card-build-progress" />
                </div>
              </div>
              <p className="mt-4 text-center text-lg font-black text-[var(--gc-black)]" role="status">
                Creating your card…
              </p>
            </div>
          </section>
        )}

        {step === "reveal" && card && photo && (
          <CardReveal
            card={card}
            photo={photo}
            onRestart={resetCardFlow}
            onGoHome={resetToChooser}
          />
        )}
      </div>
    </main>
  );
}
