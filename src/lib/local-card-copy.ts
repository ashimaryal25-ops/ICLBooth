import localCardCopy from "@/data/local-card-copy.json";
import { z } from "zod";
import { cardSchema, type CardIdentity, type CardRequest } from "@/lib/card-schema";
import { chooseFallbackTemplateId, resolveTemplateId } from "@/lib/card-templates";

const copyEntrySchema = z.object({
  titles: z.array(z.string().min(2)).min(1),
  knownFor: z.array(z.string().min(4)).min(1),
  specialAbilities: z.array(z.string().min(2)).min(1),
});

const copyBankSchema = z.record(z.string().min(2), copyEntrySchema);

const copyBank = copyBankSchema.parse(localCardCopy);

export const localTraitNames = Object.keys(copyBank);

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "i",
  "in",
  "into",
  "is",
  "it",
  "like",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "them",
  "this",
  "to",
  "with",
]);

type RankedTrait = {
  name: string;
  score: number;
  evidenceScore: number;
};

export type LocalCardTrait = {
  name: string;
  score: number;
};

function stableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

function pickStable<T>(items: T[], seed: string) {
  return items[stableHash(seed) % items.length];
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function uniqueTokens(text: string) {
  return new Set(tokenize(text));
}

function buildTraitSearchText(trait: string) {
  const entry = copyBank[trait];

  return [
    trait,
    ...entry.titles,
    ...entry.knownFor,
    ...entry.specialAbilities,
  ].join(" ");
}

function scoreTraitAgainstDescription(trait: string, descriptionTokens: Set<string>, description: string) {
  const traitTokens = uniqueTokens(buildTraitSearchText(trait));
  const normalizedTrait = trait.toLowerCase();
  let evidenceScore = description.includes(normalizedTrait) ? 4 : 0;

  for (const token of descriptionTokens) {
    if (traitTokens.has(token)) {
      evidenceScore += 2;
    }
  }

  return evidenceScore;
}

function rankTraits(selfDescription: string, seed: string): RankedTrait[] {
  const normalizedDescription = selfDescription.toLowerCase();
  const descriptionTokens = uniqueTokens(selfDescription);

  return localTraitNames
    .map((trait, index) => {
      const evidenceScore = scoreTraitAgainstDescription(
        trait,
        descriptionTokens,
        normalizedDescription,
      );
      const tiebreaker = stableHash(`${seed}-${trait}`) % 4;

      return {
        name: trait,
        evidenceScore,
        sortScore: evidenceScore * 100 + tiebreaker - index * 0.001,
      };
    })
    .sort((a, b) => b.sortScore - a.sortScore)
    .slice(0, 3)
    .map((trait, index) => {
      const baseScore = [74, 70, 67][index] ?? 65;
      const score = Math.min(
        99,
        Math.max(60, baseScore + Math.min(18, trait.evidenceScore * 2) + (stableHash(`${seed}-${trait.name}-score`) % 5)),
      );

      return {
        name: trait.name,
        score,
        evidenceScore: trait.evidenceScore,
      };
    });
}

function normalizePresetTraits(traits: LocalCardTrait[] | undefined): RankedTrait[] | null {
  if (!traits || traits.length === 0) {
    return null;
  }

  const seenTraits = new Set<string>();
  const normalizedTraits: RankedTrait[] = [];

  for (const trait of traits) {
    if (!copyBank[trait.name] || seenTraits.has(trait.name)) {
      continue;
    }

    seenTraits.add(trait.name);
    normalizedTraits.push({
      name: trait.name,
      score: Math.min(99, Math.max(60, Math.round(trait.score))),
      evidenceScore: 0,
    });

    if (normalizedTraits.length === 3) {
      break;
    }
  }

  return normalizedTraits.length === 3 ? normalizedTraits : null;
}

function rarityFromCampusPower(campusPower: number): CardIdentity["rarity"] {
  if (campusPower >= 96) {
    return "Campus Myth";
  }

  if (campusPower >= 89) {
    return "Legend";
  }

  if (campusPower >= 80) {
    return "Epic";
  }

  if (campusPower >= 70) {
    return "Rare";
  }

  return "Common";
}

function cleanKnownFor(value: string) {
  return value
    .replace(/^known for\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim();
}

function fitText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").replace(/\.$/, "").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, maxLength + 1);
  const lastSpaceIndex = truncated.lastIndexOf(" ");

  return truncated
    .slice(0, lastSpaceIndex > 24 ? lastSpaceIndex : maxLength)
    .replace(/[,\s]+$/g, "")
    .trim();
}

function buildKnownFor(primaryTrait: string, seed: string) {
  const primary = copyBank[primaryTrait];
  const knownFor = cleanKnownFor(pickStable(primary.knownFor, `${seed}-known-for`));

  return fitText(knownFor, 54);
}

export function createLocalCard(input: CardRequest, traits?: LocalCardTrait[]): CardIdentity {
  const seed = `${input.name}-${input.selfDescription}`;
  const rankedTraits = normalizePresetTraits(traits) ?? rankTraits(input.selfDescription, seed);
  const primaryTrait = rankedTraits[0]?.name ?? localTraitNames[0];
  const primaryCopy = copyBank[primaryTrait];
  const traitStats = Object.fromEntries(
    rankedTraits.map((trait) => [trait.name, trait.score]),
  );
  const campusPower = Math.round(
    Object.values(traitStats).reduce((sum, value) => sum + value, 0) / rankedTraits.length,
  );
  const rarity = rarityFromCampusPower(campusPower);

  return cardSchema.parse({
    displayName: input.name,
    cardTitle: pickStable(primaryCopy.titles, `${seed}-title`),
    type: rankedTraits.map((trait) => trait.name),
    rarity,
    stats: {
      ...traitStats,
      "Campus Power": campusPower,
    },
    specialAbility: fitText(pickStable(primaryCopy.specialAbilities, `${seed}-ability`), 24),
    description: buildKnownFor(primaryTrait, seed),
    colorTheme: resolveTemplateId(
      rarity,
      chooseFallbackTemplateId(`${input.selfDescription} ${rankedTraits.map((trait) => trait.name).join(" ")}`),
      input.selfDescription,
    ),
  });
}
