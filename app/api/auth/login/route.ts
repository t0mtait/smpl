import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  authenticate,
  isSecureRequest,
  sessionCookieOptions,
  startSession,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sign in with email + password and set the session cookie. */
export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // Rate limit: 5 attempts per minute per email
  const rl = checkRateLimit(`login:${email}`, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait 1 minute before trying again." },
      { status: 429 }
    );
  }

  const user = authenticate(email, password);
  if (!user) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const { token, expiresAt } = startSession(user.id);
  (await cookies()).set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(expiresAt, await isSecureRequest())
  );
  return NextResponse.json({ user });
}
