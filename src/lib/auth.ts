import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "sc_session";

// What a login session carries. Everything an API route needs to scope its
// queries lives in the (signed) token, so ordinary requests don't need an
// extra User lookup.
export interface SessionUser {
  id: string;
  username: string;
  role: string; // "member" | "trial"
}

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Fail closed in production: a missing secret must never silently fall
    // back to a publicly known value, or anyone could forge session tokens.
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
    return new TextEncoder().encode("dev-insecure-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(user: SessionUser): Promise<string> {
  return await new SignJWT({ uid: user.id, username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    // Pin the algorithm so a tampered token can't ask for a weaker one.
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    // Pre-multiuser tokens have no uid — treat them as logged out so every
    // session is tied to an account.
    if (!payload.uid || typeof payload.uid !== "string") return null;
    return {
      id: payload.uid,
      username: String(payload.username ?? ""),
      role: String(payload.role ?? "member"),
    };
  } catch {
    return null;
  }
}

// The logged-in user for the current request (API routes / server components).
export async function getUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySession(store.get(COOKIE_NAME)?.value);
}

export async function isLoggedIn(): Promise<boolean> {
  return (await getUser()) !== null;
}

export { COOKIE_NAME };
