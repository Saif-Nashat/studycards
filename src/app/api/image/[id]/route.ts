import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Serves a deduplicated image by its content hash. Because the id is the hash
// of the bytes, the content never changes — so it's safe to cache forever.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const img = await prisma.image.findUnique({ where: { id } });
  if (!img) return new Response("Image not found", { status: 404 });

  const bytes = Buffer.from(img.data, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(bytes.length),
    },
  });
}
