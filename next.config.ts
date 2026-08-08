import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        // The app's HTML document is never cacheable. The booth updates frequently
        // and every rebuild deletes the old hashed CSS/JS chunks; if a browser
        // ever serves a stale copy of the page it references chunks that no longer
        // exist, which renders as a broken, unstyled UI (no layout, missing tiles).
        // Next.js's default for static pages (s-maxage=31536000) does not prevent
        // this, so force the browser to re-fetch the document every time.
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        // The camera mirror is opened in its own Chrome profile and rarely changes,
        // but serve it fresh too so a stale mirror page can never linger.
        source: "/camera-mirror.html",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        // The leaderboard snapshot is rewritten by the API on every save, so the
        // browser must always re-read it instead of serving a stale cached copy.
        source: "/ghost-runner/leaderboard.json",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        // Ghost Runner's media never changes between builds and the booth warms it
        // into the browser cache at boot, so the game only re-fetches on a miss.
        source: "/ghost-runner/Assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Versioned game entry files (game.js is bumped with ?v= on each release);
        // a day-long cache is safe and keeps the on-tap load snappy.
        source: "/ghost-runner/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default nextConfig;
