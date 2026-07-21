"use client";

import { Camera, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { isDevCamera } from "@/lib/dev-camera";
import { useMirrorRelay } from "@/hooks/use-mirror-relay";

interface ImageUploadProps {
  photo: string | null;
  onUpload: (photo: string) => void;
  onChooseAnother: () => void;
  onViewSample: () => void;
  samplePhoto: string;
}

export function ImageUpload({ photo, onUpload, onChooseAnother, onViewSample, samplePhoto }: ImageUploadProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const { sendToMirror, requestMirrorPhoto } = useMirrorRelay();

  const startCamera = useCallback(() => {
    // Optimistic, like the collage flow: enable capture immediately instead of waiting
    // for a `mirror-ready` handshake. That event is easy to miss (the relay can rotate
    // or dedupe it out, or it arrives after a fixed timeout), which left the button
    // stuck disabled. If the mirror really isn't there, the capture-request times out
    // and surfaces the error at capture time — same as the collage.
    if (isDevCamera()) {
      return;
    }

    sendToMirror({ type: "mirror-start" });
    sendToMirror({ type: "mirror-ping" });
  }, [sendToMirror]);

  useEffect(() => {
    window.setTimeout(startCamera, 0);
  }, [startCamera]);

  useEffect(() => {
    sendToMirror({ type: "countdown", value: countdown ?? 0 });
  }, [countdown, sendToMirror]);

  useEffect(() => {
    if (countdown === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (countdown === 1) {
        setCountdown(null);
        // If the shot doesn't come back, just drop the pending request so the guest
        // can try again — no latching into a disabled state.
        void requestMirrorPhoto().then((dataUrl) => {
          if (dataUrl) onUpload(dataUrl);
        });
        return;
      }

      setCountdown(countdown - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown, onUpload, requestMirrorPhoto]);

  if (photo) {
    return (
      <section className="mx-auto grid w-full max-w-lg content-start justify-items-center gap-3 lg:max-w-none">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-[10px] bg-[var(--gc-black)] shadow-[0_4px_16px_rgba(112,54,0,0.22)]">
          <img
            src={photo}
            alt="Captured booth portrait"
            className="h-full w-full object-cover"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            onChooseAnother();
            window.setTimeout(() => startCamera(), 0);
          }}
          className="flex h-12 w-fit items-center justify-center gap-2.5 rounded-full bg-white px-10 text-base font-bold text-[#1b1a17] shadow-[0_3px_12px_rgba(112,54,0,0.16)] transition hover:bg-[#fff6ea]"
        >
          <RefreshCw size={19} />
          Retake photo
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto grid h-full min-h-0 w-full max-w-lg content-start gap-2.5 lg:max-w-none">
      <div className="overflow-hidden rounded-[10px] bg-white p-2.5 shadow-[0_3px_12px_rgba(112,54,0,0.16)]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[6px] bg-[#efece6]">
          <div className="grid h-full place-items-center p-6">
            <div className="max-w-sm text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[6px] border border-[var(--gc-orange)]/24 bg-white text-[var(--gc-orange)]">
                <Camera size={28} />
              </div>
              <p className="mt-4 text-xl font-black text-[var(--gc-black)]">Look at the camera</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--gc-gray)]">
                Your photo will appear here after the countdown.
              </p>
            </div>
          </div>

          {countdown !== null && countdown > 0 && (
            <div className="absolute inset-0 grid place-items-center bg-black/30 text-white" role="status" aria-live="assertive">
              <span className="text-8xl font-black tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {countdown}
              </span>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCountdown(3)}
        disabled={countdown !== null}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#c25a1f] text-base font-bold text-white shadow-[0_3px_12px_rgba(112,54,0,0.24)] transition hover:bg-[#a84c17] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Camera size={20} />
        {countdown !== null ? "Ready..." : "Take Picture"}
      </button>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => onUpload(samplePhoto)}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-white/75 text-base font-semibold text-[#1b1a17] shadow-[0_3px_12px_rgba(112,54,0,0.14)] transition hover:bg-white"
        >
          Use sample
        </button>

        <button
          type="button"
          onClick={onViewSample}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-white/75 text-base font-semibold text-[#1b1a17] shadow-[0_3px_12px_rgba(112,54,0,0.14)] transition hover:bg-white"
        >
          See sample card
        </button>
      </div>
    </section>
  );
}
