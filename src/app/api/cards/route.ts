import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// List/search cards. Query params: deckId, q (search), flagged, hard, limit.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deckId = searchParams.get("deckId") || undefined;
  const q = searchParams.get("q")?.trim();
  const flagged = searchParams.get("flagged");
  const hard = searchParams.get("hard");
  const tag = searchParams.get("tag")?.trim();
  const leech = searchParams.get("leech");
  const limit = Math.min(Number(searchParams.get("limit")) || 500, 2000);

  const where: Record<string, unknown> = {};
  if (deckId) where.deckId = deckId;
  if (tag) where.tags = { contains: tag };
  if (leech === "1") where.isLeech = true;
  if (flagged === "1") where.flagged = true;
  if (hard === "1") {
    where.OR = [{ flagged: true }, { isLeech: true }, { lastRating: { in: ["again", "hard"] } }];
  }
  if (q) {
    where.OR = [
      { front: { contains: q } },
      { back: { contains: q } },
      { tags: { contains: q } },
    ];
  }

  const cards = await prisma.card.findMany({
    where,
    include: { deck: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json(cards);
}

// Create a single card by hand.
export async function POST(req: Request) {
  const body = await req.json();
  const { deckId, type, front, back, extra, tags, source } = body;
  if (!deckId || !front) {
    return NextResponse.json({ error: "deckId and front are required" }, { status: 400 });
  }
  const card = await prisma.card.create({
    data: {
      deckId,
      type: type || "basic",
      front,
      back: back || "",
      extra: extra || "",
      mnemonic: body.mnemonic || "",
      tags: tags || "",
      source: source || "",
      imageFront: body.imageFront || "",
      imageBack: body.imageBack || "",
    },
  });
  return NextResponse.json(card);
}

// Update a card (edit content, flag, move deck).
export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const allowed = ["type", "front", "back", "extra", "mnemonic", "tags", "source", "flagged", "deckId", "imageFront", "imageBack", "isLeech"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in rest) data[k] = rest[k];
  const card = await prisma.card.update({ where: { id }, data });
  return NextResponse.json(card);
}

// Delete a card.
export async function DELETE(req: Request) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.card.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
