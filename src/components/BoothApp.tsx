"use client";

import { useCallback, useState } from "react";
import { CardForm } from "@/components/CardForm";
import { CardPreview } from "@/components/CardPreview";
import { CardReveal } from "@/components/CardReveal";
import { ImageUpload } from "@/components/ImageUpload";
import type { CardIdentity, CardRequest } from "@/lib/card-schema";
import { createFallbackCard } from "@/lib/fallback-card";
import { generateCardIdentity } from "@/lib/generate-card-client";

type Step = "cardSetup" | "generating" | "reveal";

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
  const [step, setStep] = useState<Step>("cardSetup");
  const [photo, setPhoto] = useState<string | null>(null);
  const [card, setCard] = useState<CardIdentity | null>(null);
  const [isSampleCardOpen, setIsSampleCardOpen] = useState(false);

  const resetCardFlow = useCallback(() => {
    setStep("cardSetup");
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
    <main className="min-h-screen overflow-y-auto px-5 py-4 text-[var(--gc-black)] sm:px-8 lg:h-dvh lg:overflow-hidden">
      <div className="relative z-10 mx-auto h-full max-w-[1440px]">
        {step === "cardSetup" && (
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
            onGoHome={resetCardFlow}
          />
        )}
      </div>
    </main>
  );
}
