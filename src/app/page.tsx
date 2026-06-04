"use client";

import { useState } from "react";
import { ImageUpload } from "@/components/ImageUpload";

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

  return (
    <main className="min-h-screen px-5 py-8 text-[var(--gc-black)] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--gc-orange)]">
          Gettysburg College Edition
        </p>
        <h1 className="mt-2 text-3xl font-black text-[var(--gc-blue)]">
          CardifyBooth
        </h1>

        <div className="mt-6">
          <ImageUpload
            photo={photo}
            onUpload={setPhoto}
            onChooseAnother={() => setPhoto(null)}
            samplePhoto={samplePhoto}
          />
        </div>

        {photo && (
          <p className="mt-4 text-sm font-semibold text-[var(--gc-gray)]">
            Photo captured — the card form comes next.
          </p>
        )}
      </div>
    </main>
  );
}
