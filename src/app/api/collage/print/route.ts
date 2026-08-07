import { mkdir, readdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { printLocalCardPng } from "@/lib/local-card-printer";
import { decodePngDataUrl } from "@/lib/png-data-url";

export const runtime = "nodejs";

const printCollageSchema = z.object({
  imageDataUrl: z.string().startsWith("data:image/png;base64,"),
});

const storageRoot = path.join(process.cwd(), ".booth-storage");
const collagePrintDir = path.join(storageRoot, "collage-print");
const maxCollagePrints = 100;

// Unlike cards, collages have no DB — they're just PNGs in collage-print/, which
// would otherwise grow with every print. Keep the newest 100 by mtime.
async function enforceCollageCacheLimit() {
  const names = (await readdir(collagePrintDir).catch(() => [])).filter((name) =>
    name.endsWith(".png"),
  );
  if (names.length <= maxCollagePrints) return;

  const files = await Promise.all(
    names.map(async (name) => {
      const full = path.join(collagePrintDir, name);
      return { full, mtime: (await stat(full)).mtimeMs };
    }),
  );
  files.sort((a, b) => b.mtime - a.mtime);
  await Promise.all(files.slice(maxCollagePrints).map((f) => unlink(f.full).catch(() => {})));
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = printCollageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid collage print request." }, { status: 400 });
  }

  try {
    await mkdir(collagePrintDir, { recursive: true });

    const pngBuffer = decodePngDataUrl(parsed.data.imageDataUrl);
    const imagePath = path.join(collagePrintDir, `collage-${crypto.randomUUID()}.png`);

    await writeFile(imagePath, pngBuffer);
    await enforceCollageCacheLimit();

    const result = await printLocalCardPng(imagePath, {
      jobName: "ICLBooth collage",
      mode: "DoubleStrip4x6",
    });

    return NextResponse.json({
      ok: true,
      printerName: result.printerName,
    });
  } catch (error) {
    console.error("Could not print collage.", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not send collage to the kiosk printer.",
      },
      { status: 500 },
    );
  }
}
