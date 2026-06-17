"use client";

import { useState } from "react";
import { CardForm } from "@/components/CardForm";
import { CardPreview } from "@/components/CardPreview";
import { ImageUpload } from "@/components/ImageUpload";
import type { CardIdentity, CardRequest } from "@/lib/card-schema";
import { generateCardIdentity } from "@/lib/generate-card-client";

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

export default function Home() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [card, setCard] = useState<CardIdentity | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = async (request: CardRequest) => {
    setIsGenerating(true);
    const generated = await generateCardIdentity(request);
    setCard(generated.card);
    setIsGenerating(false);
  };

  return (
    <main className="min-h-screen px-5 py-4 text-[var(--gc-black)] sm:px-8 lg:h-dvh lg:overflow-hidden">
      <div className="mx-auto h-full max-w-[1440px]">
        <CardForm
          isGenerating={isGenerating}
          photoReady={Boolean(photo)}
          mediaSlot={
            <ImageUpload
              photo={photo}
              onUpload={setPhoto}
              onChooseAnother={() => setPhoto(null)}
              samplePhoto={samplePhoto}
            />
          }
          onSubmit={handleSubmit}
        />

        {card && photo && (
          <div className="mt-4 flex justify-center">
            <CardPreview card={card} photo={photo} />
          </div>
        )}
      </div>
    </main>
  );
}
