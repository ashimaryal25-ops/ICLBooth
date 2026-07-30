import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { formatKnownFor, type CardIdentity } from "@/lib/card-schema";
import { decodePngDataUrl } from "@/lib/png-data-url";
import { insertLocalCardRecord, type LocalCardRecord } from "@/lib/local-card-db";

const storageRoot = path.join(process.cwd(), ".booth-storage");
const cardsDir = path.join(storageRoot, "cards");
const cardLifetimeMs = 24 * 60 * 60 * 1000;

function getTraitScores(card: CardIdentity) {
  return Object.fromEntries(
    Object.entries(card.stats).filter(([label]) => label !== "Campus Power"),
  );
}

export async function saveLocalCard(params: {
  id: string;
  card: CardIdentity;
  imageDataUrl: string;
}) {
  await mkdir(cardsDir, { recursive: true });

  const pngBuffer = decodePngDataUrl(params.imageDataUrl);

  const cardPngPath = `cards/${params.id}.png`;
  const absolutePngPath = path.join(storageRoot, cardPngPath);

  await writeFile(absolutePngPath, pngBuffer);

  const createdAt = new Date();

  const record: LocalCardRecord = {
    id: params.id,
    displayName: params.card.displayName,
    rarity: params.card.rarity,
    traitScores: getTraitScores(params.card),
    campusPower: params.card.stats["Campus Power"],
    knownFor: formatKnownFor(params.card.description),
    specialAbility: params.card.specialAbility,
    cardPngPath,
    cardUrl: `/api/local-cards/${params.id}`,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + cardLifetimeMs).toISOString(),
  };

  insertLocalCardRecord(record);

  return record;
}
