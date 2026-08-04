import type { CardIdentity } from "@/lib/card-schema";

export async function saveLocalCardPrint(params: {
  id: string;
  card: CardIdentity;
  imageDataUrl: string;
}) {
  const response = await fetch("/api/local-cards", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error("Could not save card locally.");
  }
}
