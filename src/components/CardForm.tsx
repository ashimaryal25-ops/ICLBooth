"use client";

import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

const MAX_NAME_LENGTH = 28;

export interface CardFormValues {
  name: string;
  selfDescription: string;
}

interface CardFormProps {
  isGenerating: boolean;
  photoReady?: boolean;
  mediaSlot?: ReactNode;
  onSubmit: (values: CardFormValues) => void;
}

export function CardForm({ isGenerating, photoReady = true, mediaSlot, onSubmit }: CardFormProps) {
  const [name, setName] = useState("");
  const [selfDescription, setSelfDescription] = useState("");

  const canSubmit = useMemo(
    () => photoReady && name.trim().length > 0 && selfDescription.trim().length >= 8,
    [photoReady, name, selfDescription],
  );

  return (
    <form
      className="h-full min-h-0"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit({
          name: name.trim(),
          selfDescription: selfDescription.trim(),
        });
      }}
    >
      <div className="card-setup-frame grid h-full min-h-0 overflow-hidden rounded-[10px] border border-black/20 bg-[#fffaf2] shadow-[0_8px_24px_rgba(78,38,9,0.18)] lg:grid-cols-[minmax(420px,0.9fr)_minmax(560px,1.1fr)]">
        <section className="flex min-h-0 min-w-0 flex-col border-b border-black/12 bg-[#f6eee2] p-4 lg:border-r lg:border-b-0">
          <div className="min-h-0 flex-1">{mediaSlot}</div>
          <div className="mt-3 grid shrink-0 grid-cols-3 divide-x divide-black/12 border-t border-black/12 pt-3 text-left">
            <div className="pr-3">
              <strong className="block text-sm text-[#1b1a17]">1. Take a photo</strong>
              <span className="mt-1 block text-xs leading-4 text-[#6d6255]">Face the camera screen.</span>
            </div>
            <div className="px-3">
              <strong className="block text-sm text-[#1b1a17]">2. Tell us about you</strong>
              <span className="mt-1 block text-xs leading-4 text-[#6d6255]">A sentence or two is plenty.</span>
            </div>
            <div className="pl-3">
              <strong className="block text-sm text-[#1b1a17]">3. Create and print</strong>
              <span className="mt-1 block text-xs leading-4 text-[#6d6255]">Your card is made on the spot.</span>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col bg-[#fffaf2] p-4">
          <div className="mb-3 flex shrink-0 items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-[#1b1a17]">Create your card</h1>
              <p className="mt-1 text-sm font-semibold text-[#6d6255]" aria-live="polite">
                {!photoReady
                  ? "Take your photo, then complete both fields."
                  : "Complete both fields, then create your card."}
              </p>
            </div>
            <span className="shrink-0 border-l border-black/12 pl-4 text-right text-xs font-bold text-[#6d6255]">
              Gettysburg College
              <span className="block font-medium">Trading Card</span>
            </span>
          </div>

          <div className="shrink-0">
            <label className="grid gap-1 text-xs font-bold text-[#4f463c]" htmlFor="name">
              Name or nickname
              <input
                id="name"
                name="booth-guest-name"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(event) => setName(event.target.value.slice(0, MAX_NAME_LENGTH))}
                placeholder="Your name"
                className="h-12 rounded-[7px] border border-black/18 bg-white px-3 text-base font-semibold text-[#1b1a17] outline-none placeholder:text-[#a49787] focus:border-[var(--gc-orange)] focus:ring-2 focus:ring-[var(--gc-orange)]/20"
              />
            </label>
          </div>

          <label className="mt-3 grid shrink-0 gap-1 text-xs font-bold text-[#4f463c]" htmlFor="self-description">
            Describe yourself in 1-2 sentences
            <textarea
              id="self-description"
              value={selfDescription}
              onChange={(event) => setSelfDescription(event.target.value)}
              placeholder="What do you enjoy, make, lead, study, or help with?"
              className="card-description h-[112px] w-full resize-none rounded-[7px] border border-black/18 bg-white px-3 py-3 text-base font-medium leading-6 text-[#1b1a17] outline-none placeholder:text-[#a49787] focus:border-[var(--gc-orange)] focus:ring-2 focus:ring-[var(--gc-orange)]/20"
            />
          </label>

          <div className="mt-3 flex min-h-12 shrink-0 items-center justify-between gap-4 border-t border-black/12 pt-3">
            <p className="text-xs font-semibold text-[#6d6255]">
              A few clear sentences work best.
            </p>
            <button
              type="submit"
              disabled={!canSubmit || isGenerating}
              className="inline-flex h-12 min-w-[210px] items-center justify-center gap-2 rounded-[8px] bg-[var(--gc-orange)] px-6 text-base font-black text-white hover:bg-[#a94000] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isGenerating ? "Creating card" : "Create my card"}
              <ArrowRight size={19} />
            </button>
          </div>
        </section>
      </div>

      <style>{`
        @media (max-height: 820px) {
          .card-setup-frame { font-size: 14px; }
          .card-description { height: 86px; }
        }
      `}</style>
    </form>
  );
}
