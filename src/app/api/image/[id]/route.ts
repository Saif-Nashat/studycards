import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";

// Serves one of the logged-in user's media blobs (images AND audio clips —
// they share the store) by content hash. Because the id is the hash of the
// bytes, the content never changes — safe to cache forever. Media is private:
// each account can only load its own.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return new Response("Not logged in", { status: 401 });

  const { id } = await params;
  const img = await prisma.image.findUnique({ where: { userId_id: { userId: user.id, id } } });
  if (!img) return new Response("Image not found", { status: 404 });

  const bytes = Buffer.from(img.data, "base64");
  const headers: Record<string, string> = {
    "Content-Type": img.mime,
    "Cache-Control": "private, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    // Belt-and-braces: if a deck ever smuggles an SVG (which can embed
    // scripts) into the image store, opening it directly must never let it
    // run code in the app's origin.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "X-Content-Type-Options": "nosniff",
  };

  // Safari only plays <audio>/<video> from servers that honour byte ranges,
  // so answer "Range: bytes=a-b" with a proper 206 (single range is enough).
  const m = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    const start = m[1] ? parseInt(m[1], 10) : Math.max(0, bytes.length - parseInt(m[2], 10));
    const end = m[1] && m[2] ? Math.min(parseInt(m[2], 10), bytes.length - 1) : bytes.length - 1;
    if (start >= bytes.length || start > end) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${bytes.length}` },
      });
    }
    const chunk = bytes.subarray(start, end + 1);
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
        "Content-Length": String(chunk.length),
      },
    });
  }

  return new Response(new Uint8Array(bytes), {
    headers: { ...headers, "Content-Length": String(bytes.length) },
  });
}
