import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, COOKIE_NAME } from "@/lib/auth";
import { rateLimit, rateLimitReset } from "@/lib/rateLimit";

// Log in with a username + password. Accounts are provisioned with
// scripts/setup-users.mjs — there is no open signup, this stays private.
export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }
  // Real credentials are short; oversized values are garbage or abuse.
  if (String(username).length > 100 || String(password).length > 200) {
    return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });
  }

  // Brute-force guard: throttle by client IP and by the account being tried.
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const uname = String(username).trim().toLowerCase();
  const ipCheck = rateLimit(`ip:${ip}`, 30, 10 * 60_000);        // 30 tries / 10 min / IP
  const userCheck = rateLimit(`user:${uname}`, 10, 10 * 60_000); // 10 tries / 10 min / account
  if (!ipCheck.ok || !userCheck.ok) {
    const retry = Math.max(ipCheck.retryAfterSec, userCheck.retryAfterSec);
    return NextResponse.json(
      { error: `Too many attempts — try again in ${Math.ceil(retry / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(retry) } }
    );
  }

  const user = await prisma.user.findUnique({ where: { username: uname } });
  // Compare against a constant dummy hash when the user doesn't exist so the
  // response time doesn't reveal which usernames are real.
  const DUMMY_HASH = "$2b$10$nj.9pXYH02Ue3Qk2RpCBT.Qu0B6tlAqG540k.SeRXIiwVZT3NwjiC";
  const ok = bcrypt.compareSync(String(password), user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });
  }

  rateLimitReset(`user:${uname}`);
  const token = await createSession({ id: user.id, username: user.username, role: user.role });
  const res = NextResponse.json({ ok: true, username: user.username, displayName: user.displayName, role: user.role });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
