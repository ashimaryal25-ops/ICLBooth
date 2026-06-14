import { NextResponse } from "next/server";
import { cardRequestSchema } from "@/lib/card-schema";
import { generateCard } from "@/lib/card-generation";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = cardRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid card request." }, { status: 400 });
  }

  try {
    const card = await generateCard(parsed.data);
    const cardId = crypto.randomUUID();
    return NextResponse.json({ card, cardId });
  } catch {
    return NextResponse.json({ error: "Card generation failed." }, { status: 502 });
  }
}
