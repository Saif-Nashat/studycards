import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";

// List every tag with how many cards use it and how many are ready to study now.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const now = new Date();
  const cards = await prisma.card.findMany({ where: { userId: user.id }, select: { tags: true, state: true, due: true } });

  const map = new Map<string, { total: number; ready: number }>();
  for (const c of cards) {
    const ready = c.state === "new" || c.due <= now;
    for (const raw of c.tags.split(",")) {
      const tag = raw.trim();
      if (!tag) continue;
      const s = map.get(tag) || { total: 0, ready: 0 };
      s.total++;
      if (ready) s.ready++;
      map.set(tag, s);
    }
  }

  const tags = Array.from(map.entries())
    .map(([tag, s]) => ({ tag, total: s.total, ready: s.ready }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json(tags);
}
