import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// A single, app-wide free-text notebook.
export async function GET() {
  const nb = await prisma.notebook.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main", content: "" },
  });
  return NextResponse.json({ content: nb.content, updatedAt: nb.updatedAt });
}

export async function PUT(req: Request) {
  const { content } = await req.json();
  const nb = await prisma.notebook.upsert({
    where: { id: "main" },
    update: { content: String(content ?? "") },
    create: { id: "main", content: String(content ?? "") },
  });
  return NextResponse.json({ ok: true, updatedAt: nb.updatedAt });
}
