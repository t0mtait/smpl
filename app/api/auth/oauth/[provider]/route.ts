import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createOAuthState,
  getAppBaseUrl,
  getGoogleAuthUrl,
  getAppleAuthUrl,
  GOOGLE_CLIENT_ID,
  isAppleConfigured,
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ provider: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { provider } = await params;
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") || "/";

  const baseUrl = getAppBaseUrl(req.headers);
  const redirectUri = `${baseUrl}/api/auth/oauth/${provider}/callback`;

  if (provider === "google") {
    if (!GOOGLE_CLIENT_ID) {
      return NextResponse.json({ error: "Google OAuth is not configured on this server." }, { status: 400 });
    }
    const state = createOAuthState("google", returnTo);
    (await cookies()).set("oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });
    return NextResponse.redirect(getGoogleAuthUrl(state, redirectUri));
  }

  if (provider === "apple") {
    if (!isAppleConfigured) {
      return NextResponse.json({ error: "Apple sign-in is not configured on this server." }, { status: 400 });
    }
    const state = createOAuthState("apple", returnTo);
    // Apple POSTs back cross-site (form_post), so a Lax cookie would be
    // dropped. SameSite=None requires Secure.
    (await cookies()).set("oauth_state", state, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      maxAge: 600,
      path: "/",
    });
    return NextResponse.redirect(getAppleAuthUrl(state, redirectUri));
  }

  return NextResponse.json({ error: `Unsupported provider ${provider}` }, { status: 400 });
}
