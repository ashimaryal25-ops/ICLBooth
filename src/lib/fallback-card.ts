import type { CardIdentity, CardRequest } from "@/lib/card-schema";
import { createLocalCard } from "@/lib/local-card-copy";

export function createFallbackCard(input: CardRequest): CardIdentity {
  return createLocalCard(input);
}
