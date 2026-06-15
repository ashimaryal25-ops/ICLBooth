/**
 * Client-side wrapper for the /api/generate-card route (server implementation
 * lives in src/lib/card-generation.ts). Validates the request, posts it, and
 * falls back to the deterministic local card when the network or the API fails.
 */
import { z } from "zod";
import { cardRequestSchema, cardSchema, type CardIdentity, type CardRequest } from "@/lib/card-schema";
import { createFallbackCard } from "@/lib/fallback-card";

export interface GenerateCardIdentityResult {
  card: CardIdentity;
  cardId: string | null;
}

export async function generateCardIdentity(input: CardRequest): Promise<GenerateCardIdentityResult> {
  const payload = cardRequestSchema.parse(input);

  try {
    const response = await fetch("/api/generate-card", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Card generation failed.");
    }

    const data: unknown = await response.json();
    const parsedResponse = cardGenerationResponseSchema.parse(data);

    return {
      card: parsedResponse.card,
      cardId: parsedResponse.cardId,
    };
  } catch {
    return {
      card: createFallbackCard(payload),
      cardId: null,
    };
  }
}

const cardGenerationResponseSchema = z.object({
  card: cardSchema,
  cardId: z.string().uuid().nullable(),
});
