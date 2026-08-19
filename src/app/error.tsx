"use client";

// Auto-healing error boundary for the booth. If anything throws during
// rendering — an unforeseen gesture edge case from 3+ simultaneous ghost
// touches, a bad camera frame, whatever — the guest should never see Next's
// raw "This page couldn't load" screen. Instead we show a calm booth-branded
// message and quietly reset to the home screen on our own.
//
// Loop guard: if resets keep failing in a tight window we escalate to a full
// page reload (fresh document), and if even that keeps failing we stop the
// auto-retry and wait for a tap, so the kiosk can't sit in a hot crash loop.

import { useEffect } from "react";

const WINDOW_MS = 15000; // rolling window for counting recent crashes
const RESET_LIMIT = 3; // in-place reset() attempts before escalating to reload
const RELOAD_LIMIT = 6; // reloads before we stop auto-retrying and wait for a tap

function reloadFresh() {
  try {
    sessionStorage.removeItem("booth_crash_times");
  } catch {}
  window.location.reload();
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log for the operator's console; guests never see this.
    console.error("[booth] recovered from a crash:", error);

    const now = Date.now();
    let history: number[] = [];
    try {
      history = JSON.parse(sessionStorage.getItem("booth_crash_times") || "[]");
    } catch {
      history = [];
    }
    // Keep only crashes inside the rolling window, then record this one.
    history = history.filter((t) => now - t < WINDOW_MS);
    history.push(now);
    try {
      sessionStorage.setItem("booth_crash_times", JSON.stringify(history));
    } catch {}

    const recentCount = history.length;

    // Crashing over and over — stop the auto-loop and wait for a human tap.
    if (recentCount > RELOAD_LIMIT) return;

    const escalateToReload = recentCount > RESET_LIMIT;
    const timer = setTimeout(
      () => (escalateToReload ? reloadFresh() : reset()),
      escalateToReload ? 1500 : 1200,
    );
    return () => clearTimeout(timer);
  }, [error, reset]);

  return (
    <main
      onClick={reloadFresh}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "18px",
        padding: "40px",
        textAlign: "center",
        background: "#043371",
        color: "#f7f1e8",
        fontFamily: "system-ui, sans-serif",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <div
        style={{
          fontSize: "clamp(28px, 5vw, 52px)",
          fontWeight: 900,
          letterSpacing: "1px",
        }}
      >
        Just a moment…
      </div>
      <div
        style={{
          fontSize: "clamp(16px, 2.4vw, 24px)",
          maxWidth: "640px",
          opacity: 0.9,
        }}
      >
        We&apos;re getting the booth ready for you again — or tap anywhere to
        start over.
      </div>
    </main>
  );
}
