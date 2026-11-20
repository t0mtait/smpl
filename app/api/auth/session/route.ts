import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  LEGACY_SESSION_COOKIE,
  currentUser,
  endSession,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sign out: destroy the session server-side and clear the cookie. */
export async function POST() {
  const jar = await cookies();
  const token =
    jar.get(SESSION_COOKIE)?.value || jar.get(LEGACY_SESSION_COOKIE)?.value;
  if (token) endSession(token);
  jar.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  jar.set(LEGACY_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}

/** DELETE is an alias for POST — sign-out reads better as a DELETE. */
export async function DELETE() {
  const jar = await cookies();
  const token =
    jar.get(SESSION_COOKIE)?.value || jar.get(LEGACY_SESSION_COOKIE)?.value;
  if (token) endSession(token);
  jar.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  jar.set(LEGACY_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}

/** Who am I? Used by the client to decide whether to show the app or the gate. */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json({ user });
}
