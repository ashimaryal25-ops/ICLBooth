import { NextResponse } from "next/server";
import { cardRequestSchema } from "@/lib/card-schema";
import { generateCard } from "@/lib/card-generation";
import { checkDescriptionSafety } from "@/lib/server-description-safety";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = cardRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid card request." }, { status: 400 });
  }

  const safety = await checkDescriptionSafety(parsed.data.selfDescription);

  if (!safety.safe) {
    return NextResponse.json(
      { error: safety.message ?? "Please revise the card description." },
      { status: 400 },
    );
  }

  const card = await generateCard(parsed.data);
  const cardId = crypto.randomUUID();

  return NextResponse.json({ card, cardId });
}
