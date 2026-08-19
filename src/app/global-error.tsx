"use client";

// Last-resort boundary: catches crashes in the root layout itself, which the
// per-route error.tsx can't reach. It replaces the whole document, so it must
// render its own <html>/<body> and can't rely on the app's CSS. Keep it dead
// simple — just get the booth back on its feet with a full reload.

import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[booth] root crash, reloading:", error);
    const timer = setTimeout(() => window.location.reload(), 1500);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <html lang="en">
      <body
        onClick={() => window.location.reload()}
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#043371",
          color: "#f7f1e8",
          fontFamily: "system-ui, sans-serif",
          fontSize: "clamp(24px, 4vw, 44px)",
          fontWeight: 900,
          textAlign: "center",
          padding: "40px",
          userSelect: "none",
        }}
      >
        Just a moment…
      </body>
    </html>
  );
}
