import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  hashPassword,
  isSecureRequest,
  sessionCookieOptions,
  startSession,
} from "@/lib/auth";
import { claimBootstrapData, countUsers, createUser, getUserByEmail } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create an account.
 *
 * The first account registered on a fresh install also claims any inventory
 * that predates accounts (the bootstrap holder), so nothing is orphaned.
 */
export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown; name?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; password?: unknown; name?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (getUserByEmail(email)) {
    return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
  }

  const user = createUser(email, name || email.split("@")[0], hashPassword(password));
  // Hand over any pre-account data to the very first account.
  if (countUsers() === 1) {
    claimBootstrapData(user.id);
  }

  const { token, expiresAt } = startSession(user.id);
  (await cookies()).set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(expiresAt, await isSecureRequest())
  );
  return NextResponse.json({ user }, { status: 201 });
}
