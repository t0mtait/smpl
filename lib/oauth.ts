import crypto from "node:crypto";
import { cookies } from "next/headers";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USERINFO_URL = "https://api.github.com/user";
const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";

export const GOOGLE_CLIENT_ID = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

export const GITHUB_CLIENT_ID = process.env.AUTH_GITHUB_ID || process.env.GITHUB_CLIENT_ID;
export const GITHUB_CLIENT_SECRET = process.env.AUTH_GITHUB_SECRET || process.env.GITHUB_CLIENT_SECRET;

export const isGoogleConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
export const isGithubConfigured = Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);

export interface OAuthUserInfo {
  provider: "google" | "github";
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

export function createOAuthState(provider: "google" | "github", returnTo = "/"): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  return Buffer.from(JSON.stringify({ provider, returnTo, nonce })).toString("base64url");
}

export function parseOAuthState(stateStr: string): { provider: "google" | "github"; returnTo: string; nonce: string } | null {
  try {
    const json = JSON.parse(Buffer.from(stateStr, "base64url").toString("utf8"));
    if (json && (json.provider === "google" || json.provider === "github")) {
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

export function getGithubAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
  });
  return `${GITHUB_AUTH_URL}?${params.toString()}`;
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

export async function exchangeGithubCode(code: string, redirectUri: string): Promise<OAuthUserInfo> {
  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      code,
      client_id: GITHUB_CLIENT_ID!,
      client_secret: GITHUB_CLIENT_SECRET!,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`GitHub token exchange failed: ${text}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    throw new Error(`GitHub OAuth error: ${tokenData.error || "No token returned"}`);
  }

  const userRes = await fetch(GITHUB_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "smpl-app",
    },
  });

  if (!userRes.ok) throw new Error("Failed to fetch GitHub profile");
  const profile = (await userRes.json()) as { id: number; login: string; name?: string; avatar_url?: string; email?: string };

  let email = profile.email;
  if (!email) {
    // Query primary verified email
    const emailsRes = await fetch(GITHUB_EMAILS_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "smpl-app",
      },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      const primary = emails.find((e) => e.primary && e.verified) || emails[0];
      if (primary) email = primary.email;
    }
  }

  if (!email) throw new Error("No public or verified email associated with GitHub account");

  return {
    provider: "github",
    providerId: String(profile.id),
    email: email.toLowerCase(),
    name: profile.name || profile.login,
    avatarUrl: profile.avatar_url,
  };
}
