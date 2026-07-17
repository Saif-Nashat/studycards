import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

// The current session's identity — used by the client to show role-specific UI
// (e.g. the trial-account self-reset button) without exposing anyone else's data.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  return NextResponse.json({ username: user.username, role: user.role });
}
