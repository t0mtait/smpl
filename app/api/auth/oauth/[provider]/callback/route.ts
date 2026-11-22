import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  isSecureRequest,
  sessionCookieOptions,
  startSession,
} from "@/lib/auth";
import {
  claimBootstrapData,
  countUsers,
  createUser,
  findOAuthAccount,
  getUserByEmail,
  linkOAuthAccount,
} from "@/lib/db";
import {
  exchangeGithubCode,
  exchangeGoogleCode,
  getAppBaseUrl,
  parseOAuthState,
  OAuthUserInfo,
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ provider: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { provider } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("code") ? url.searchParams.get("state") : null;
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${getAppBaseUrl(req.headers)}/auth/login?error=${encodeURIComponent(error)}`);
  }

  const cookieJar = await cookies();
  const savedState = cookieJar.get("oauth_state")?.value;
  cookieJar.delete("oauth_state");

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(
      `${getAppBaseUrl(req.headers)}/auth/login?error=Invalid%20or%20expired%20OAuth%20state`
    );
  }

  const parsedState = parseOAuthState(state);
  const returnTo = parsedState?.returnTo && parsedState.returnTo.startsWith("/") ? parsedState.returnTo : "/";
  const baseUrl = getAppBaseUrl(req.headers);
  const redirectUri = `${baseUrl}/api/auth/oauth/${provider}/callback`;

  let userInfo: OAuthUserInfo;
  try {
    if (provider === "google") {
      userInfo = await exchangeGoogleCode(code, redirectUri);
    } else if (provider === "github") {
      userInfo = await exchangeGithubCode(code, redirectUri);
    } else {
      return NextResponse.redirect(`${baseUrl}/auth/login?error=Unsupported%20provider`);
    }
  } catch (err) {
    return NextResponse.redirect(
      `${baseUrl}/auth/login?error=${encodeURIComponent((err as Error).message || "OAuth exchange failed")}`
    );
  }

  // 1. Check if OAuth account link already exists
  const existingLink = findOAuthAccount(userInfo.provider, userInfo.providerId);
  let userId: number;

  if (existingLink) {
    userId = existingLink.userId;
  } else {
    // 2. Check if a user with this email already exists
    const existingUser = getUserByEmail(userInfo.email);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      // 3. Create a new user (with random dummy password hash)
      const newUser = createUser(userInfo.email, userInfo.name, "");
      userId = newUser.id;
      // First registered user claims any bootstrap inventory
      if (countUsers() === 1) {
        claimBootstrapData(userId);
      }
    }
    // Link OAuth account
    linkOAuthAccount(userId, userInfo.provider, userInfo.providerId, userInfo.email);
  }

  // Set session cookie
  const { token, expiresAt } = startSession(userId);
  cookieJar.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(expiresAt, await isSecureRequest())
  );

  return NextResponse.redirect(`${baseUrl}${returnTo}`);
}
