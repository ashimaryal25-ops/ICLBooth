"use client";

import { Download, Home, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CardPreview } from "@/components/CardPreview";
import type { CardIdentity } from "@/lib/card-schema";
import { renderCardAsPng } from "@/lib/export-card";
import { saveLocalCardPrint } from "@/lib/save-local-card";

interface CardRevealProps {
  card: CardIdentity;
  cardId: string | null;
  photo: string;
  onRestart: () => void;
  onGoHome: () => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function CardReveal({ card, cardId, photo, onRestart, onGoHome }: CardRevealProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const renderedPngRef = useRef<string | null>(null);
  const hasPreparedRef = useRef(false);
  const [exportError, setExportError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Render the PNG once, shortly after the card paints, then file it in the
  // booth's local store so the kiosk keeps a copy of everything it produced.
  useEffect(() => {
    if (!cardRef.current || hasPreparedRef.current) {
      return;
    }

    setSaveStatus(cardId ? "saving" : "idle");

    const timer = window.setTimeout(async () => {
      if (hasPreparedRef.current || !cardRef.current) {
        return;
      }

      hasPreparedRef.current = true;

      try {
        const imageDataUrl = await renderCardAsPng(cardRef.current);
        renderedPngRef.current = imageDataUrl;
        setIsReady(true);

        if (cardId) {
          try {
            await saveLocalCardPrint({ id: cardId, card, imageDataUrl });
            setSaveStatus("saved");
          } catch {
            setSaveStatus("error");
          }
        }
      } catch {
        setSaveStatus("error");
        setExportError(true);
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [card, cardId]);

  function downloadCard() {
    const dataUrl = renderedPngRef.current;
    if (!dataUrl) return;

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${card.displayName.replace(/\s+/g, "-").toLowerCase()}-card.png`;
    link.click();
  }

  return (
    <section className="relative mx-auto flex h-full w-full items-center justify-center gap-16">
      <button
        type="button"
        onClick={onGoHome}
        className="absolute left-6 top-6 z-10 flex h-[132px] w-[132px] flex-col items-center justify-center gap-1.5 rounded-full border-4 border-white text-[13px] font-black uppercase tracking-[1px] text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)] transition-transform hover:scale-105 active:scale-95"
        style={{ background: "#043371" }}
      >
        <Home size={38} strokeWidth={2.2} />
        Home
      </button>

      <div ref={cardRef} className="shrink-0">
        <CardPreview card={card} photo={photo} />
      </div>

      <div className="flex flex-col items-center gap-8">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--gc-gray)]">
            Finished
          </p>
          <h2 className="mt-1 text-3xl font-black text-[var(--gc-black)]">
            Your card is ready
          </h2>
        </div>

        <button
          type="button"
          onClick={downloadCard}
          disabled={!isReady}
          className="flex h-[140px] w-[140px] flex-col items-center justify-center gap-1.5 rounded-full border-4 border-white text-[15px] font-black uppercase tracking-[1px] text-white shadow-[0_10px_24px_rgba(0,0,0,0.25)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-70"
          style={{ background: "#cc4e00" }}
        >
          <Download size={36} strokeWidth={2.2} />
          {isReady ? "Save" : "Preparing…"}
        </button>

        <button
          type="button"
          onClick={onRestart}
          className="flex h-[132px] w-[132px] flex-col items-center justify-center gap-1.5 rounded-full border-4 border-white px-2 text-[13px] font-black uppercase tracking-[0.5px] text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)] transition-transform hover:scale-105 active:scale-95"
          style={{ background: "#043371" }}
        >
          <RotateCcw size={32} strokeWidth={2.2} />
          <span className="w-full text-center leading-[1.1]">New Card</span>
        </button>

        {saveStatus === "error" && !exportError && (
          <p className="max-w-[280px] text-center text-sm font-bold text-[var(--gc-gray)]">
            Saved to this screen only — the booth copy failed.
          </p>
        )}

        {exportError && (
          <p className="max-w-[280px] rounded-md bg-black/60 px-4 py-2 text-center text-sm font-bold text-[#ff9a9a]">
            Could not prepare the image. Try again.
          </p>
        )}
      </div>
    </section>
  );
}
