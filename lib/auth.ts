/**
 * Account authentication.
 *
 * Passwords are hashed with scrypt (node:crypto, no native dependency) —
 * see lib/password.ts, which is kept free of Next.js imports so it can be
 * unit-tested with plain node.
 *
 * Sessions are random 32-byte tokens; only the SHA-256 hash is stored in the
 * database, so a stolen database cannot be replayed as a login.
 *
 * The cookie itself is httpOnly + sameSite=lax, so browser JS cannot read it
 * and cross-site form posts cannot ride it.
 */
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSession,
  deleteSession,
  findSessionUser,
  getUserByEmail,
  getUserById,
  purgeExpiredSessions,
} from "./db.ts";
import type { User } from "./db.ts";
import { fakeVerify, hashPassword, verifyPassword } from "./password.ts";

export const SESSION_COOKIE = "smpl_session";
export const LEGACY_SESSION_COOKIE = "declutter_session";
const SESSION_DAYS = 30;

export { hashPassword, verifyPassword };

/* ------------------------------------------------------------ sessions */

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Create a session for a user and return the raw token (the cookie value). */
export function startSession(userId: number): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  createSession(userId, hashToken(token), expiresAt.toISOString());
  return { token, expiresAt };
}

export function endSession(token: string): void {
  deleteSession(hashToken(token));
}

/**
 * Cookie flags.
 *
 * `Secure` is decided per request, not from NODE_ENV: the app runs in
 * production mode locally over plain HTTP (http://host:5099) and behind
 * Caddy over HTTPS. A hardcoded `Secure` would make the browser refuse to
 * send the cookie back over plain HTTP, silently logging the user out.
 * Behind Caddy, `x-forwarded-proto` is authoritative.
 */
export function sessionCookieOptions(expiresAt: Date, secure = false) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    expires: expiresAt,
  };
}

/**
 * True when the current request reached us over HTTPS.
 *
 * Behind Caddy, `x-forwarded-proto` is authoritative. Direct local access
 * over plain HTTP is not secure, so the cookie is not marked Secure there.
 */
export async function isSecureRequest(): Promise<boolean> {
  if (
    process.env.SMPL_FORCE_SECURE_COOKIE === "1" ||
    process.env.DECLUTTER_FORCE_SECURE_COOKIE === "1"
  )
    return true;
  if (
    process.env.SMPL_INSECURE_COOKIE === "1" ||
    process.env.DECLUTTER_INSECURE_COOKIE === "1"
  )
    return false;
  const h = await headers();
  const proto = h.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return false;
}

/* --------------------------------------------------------------- users */

export function authenticate(email: string, password: string): User | null {
  const user = getUserByEmail(email);
  if (!user) {
    // Spend the same work on a missing account so timing does not leak
    // whether the email exists.
    fakeVerify(password);
    return null;
  }
  if (user.isBootstrap) return null;
  if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) return null;
  const { passwordHash: _p, isBootstrap: _b, ...safeUser } = user;
  return safeUser;
}

/** The account signed in on this request, or null. */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token =
    jar.get(SESSION_COOKIE)?.value || jar.get(LEGACY_SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = findSessionUser(hashToken(token));
  if (!user) return null;
  return user;
}

/**
 * The signed-in account, or a redirect to the sign-in page.
 * Use this in server components that render account data.
 *
 * `returnTo` is a path on this site (e.g. "/items/12"). It is echoed back
 * to the sign-in page as `?next=` so the user lands where they meant to go.
 */
export async function requireUser(returnTo?: string): Promise<User> {
  const user = await currentUser();
  if (!user) {
    const target = returnTo ? `/auth/login?next=${encodeURIComponent(returnTo)}` : "/auth/login";
    redirect(target);
  }
  return user;
}

/** Same as requireUser, but for API routes: returns null instead of redirecting. */
export async function apiUser(): Promise<User | null> {
  return currentUser();
}

export { getUserById, purgeExpiredSessions };
