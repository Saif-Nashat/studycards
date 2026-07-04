import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";

// Serves one of the logged-in user's images by its content hash. Because the
// id is the hash of the bytes, the content never changes — safe to cache
// forever. Images are private: each account can only load its own.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return new Response("Not logged in", { status: 401 });

  const { id } = await params;
  const img = await prisma.image.findUnique({ where: { userId_id: { userId: user.id, id } } });
  if (!img) return new Response("Image not found", { status: 404 });

  const bytes = Buffer.from(img.data, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Length": String(bytes.length),
      // Belt-and-braces: if a deck ever smuggles an SVG (which can embed
      // scripts) into the image store, opening it directly must never let it
      // run code in the app's origin.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
