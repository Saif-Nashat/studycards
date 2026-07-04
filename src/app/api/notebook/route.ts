import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

// One private free-text notebook per user.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const nb = await prisma.notebook.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, content: "" },
  });
  return NextResponse.json({ content: nb.content, updatedAt: nb.updatedAt });
}

// The notebook isn't part of the per-deck storage accounting, so give it its
// own generous ceiling — plenty for years of notes, but it can't silently eat
// the shared database.
const MAX_NOTEBOOK_CHARS = 2_000_000; // ~2 MB

export async function PUT(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { content } = await req.json().catch(() => ({}));
  if (typeof content === "string" && content.length > MAX_NOTEBOOK_CHARS) {
    return NextResponse.json(
      { error: "Your notebook has reached its size limit. Try removing old notes or large pasted images." },
      { status: 413 }
    );
  }
  // Strip anything executable before storing (defence-in-depth: content pasted
  // from a webpage can carry event handlers / script tags along).
  const clean = sanitizeHtml(String(content ?? ""));
  const nb = await prisma.notebook.upsert({
    where: { userId: user.id },
    update: { content: clean },
    create: { userId: user.id, content: clean },
  });
  return NextResponse.json({ ok: true, updatedAt: nb.updatedAt });
}
