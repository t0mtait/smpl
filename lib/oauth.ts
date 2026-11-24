import crypto from "node:crypto";
import { cookies } from "next/headers";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";


export const GOOGLE_CLIENT_ID = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

export const isGoogleConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

export interface OAuthUserInfo {
  provider: "google" | "apple";
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export function getAppBaseUrl(reqHeaders?: Headers): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  if (reqHeaders) {
    const host = reqHeaders.get("host") || "localhost:3000";
    const proto = reqHeaders.get("x-forwarded-proto") || "http";
    return `${proto}://${host}`;
  }
  return "https://gosmpl.app";
}

export function createOAuthState(provider: "google" | "apple", returnTo = "/"): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  return Buffer.from(JSON.stringify({ provider, returnTo, nonce })).toString("base64url");
}

export function parseOAuthState(stateStr: string): { provider: "google" | "apple"; returnTo: string; nonce: string } | null {
  try {
    const json = JSON.parse(Buffer.from(stateStr, "base64url").toString("utf8"));
    if (json && (json.provider === "google" || json.provider === "apple")) {
      return json;
    }
  } catch {
    // invalid
  }
  return null;
}

export function getGoogleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<OAuthUserInfo> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${text}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) throw new Error("Failed to fetch Google profile");
  const profile = (await userRes.json()) as { id: string; email: string; name?: string; picture?: string };

  return {
    provider: "google",
    providerId: profile.id,
    email: profile.email.toLowerCase(),
    name: profile.name || profile.email.split("@")[0],
    avatarUrl: profile.picture,
  };
}

// ---------------------------------------------------------------------
// Sign in with Apple
// ---------------------------------------------------------------------
const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";

/** The Services ID registered with Apple. */
export const APPLE_CLIENT_ID = process.env.AUTH_APPLE_ID || process.env.APPLE_CLIENT_ID;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
// The .p8 contents. Newlines may be stored as literal "\n" in env vars.
const APPLE_PRIVATE_KEY = (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

export const isAppleConfigured = Boolean(
  APPLE_CLIENT_ID && APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY
);

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Apple wants the client secret to be a short-lived ES256 JWT signed with our key. */
function appleClientSecret(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: APPLE_KEY_ID, typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: APPLE_TEAM_ID,
      iat: now,
      exp: now + 300,
      aud: "https://appleid.apple.com",
      sub: APPLE_CLIENT_ID,
    })
  );
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${payload}`), {
    key: APPLE_PRIVATE_KEY,
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${payload}.${b64url(signature)}`;
}

export function getAppleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: APPLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "form_post", // required when requesting name/email scopes
    scope: "name email",
    state,
  });
  return `${APPLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeAppleCode(
  code: string,
  redirectUri: string,
  userJson?: string | null
): Promise<OAuthUserInfo> {
  const tokenRes = await fetch(APPLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: APPLE_CLIENT_ID!,
      client_secret: appleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Apple token exchange failed: ${await tokenRes.text()}`);
  }
  // The id_token comes straight from Apple's token endpoint over TLS in
  // exchange for our signed client secret, so decoding it is sufficient.
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  if (!id_token) throw new Error("Apple did not return an identity token");
  const claims = JSON.parse(Buffer.from(id_token.split(".")[1], "base64url").toString("utf8")) as {
    sub: string;
    email?: string;
  };
  if (!claims.email) throw new Error("Apple did not share an email address");

  // Apple only sends the user's name the very first time, as form data.
  let name = "";
  try {
    const u = userJson ? JSON.parse(userJson) : null;
    name = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(" ");
  } catch {
    // ignore malformed name payload
  }

  return {
    provider: "apple",
    providerId: claims.sub,
    email: claims.email.toLowerCase(),
    name: name || claims.email.split("@")[0],
  };
}
