"use client";

// Talks to the CRT mirror window: sends countdown/capture requests over
// /api/mirror and polls for the captured photo.

import { useCallback, useEffect, useRef } from "react";
import { captureDevPhoto, isDevCamera } from "@/lib/dev-camera";

type MirrorEvent = Record<string, unknown> & { id?: number };

/**
 * Send/poll side of the camera relay. `requestMirrorPhoto()` resolves with the
 * photo the mirror window captured (or null after a 5s timeout). On a laptop
 * without the mirror window it falls back to the shared dev-camera stream.
 */
export function useMirrorRelay() {
  const lastRelayIdRef = useRef(0);
  const captureResolversRef = useRef(new Map<string, (photo: string | null) => void>());
  const mirrorChannelRef = useRef<BroadcastChannel | null>(null);

  const handleMirrorMessage = useCallback((data: Record<string, unknown>) => {
    if (
      data.type === "captured-photo" &&
      typeof data.requestId === "string" &&
      typeof data.dataUrl === "string"
    ) {
      captureResolversRef.current.get(data.requestId)?.(data.dataUrl);
    }
  }, []);

  const sendToMirror = useCallback((message: Record<string, unknown>) => {
    mirrorChannelRef.current?.postMessage(message);
    void fetch("/api/mirror", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "mirror", ...message }),
    }).catch(() => {});
  }, []);

  const stopCamera = useCallback(() => {
    sendToMirror({ type: "countdown", value: 0 });
  }, [sendToMirror]);

  const requestMirrorPhoto = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        // Laptop testing: capture straight from the shared stream instead of
        // asking the mirror window, which isn't running.
        if (isDevCamera()) {
          resolve(captureDevPhoto());
          return;
        }

        const requestId = crypto.randomUUID();
        const timeout = window.setTimeout(() => {
          captureResolversRef.current.delete(requestId);
          resolve(null);
        }, 5000);

        captureResolversRef.current.set(requestId, (photo) => {
          window.clearTimeout(timeout);
          captureResolversRef.current.delete(requestId);
          resolve(photo);
        });
        sendToMirror({ type: "capture-request", requestId });
      }),
    [sendToMirror],
  );

  useEffect(() => {
    // BroadcastChannel is the fast same-browser path; when it's unavailable the
    // /api/mirror relay poll below still delivers every event.
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("cardifybooth-mirror");
      mirrorChannelRef.current = channel;
      channel.onmessage = (event) => handleMirrorMessage(event.data || {});
    }

    let cancelled = false;
    const captureResolvers = captureResolversRef.current;

    const poll = async () => {
      try {
        const response = await fetch(`/api/mirror?role=kiosk&since=${lastRelayIdRef.current}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as { events?: MirrorEvent[] };
        for (const event of data.events ?? []) {
          lastRelayIdRef.current = Math.max(lastRelayIdRef.current, event.id ?? 0);
          handleMirrorMessage(event);
        }
      } catch {}

      if (!cancelled) window.setTimeout(poll, 200);
    };

    void poll();
    return () => {
      cancelled = true;
      captureResolvers.forEach((resolve) => resolve(null));
      captureResolvers.clear();
      mirrorChannelRef.current?.close();
      mirrorChannelRef.current = null;
      stopCamera();
    };
  }, [handleMirrorMessage, stopCamera]);

  return { sendToMirror, stopCamera, requestMirrorPhoto };
}
