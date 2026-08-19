# ICLBooth

A self-contained photo-booth kiosk for Gettysburg College events. Guests can make an
AI-generated collectible trading card, print a classic photo-strip collage, or play a
built-in arcade game — all running offline on the booth computer, driving a DNP dye-sub
printer and a live camera mirror on a second screen.

<p align="center">
  <img src="docs/booth-instructions.gif" alt="ICLBooth walkthrough — the booth, and how to use the Card Generator, GBOOTH photo strips, and Ghost Runner" width="760">
</p>

## Demo

### Cardify — AI trading cards

<p align="center">
  <img src="docs/screenshots/cards-row.png" alt="Sample ICLBooth trading cards — Athletic Blue, Empathy Pastel, and the rarest Gettysburg Gold" width="900">
</p>

<p align="center"><sub><em>Sample templates — portraits shown as placeholders.</em></sub></p>

<p align="center">
  <a href="https://youtu.be/plPjsD-zhac">
    <img src="https://img.youtube.com/vi/plPjsD-zhac/hqdefault.jpg" alt="Watch the trading-card demo" width="480">
  </a>
  <br><sub>▶ Watch the trading-card demo (opens on YouTube)</sub>
</p>

### Photo collage

<p align="center">
  <img src="docs/screenshots/collage-frames.png" alt="Sample ICLBooth photo-strip frames — Doodle, Picnic, and Circuit" width="680">
</p>

<p align="center">
  <a href="https://youtu.be/tysyFMtXq5c">
    <img src="https://img.youtube.com/vi/tysyFMtXq5c/hqdefault.jpg" alt="Watch the photo-collage demo" width="480">
  </a>
  <br><sub>▶ Watch the photo-collage demo (opens on YouTube)</sub>
</p>

## Features

### Cardify — AI trading cards
Capture a portrait, write a one-line self-description, and get a generated card identity:
title, three scored traits, rarity, Campus Power, a "Known For" line, a special ability,
and a matching background template. Output is structured JSON validated with Zod, and
falls back to a deterministic local generator when no OpenAI key is set. The form supports
speech-to-text and an on-screen keyboard.

### Photo collage
The classic 2×6 strip flow: three-second countdown capture, plain-colour or custom-framed
strips, and drag-from-palette sticker decoration (emoji and image stickers, pinch to resize).
Every printed strip carries a QR code linking to the ICL lab site.

### Ghost Runner
A bundled arcade game (`public/ghost-runner/`). The home tile runs a muted, self-playing
attract build; tapping it goes fullscreen into the full game — Level 2, audio, and webcam
hand-tracking for gesture control — with a Home control back to the booth. It returns home
on its own after two minutes idle, and its assets are pre-warmed into the browser cache at
boot so the first tap starts instantly. High scores persist in a local leaderboard through
`/api/leaderboard` (`public/ghost-runner/leaderboard.json`).

### Camera mirror (second screen)
A live camera mirror runs on a second display (`public/camera-mirror.html`). Both the
trading-card capture and the collage drive it over a shared `iclbooth-mirror`
BroadcastChannel — countdown, capture trigger, and photo hand-off — with an `/api/mirror`
HTTP relay as fallback when BroadcastChannel isn't available. The mirror auto-prefers an
external USB webcam over the built-in camera and remembers a manually chosen device.

### Silent printing
Cards and collage strips both print without a browser dialog through a Windows print bridge
(`scripts/print-card.ps1`), sized for 4×6 DNP media.

### Local storage
Cards are saved under `.booth-storage/` as a PNG plus a SQLite metadata row (with print
status); printed collages are saved as PNGs in `.booth-storage/collage-print/`. Each is
capped at its newest 100 — the oldest are pruned as new ones arrive, so storage stays bounded.

### Kiosk session reset
After 30 seconds of inactivity the booth shows a "Still there?" prompt; with no response
within 15 more seconds it clears the guest's photo and card and returns to the home screen,
so nothing is left on-screen for the next person.

### One-click kiosk launch
`Start-ICLBooth.bat` builds if needed, starts the server, detects displays, and opens the
booth fullscreen on the primary monitor with the camera mirror on the second (skipped when
only one display is connected).

### Low-roll email alerts
`scripts/check-printer-media.ps1` reads the DNP's remaining prints and sends one email when
the roll drops below a threshold, re-arming when a fresh roll is loaded. Meant to run on a
schedule.

## Screenshots

The home screen — one tap each into the trading card, the photo collage, or the arcade game:

<p align="center">
  <img src="docs/screenshots/booth-home.png" alt="ICLBooth home screen with four tiles: trading card, photo collage, Ghost Runner, and a welcome panel" width="820">
</p>

**Cardify** — capture and describe, then the generated card:

| Capture & describe | Generated card |
| --- | --- |
| ![Card setup screen with photo, name and description fields, and an on-screen keyboard](docs/screenshots/booth-card-setup.png) | ![Finished trading card with title, traits, Campus Power, and special ability](docs/screenshots/booth-card-reveal.png) |

**Photo collage** — pick a layout, capture the strip, decorate, and print:

| Choose layout | Capture | Decorate | Finished strip |
| --- | --- | --- | --- |
| ![Layout picker for 2, 3, or 4 shots](docs/screenshots/booth-collage-layout.png) | ![Countdown capture view with four shot thumbnails](docs/screenshots/booth-collage-camera.png) | ![Decorate view with frame colours, filters, stickers, and frame themes](docs/screenshots/booth-collage-decorate.png) | ![Finished photo strip with Gettysburg College branding and a QR code](docs/screenshots/booth-collage-final.png) |

## How printing works — frontend vs. backend strips

The DNP prints a full 4×6 sheet and cuts it down the centre into two 2×6 strips. There are
two print paths:

- **Plain-colour strips** are composed in-app (`composePlainPrintSheet`): the captured strip
  is placed twice on the sheet with tuned outer/inner margins so the centre cut yields two
  equal strips. The inner margin is larger than the outer because the blade shaves the seam.
- **Framed strips** use pre-built artwork in `public/frames/print/` (`backend-*.png`): each is
  a finished 1200×1800 sheet with both strips, the pattern bled across the seam, and the
  printer's edge compensation baked in by hand. This path skips in-app compositing and only
  draws the photos and stickers on top.

That's why every frame ships as two files — the on-screen design in `public/frames/single/`
(what the guest sees and decorates) and the pre-compensated print sheet in
`public/frames/print/`. They're shaped differently on purpose: the print slots are squeezed
to cancel the printer's stretch, so photos are cropped to the on-screen shape and then
stretched into the print slot.

## Frame slots are auto-detected

Frame layouts aren't measured by hand. `scripts/generate-frame-manifest.mjs` reads every
frame PNG, finds the fully-transparent photo windows with a 4-connected connected-components
pass over the alpha channel, and measures the transparent bleed band at each edge. It writes
`src/data/frame-themes.json` — a generated manifest of ~3,600 lines covering 40 frame variants
across 13 themes — which the app loads at runtime via `src/data/frame-themes.ts`. Re-run
`node scripts/generate-frame-manifest.mjs` whenever a frame image changes; the JSON is
generated, never edited by hand.

## Hardware & installation

- **Booth computer** (Windows) running this app.
- **DNP DS-RX1** dye-sublimation printer, with the 2-inch centre cut enabled for strips.
- **Primary touchscreen** for the booth UI, plus a **second display** for the camera mirror.
- **Auxiliary decorative LCDs** driven by separate **Raspberry Pi** units — part of the
  physical installation, not this codebase.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · OpenAI Responses API ·
`better-sqlite3` · Zod · `html-to-image` · `qrcode` · `react-simple-keyboard`

## Setup

### Kiosk (one click, on the booth)

1. Run `setup-kiosk.ps1` once to install dependencies and create `.env.local` from `.env.example`.
2. Set `OPENAI_API_KEY` in `.env.local` (optional — the local fallback runs without it).
3. Double-click `Start-ICLBooth.bat`.

For a server-only launch without browser windows, use `start-kiosk.ps1`. Full hardware and
printer setup lives in [`KIOSK_SETUP.md`](KIOSK_SETUP.md).

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then create `.env.local` from
`.env.example`. Key settings:

- `OPENAI_API_KEY` / `OPENAI_MODEL` — card generation (blank key ⇒ local fallback).
- `ICLBOOTH_PRINTER_NAME` — target printer (blank ⇒ Windows default).
- `SMTP_*`, `ALERT_EMAIL_TO`, `ICLBOOTH_LOW_THRESHOLD`, `ICLBOOTH_ROLL_CAPACITY` — low-roll alerts.
- `NEXT_PUBLIC_DEV_CAMERA=1` — use the laptop webcam directly for testing, without the mirror window.

## Project layout

```txt
src/
  app/            routes + API (generate-card, local-cards, collage/print, mirror)
  components/     BoothApp, Cardify flow, PhotoCollage + photo-collage/ views
  hooks/          use-mirror-relay, use-sticker-gestures, use-speech-to-text
  lib/            card generation, local storage/DB/printer, photo-collage/ canvas
  data/           frame-themes (+ generated frame-themes.json)
public/
  frames/single/  on-screen frame art
  frames/print/   pre-compensated print sheets (backend-*)
  iclbooth/       brand assets            stickers/  ghost-runner/  cards/
  camera-mirror.html
scripts/          print-card.ps1, check-printer-media.ps1, generate-frame-manifest.mjs
Start-ICLBooth.* / setup-kiosk.ps1 / start-kiosk.ps1
```

Runtime data (`.booth-storage/`) and `.env.local` stay on the booth and are git-ignored.

## Privacy

Everything runs on the booth: the final PNG and metadata are stored locally. When
`OPENAI_API_KEY` is set, only the typed self-description is sent to OpenAI to generate the
card identity — no photo leaves the machine. Leave the key unset to run fully offline on the
local generator.

## Credits

- **Original photo-strip booth** — first written by **Chloe** as a standalone HTML/CSS/JS app.
- **Frame and sticker artwork** — designed by **Chloe**.
- **Ghost Runner** — arcade game by **Raiyat Haque**, including Level 2, audio,
  hand-tracking controls, visual instructions, and sensitivity work.
- **System design and implementation** — overall kiosk architecture, React photo-booth port,
  card-generation system, frame-selection and sticker software, print pipeline, and Ghost
  Runner's booth-camera integration — **Ashim Aryal**.
